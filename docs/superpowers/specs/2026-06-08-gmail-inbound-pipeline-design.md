# Gmail Inbound Pipeline (Slice 1) — Design Spec

## 1. Goal

Let a ZeroSpam user connect their existing Gmail account via OAuth so that new
Gmail mail is pulled into ZeroSpam and filtered through the existing
quarantine-by-default policy. This is the first vertical slice of the
multi-provider aggregator described in
[2026-05-01-aggregator-inbox-design.md](2026-05-01-aggregator-inbox-design.md):
Gmail only, inbound only, forward-only. Outlook reuses the same machinery in a
later slice.

The success criterion: a user clicks "Connect Gmail", grants consent, and within
one poll interval new mail arriving at their Gmail address appears in ZeroSpam —
whitelisted senders in inbox, everyone else in quarantine — with no change to the
downstream pipeline.

## 2. Scope

### In scope
- A `connections` table recording an OAuth-linked Gmail account.
- AES-256-GCM encryption of stored OAuth tokens, with a key loaded the same way
  the digest signing secret is (env var, else generated file).
- A provider-agnostic `ProviderConnector` interface with one implementation,
  `GmailConnector`, wrapping the official `googleapis` client (injectable for
  tests).
- Gmail OAuth routes: `GET /api/oauth/gmail/start` and
  `GET /api/oauth/gmail/callback`.
- A polling sync worker (`connection-poller.ts`) booted alongside the digester.
- A **Connections** management UI: connect, list, status, disconnect.
- Config/env for Google credentials, the connection secret, and poll cadence.

### Out of scope (later slices)
- **Outlook / Microsoft Graph** adapter (next slice; same interface).
- **Send / reply `From`-rewrite** — slice 1 is read-only ingestion. Replying to a
  pulled Gmail message is a later slice (per the aggregator spec, outbound is
  forced to the native `@zero-spam.email` identity).
- **History backfill** — slice 1 is forward-only (cursor starts at connect time).
- **Push notifications** (Gmail Pub/Sub), **two-way sync**, **cross-mailbox
  whitelist**, and **Yahoo/AOL** (IMAP) — all deferred.

## 3. Key decisions (locked in brainstorming)

1. **Gmail end-to-end first**, then replicate the adapter for Outlook.
2. **Build the real OAuth flow + poller, test against a stub.** Unit/integration
   tests run with a stubbed Gmail client (no network). The operator supplies
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from a Google Cloud OAuth app in
   **Testing** publishing mode (≤100 test users, no restricted-scope assessment)
   when ready. Production CASA verification is deferred.
3. **Forward-only initial sync.** On connect, the cursor is seeded to the current
   Gmail `historyId`; only mail arriving after connect is ingested. No history is
   back-filled, so quarantine is not flooded on day one.

## 4. Foundation already in place

These pieces from the aggregator spec already exist (shipped with the
accounts/OTP work) and are reused as-is:

- `accounts` table and `account_id` on `users`, `mailboxes`, `domains`.
- `mailboxes.provider` column with `CHECK (provider IS NULL OR provider IN ('gmail','outlook'))`.
- `users.email_verified_at`, signup + auth routes, sessions.
- `ingest(rawBuffer, recipient, clientIp?)`, whitelist/quarantine routing,
  sweeper, daily digest, FTS, attachment storage — all unchanged.

## 5. Architecture overview

```
Gmail  --OAuth-->  oauth-gmail routes  --writes-->  connections + mailbox row
  ^                                                       |
  |                                                       v
  +----<-- googleapis (history.list / messages.get raw) --+
                          |
                connection-poller.tick()  (every 60s, per due connection)
                          |
                          v
                 ingest(raw, gmailAddress)   <-- existing pipeline, untouched
                          |
                 inbox  /  quarantine  (per existing whitelist rules)
```

A connected Gmail account becomes a **second `mailbox` row** at the connected
address (e.g. `alice@gmail.com`) with `provider='gmail'`, sharing the user's
`account_id`. Because `ingest()`'s `resolveRecipient` matches
`mailboxes WHERE address = ?`, the poller simply calls
`ingest(raw, 'alice@gmail.com')` and the existing routing does the rest.
Whitelist rules are per `mailbox_id`, so trusting a sender on the Gmail mailbox
affects future Gmail-pulled mail only (cross-mailbox whitelist is a later slice).

## 6. Data model

```sql
CREATE TABLE connections (
  id                   INTEGER PRIMARY KEY,
  account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mailbox_id           INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK(provider IN ('gmail','outlook')),
  access_enc           TEXT NOT NULL,         -- AES-256-GCM(access_token)
  refresh_enc          TEXT NOT NULL,         -- AES-256-GCM(refresh_token)
  expires_at           INTEGER NOT NULL,      -- access-token expiry (epoch ms)
  cursor               TEXT,                  -- Gmail historyId; seeded at connect
  status               TEXT NOT NULL CHECK(status IN ('active','needs_reconnect','paused')),
  last_polled_at       INTEGER,
  last_error           TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL
);
CREATE INDEX idx_connections_due ON connections(status, last_polled_at);
```

Migration follows the existing idempotent `colsOf`/`CREATE TABLE IF NOT EXISTS`
pattern in `db.ts`. A `Connection` type is added alongside the other row types.

**Invariants:**
- Every connection's `mailbox_id` points to a mailbox on the same `account_id`
  whose `address` equals the connected Gmail address and whose `provider='gmail'`.
- Encrypted columns never hold plaintext tokens.
- Reconnecting an already-connected address updates the existing rows in place
  rather than creating duplicates.

## 7. Token vault (`connection-crypto.ts`)

Pure module, no I/O beyond key load:

```
encryptToken(plaintext: string, key: Buffer): string   // returns base64(iv|tag|ciphertext)
decryptToken(blob: string, key: Buffer): string | null // null on tamper/format error
```

- AES-256-GCM, random 12-byte IV per encryption, 16-byte auth tag.
- `loadConnectionSecret(): Buffer` mirrors `loadDigestSigningSecret()`: read
  `CONNECTION_SECRET` from env if set (decoded/derived to 32 bytes via HKDF-SHA256
  with a fixed info label); else read/generate `data/.connection-secret`
  (32 random bytes, file mode `0600`). Lazy so tests can control env.
- Tampering with any byte of the blob makes GCM verification fail →
  `decryptToken` returns `null`; callers treat that connection as
  `needs_reconnect`.

## 8. Connector interface + Gmail adapter

```ts
// connectors/types.ts
export interface FetchedMessage { providerMsgId: string; raw: Buffer; }

export interface ProviderConnector {
  provider: 'gmail' | 'outlook';
  verifyIdentity(tokens: OAuthTokens): Promise<{ email: string; cursor: string }>;
  ensureFresh(conn: Connection): Promise<OAuthTokens>; // refresh if near expiry
  fetchSince(tokens: OAuthTokens, cursor: string):
    Promise<{ messages: FetchedMessage[]; nextCursor: string }>;
}
```

`GmailConnector` (`connectors/gmail.ts`) wraps `googleapis`:
- `verifyIdentity` → `users.getProfile` returns `emailAddress` and current
  `historyId` (used as the seed cursor — forward-only).
- `fetchSince` → `users.history.list({ startHistoryId: cursor })`, collect
  `messagesAdded`, then `users.messages.get({ id, format: 'raw' })` for each,
  base64url-decode to a `Buffer`. `nextCursor` = the response's `historyId`.
- `ensureFresh` → if `expires_at` is within a 2-minute skew, use the OAuth2
  client's refresh to mint a new access token.
- Cursor-invalid (`404` on a too-old `historyId`): out of scope for forward-only
  v1 in practice, but handled defensively by re-seeding to the latest `historyId`
  and logging — no backfill attempted.

The underlying `google.gmail`/OAuth2 client is created by a small injectable
factory so tests pass a stub implementing the same shape (no network, no real
credentials).

## 9. OAuth flow (`routes/oauth-gmail.ts`)

1. `GET /api/oauth/gmail/start` (authenticated): returns/redirects to the Google
   consent URL for scope `https://www.googleapis.com/auth/gmail.readonly`,
   `access_type=offline`, `prompt=consent` (to guarantee a refresh token), with a
   signed, time-boxed `state` token (HMAC, reusing the digest-token style helper)
   binding the request to the user's session.
2. `GET /api/oauth/gmail/callback?code=&state=`: validate `state`; exchange `code`
   for tokens; `verifyIdentity` to confirm the Gmail address and seed cursor.
3. Upsert: if a `mailbox` for that address exists on the account, update its
   `connections` row; else create the `mailbox` (`provider='gmail'`) and a new
   `connections` row with `status='active'`, encrypted tokens, seeded cursor.
4. Redirect back to the app's Connections view.

If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are unset, `/start` returns a clear
`503`-style error explaining the operator must configure credentials. Redirect
URI is derived from `PUBLIC_BASE_URL` (`<base>/api/oauth/gmail/callback`).

## 10. Sync worker (`connection-poller.ts`)

Booted from `index.ts` next to `startDigester()`. `setInterval` at
`CONNECTION_POLL_INTERVAL_SEC` (default 60).

```
tick(now):
  for each connection where status='active'
       AND (last_polled_at IS NULL OR last_polled_at + backoff(failures) <= now):
    try:
      tokens = await connector.ensureFresh(conn)   # persist refreshed tokens
      { messages, nextCursor } = await connector.fetchSince(tokens, conn.cursor)
      for m of messages: await ingest(m.raw, mailbox.address)
      persist cursor=nextCursor, last_polled_at=now, consecutive_failures=0, last_error=NULL
    catch authError (401 / refresh failure / decrypt null):
      status='needs_reconnect'; last_error=...
    catch transient (5xx/network/429):
      consecutive_failures++; last_error=...; (backoff applies next tick)

backoff(failures) = min(60s * 2^failures, 1h)
```

Accepts injected `clock` and `connector` for `vi.useFakeTimers()` tests. Multiple
connections are independent. Ingestion errors on a single message are logged and
skipped without failing the whole connection (the cursor still advances past
successfully-processed history; a message that fails ingest is logged for
follow-up rather than blocking the queue).

## 11. UI — Connections management

A **Connections** section added to the existing settings surface
(`MailboxManager` or a sibling panel reachable from the same gear menu):

- **Connect Gmail** button → navigates to `/api/oauth/gmail/start`.
- List of connections: provider icon, connected email, status badge
  (`active` / `needs_reconnect` / `paused`), last-synced relative time.
- **Disconnect** button → `DELETE /api/connections/:id`. Default keeps imported
  mail (the mailbox + messages remain); a confirm dialog states this. (A "delete
  imported mail too" option is deferred.)
- `needs_reconnect` rows show a **Reconnect** action that re-runs `/start`.

New API: `GET /api/connections` (list for the session's account) and
`DELETE /api/connections/:id`.

## 12. Config / env (new)

| Var | Default | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `''` | Google OAuth client id (operator-supplied) |
| `GOOGLE_CLIENT_SECRET` | `''` | Google OAuth client secret |
| `CONNECTION_SECRET` | unset → generated file | Master key material for token vault |
| `CONNECTION_POLL_INTERVAL_SEC` | `60` | Poll cadence |

Redirect URI is `${PUBLIC_BASE_URL}/api/oauth/gmail/callback` (PUBLIC_BASE_URL
already exists from the digest work).

## 13. Test strategy (vitest, mirrors the digest TDD approach)

- **connection-crypto**: encrypt→decrypt round-trip; tamper→`null`; wrong key→`null`;
  secret loader env vs generated-file paths.
- **GmailConnector** (stubbed client): `fetchSince` collects `messagesAdded`,
  fetches raw, advances cursor; `verifyIdentity` returns email + seed cursor;
  `ensureFresh` refreshes only when near expiry.
- **OAuth callback**: mocked code exchange → creates mailbox + connection,
  encrypts tokens, seeds cursor; reconnect updates in place; invalid `state` →
  rejected; missing creds on `/start` → clear error.
- **Poller** (`vi.useFakeTimers()`, stub connector): due-selection respects
  backoff; success path ingests + advances cursor + clears failures; 401 →
  `needs_reconnect`; transient → `consecutive_failures++` and backoff; multiple
  connections poll independently.
- **End-to-end** (stub Gmail feeding 3 mixed senders into a seeded account):
  whitelisted sender → inbox, others → quarantine; "Allow forever" on a
  quarantined Gmail sender → subsequent pulls from that sender bypass quarantine.

## 14. Risks / open items

- **Refresh-token availability**: Google only returns a refresh token on first
  consent (or with `prompt=consent`). We force `prompt=consent` to be safe; if a
  refresh token is ever absent, the connection is marked `needs_reconnect`.
- **Testing-mode token expiry**: Google Testing-mode refresh tokens expire after
  7 days. Acceptable for development; documented for the operator.
- **Quota**: at single/low user scale Gmail API quota is irrelevant; per-user
  pacing is a later-scale concern, flagged not solved.
- **Secret rotation**: rotating `CONNECTION_SECRET` requires a one-shot
  re-encrypt migration; document the runbook (same caveat as the digest secret).

## 15. Self-review

- **Placeholders**: none.
- **Consistency**: data model (§6) matches the poller (§10) and OAuth flow (§9);
  scope (§2) matches decisions (§3); reused foundation (§4) verified against the
  actual schema.
- **Scope**: a single coherent implementation plan — one provider, inbound only,
  forward-only. Outlook/send/backfill explicitly deferred.
- **Ambiguity**: forward-only cursor seeding, in-place reconnect, disconnect
  default (keep mail), and missing-credentials behavior are all made explicit.
