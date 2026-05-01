# zero-spam.email Aggregator Inbox — Design Spec

## 1. Goal

`zero-spam.email` is a consumer email service positioned as a *unified inbox + identity migration tool*. Each user gets `username@zero-spam.email` as their primary identity. They connect external accounts (Gmail and Outlook in v1; Protonmail in v3) which are pulled in read-only and filtered through ZeroSpam's existing quarantine-by-default rule. Outbound mail goes from `username@zero-spam.email` via ZeroSpam's own SMTP. Over time, replies-to-replies migrate the user's correspondence to their `@zero-spam.email` address; old correspondents who only know the user's Gmail address keep flowing through Gmail until that conversation organically dies.

## 2. Differentiator

ZeroSpam's filter is a *quarantine-by-default policy*, not a classifier. Every non-whitelisted sender goes to quarantine. The user receives a daily digest of senders waiting for their decision, clicks "Allow forever" once per sender, and from then on that sender's mail bypasses quarantine. Gmail's spam classifier is best-effort and probabilistic; ZeroSpam's policy is unconditional. The "save time" pitch flows from the policy, not from better detection.

The aggregator is what makes the policy practical for users who already have years of mail at Gmail/Outlook: rather than asking them to switch providers cold, ZeroSpam pulls their existing mail and applies the policy on top.

## 3. Architecture overview

The existing ZeroSpam codebase is a webmail server with native SMTP ingest, per-mailbox whitelist rules, quarantine, sweeper, and a daily digest. Aggregator support is layered on top:

- A new `connections` table records OAuth-linked Gmail/Outlook accounts.
- A new background worker (`connection-poller.ts`) — same shape as `digester.tick` — polls each connection's delta API every 60s, fetches new messages as raw RFC822, and runs them through the existing `ingest()` pipeline. Quarantine and digest run unmodified.
- A new `accounts` table introduces the multi-tenant boundary. Existing `users`, `mailboxes`, and `domains` rows get an `account_id`. The current owner is `account_id = 1`. Open signup is added; bootstrapped-owner mode is replaced.
- Each connected provider becomes a `mailbox` row with a `provider` column (`gmail` / `outlook` / `null` for native). The unified inbox view is "messages WHERE account_id = ?" across all mailboxes.
- Outbound flow is unchanged. `sender.ts` continues to send via existing `loopback`/`relay` modes from the user's native `@zero-spam.email` mailbox. The MX-direct delivery upgrade drafted earlier in `2026-05-01-mx-outbound-delivery-implementation.md` stays deferred — it's a Phase 2 cost optimization, not a v1 blocker.

## 4. v1 scope

### In scope

- **Open signup** with email/password + email verification + optional TOTP. Auto-provisions `username@zero-spam.email` on signup.
- **Account boundary**: `accounts` table with hardcoded `account_id = 1` for the existing owner; backfill all existing rows.
- **Gmail connect** via OAuth with `https://www.googleapis.com/auth/gmail.readonly` scope.
- **Outlook connect** via OAuth with `Mail.Read` scope.
- **Polling sync worker** at 60s default cadence per connection, with per-connection cursor (Gmail historyId / Graph deltaToken), token-refresh handling, and exponential backoff on transient errors.
- **Quarantine integration**: pulled mail is fed into the existing `ingest()` pipeline as raw RFC822. Whitelist/quarantine logic and the daily digest run unmodified.
- **Unified inbox view**: list messages across all mailboxes for the account in a single feed; existing per-mailbox views remain available.
- **Send flow**: compose + reply through existing `sender.ts` from the user's `@zero-spam.email` identity, regardless of which mailbox the original mail came from. `In-Reply-To` and `References` headers preserved for threading.
- **Connection management UI**: list connections, show sync status, disconnect.

### Out of scope (Phase 2/3)

- **Protonmail** (v3): requires Proton Bridge IMAP, fundamentally different protocol shape.
- **Push notifications** (v2): Gmail Pub/Sub + Graph subscriptions for sub-second sync. Polling is adequate for v1.
- **Two-way sync** (v2): mirroring ZeroSpam's filter back to the source provider (e.g., move quarantined Gmail messages to a "ZS-Quarantine" label). Requires `gmail.modify` / `Mail.ReadWrite` scope upgrade.
- **MX-direct outbound delivery** (Phase 2 cost optimization): defer; existing `relay` mode is sufficient for v1 volumes.
- **Webhooks for transactional senders** (Phase 2): not relevant to consumer aggregator.
- **Multi-user-per-account, billing, quotas**: deferred until product-market fit signal.
- **Open/click tracking, templates, broadcasts**: not relevant to consumer aggregator.

## 5. Data model

```sql
-- New
CREATE TABLE accounts (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  INTEGER NOT NULL
);

CREATE TABLE connections (
  id                    INTEGER PRIMARY KEY,
  account_id            INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mailbox_id            INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK(provider IN ('gmail','outlook')),
  oauth_access_enc      TEXT NOT NULL,         -- AES-GCM(config.sessionSecret-derived key, access_token)
  oauth_refresh_enc     TEXT NOT NULL,
  oauth_expires_at      INTEGER NOT NULL,
  cursor                TEXT,                  -- Gmail historyId / Graph deltaToken; NULL on bootstrap
  status                TEXT NOT NULL CHECK(status IN ('active','needs_reconnect','paused')),
  last_polled_at        INTEGER,
  last_error            TEXT,
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  created_at            INTEGER NOT NULL
);
CREATE INDEX idx_connections_due ON connections(status, last_polled_at);

-- Modified (additive ALTER COLUMN, backfilled to account_id=1)
ALTER TABLE users      ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE mailboxes  ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE mailboxes  ADD COLUMN provider   TEXT;  -- NULL = native, else 'gmail'/'outlook'
ALTER TABLE domains    ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE users      ADD COLUMN email_verified_at INTEGER;
```

**Key invariants:**
- Every `users`, `mailboxes`, `domains`, `connections` row has a non-null `account_id`.
- A user has exactly one native mailbox (`provider IS NULL`) at `username@zero-spam.email`.
- A connection's `mailbox_id` references a mailbox whose address equals the connected provider's email and whose `provider` matches.
- Token encryption: AES-GCM with a key derived from `config.sessionSecret` via HKDF (so the same env-secret protects both session cookies and connection tokens; rotation requires a one-shot re-encrypt migration).

## 6. Provider connection: OAuth + sync worker

### OAuth flow

1. Authenticated user clicks "Connect Gmail" → `GET /api/oauth/gmail/start` → server returns the Google consent URL with state token.
2. Google redirects back to `/api/oauth/gmail/callback?code=...&state=...`.
3. Server validates state, exchanges the code for tokens, calls Gmail's `users.getProfile` to confirm the connected email.
4. If a `mailbox` for that address already exists on this account (e.g., the user reconnected after a `needs_reconnect`), update its `connections` row in place. Otherwise create a new `mailbox` (with `provider='gmail'`) and a new `connections` row.
5. Initial sync: cursor starts at the latest `historyId` returned by `users.getProfile`. The first poll back-fills the last 30 days; subsequent polls use the cursor.

Outlook flow is structurally identical against Microsoft Graph (`/me/messages/delta`, `/me`).

### Sync worker

`server/src/connection-poller.ts`, started from `index.ts` alongside the digester.

```text
tick():
  for each connection where status='active' AND
       (last_polled_at IS NULL OR last_polled_at + interval(failures) < now):
    refresh_token_if_expiring_soon()
    if needs_reconnect: continue (worker won't pick it up next tick)
    delta = fetch_delta(cursor)
    for each new message in delta:
      raw = fetch_raw_message(message_id)            # provider's raw RFC822 endpoint
      ingest(raw, mailbox.address)                   # existing pipeline
    cursor = delta.next_cursor
    consecutive_failures = 0
    last_polled_at = now
  on transient error (5xx/network):
    consecutive_failures++; persist last_error; backoff = min(60s · 2^failures, 1h)
  on auth error (401, refresh fails):
    status = 'needs_reconnect'
```

**Test seam:** the worker accepts an injected `clock` and an injected `providerClient`, so unit tests run with `vi.useFakeTimers()` and a stubbed `Gmail` / `Graph` client.

## 7. Send flow

The compose surface in the webmail UI is unchanged. `POST /api/messages/send` already exists. v1 changes:

- The `From` header is forced to the user's native `@zero-spam.email` mailbox, regardless of which mailbox the user is "viewing". (User can reply to a `marketing@acme.com` message that was pulled from Gmail; the reply goes out as `username@zero-spam.email`.)
- `In-Reply-To` and `References` headers carry over the original message-ID — threading works regardless of source.
- DKIM is signed with the existing `zero-spam.email` domain key.
- Recipients see the user as `username@zero-spam.email`. Their replies come back inbound to the user's native mailbox (via ZeroSpam's SMTP). Migration is incremental: each new conversation is anchored on `zero-spam.email`.
- Optional per-user setting: `Reply-To: <user's gmail>` for graceful migration. Off by default.
- The MX-direct upgrade is *not* required — `sender.ts`'s `relay` mode (with a configured outbound relay like Mailgun/SES/Postmark) is sufficient for v1.

## 8. Filter / quarantine integration

`server/src/ingest.ts` already classifies inbound mail and writes to the appropriate folder based on `whitelist_rules`. The poller hands it raw RFC822 buffers fetched from the provider:

- Gmail: `users.messages.get` with `format=raw` returns the original message bytes.
- Outlook (Graph): `GET /me/messages/{id}/$value` returns MIME source.

Whitelist rules are scoped per `mailbox`. So when a Gmail message from `marketing@acme.com` is quarantined, "Allow forever" creates a whitelist rule on the Gmail-source mailbox. Future Gmail-pulled mail from that sender bypasses quarantine. (Cross-mailbox global whitelist is a v2 ergonomic improvement.)

The daily digest already iterates per-mailbox; it just sees more mailboxes per account. No code change.

## 9. UI changes

- **New onboarding page**: signup form (email, password, chosen username with availability check), email-verification gate, then "Connect Gmail" / "Connect Outlook" / "Skip for now" CTAs.
- **New settings panel**: "Connections" tab — list of connections with provider, connected email, sync status (`active` / `needs_reconnect` / `paused`), last-polled timestamp, "Disconnect" button.
- **Sidebar**: native mailbox at the top, then connected mailboxes grouped by provider with their provider icon.
- **Unified inbox view**: a new top-level view that aggregates `messages WHERE account_id = ? AND folder = 'inbox' ORDER BY received_at DESC`. Existing per-mailbox views remain. Default landing view after login.
- **Compose / reply UI**: unchanged. Reply pulls the original message's headers; `From` is silently forced to the user's `@zero-spam.email` identity.

## 10. Open signup + auth

- New route: `POST /api/auth/signup` with `{ email, password, username }`.
  - Validates: email format, password ≥ 12 chars, username matches `[a-z0-9._-]{3,32}` and not in a reserved-names list (`admin`, `postmaster`, `webmaster`, `support`, `hostmaster`, `abuse`, `noreply`, `no-reply`, `mailer-daemon`).
  - Creates `accounts` row, `users` row, `mailboxes` row at `username@zero-spam.email`.
  - Sends verification email containing a one-shot signed token.
  - Login is blocked until `users.email_verified_at` is set.
- New route: `GET /auth/verify?t=<signed-token>` — sets `email_verified_at` and redirects to login.
- TOTP remains optional; settings UI to enable already exists.
- Sessions and cookies unchanged.
- "Sign in with Google" deliberately *not* added in v1: it would conflate Gmail-as-identity with Gmail-as-source, and users may want their ZeroSpam account decoupled from any one provider for the same migration reasons that motivate the product itself.

## 11. Test strategy

- **Unit tests** (vitest):
  - Whitelist/quarantine on Gmail-source mail using captured RFC822 fixtures.
  - Cursor advancement on a stubbed Gmail History API.
  - OAuth callback handler with a mocked exchange.
  - Token-refresh path on 401.
  - Signup validation: reserved usernames, weak passwords, duplicate emails.
- **Edge-case tests**:
  - Connection in `needs_reconnect` state stays out of the poller.
  - Cursor goes invalid (Gmail returns 404 for old historyId) → re-bootstrap from latest `historyId`.
  - Provider returns 429 → backoff respects rate-limit.
  - Forwarded message with rich HTML routes through ingest cleanly.
  - Non-UTF-8 / RFC 2047-encoded subjects.
  - Dual-content (text+html) parts.
  - Attachments preserved through the raw-fetch path.
- **Fake-time worker tests** (`vi.useFakeTimers()`):
  - Backoff respects `consecutive_failures` exponent and 1h cap.
  - Polling fires exactly when `last_polled_at + interval` is due.
  - Multiple connections poll independently.
- **Smoke test** (post Phase-1):
  - Real server with sandbox `DATA_DIR`.
  - Signup → verify → connect a stubbed Gmail (in-process fake at `gmail.googleapis.com` via `nock`-style HTTP stub).
  - Seed 5 messages with mixed senders → wait for poll → assert messages appear classified per ZeroSpam rules → click "Allow forever" on one → assert subsequent pulls from that sender bypass quarantine.
  - Reply via webmail → assert SMTP-out from `zero-spam.email` with correct DKIM signature.

## 12. Phase 2/3 roadmap (informational)

- **Phase 2.A** — Push notifications: Gmail Pub/Sub subscription, Graph webhook subscription. Cuts sync latency from 60s to seconds. Worker remains as fallback.
- **Phase 2.B** — Two-way sync: mark-read mirror, label mirroring, scope upgrade to `gmail.modify` / `Mail.ReadWrite`. Optional per-user toggle.
- **Phase 2.C** — Cross-mailbox whitelisting: a single "Allow forever" applies across all of an account's mailboxes.
- **Phase 2.D** — MX-direct outbound delivery (per the plan in `docs/superpowers/plans/2026-05-01-mx-outbound-delivery-implementation.md`): drop the outbound-relay dependency.
- **Phase 3.A** — Protonmail via Proton Bridge IMAP.
- **Phase 3.B** — Multi-user-per-account, billing, plan tiers.

## 13. Open questions / risks

- **Token encryption key rotation**: HKDF-derived from `config.sessionSecret`. Rotating the secret requires a one-shot re-encrypt migration. Document the operational runbook.
- **Connection removal data retention**: when a user disconnects Gmail, do we keep imported mail or delete it? Default: keep, with a "Delete imported mail" checkbox at disconnect time. Worth confirming with privacy review before launch.
- **Username availability + grandfathering**: usernames are first-come-first-served. No reservation system in v1. Reserved-names list catches the obvious operational addresses.
- **Username changes**: not supported in v1. A change requires renaming the mailbox row and updating outbound `From` defaults. Tractable but deferred.
- **Provider rate limits**: Gmail API quota is per-project, not per-user; Graph similar. At single-user scale this is irrelevant; at thousand-user scale we need per-user pacing and a quota dashboard. Flag for Phase 2 ops.
- **Privacy / GDPR posture**: the user's mail bodies live in our SQLite. Data-deletion path: account deletion cascades to mailboxes → messages → attachments → connections. Verify cascade chains in the migration.

## 14. Self-review

Quick check before handoff:

- **Placeholders**: none ("TBD", "TODO", or vague requirements left).
- **Internal consistency**: the architecture in §3 matches the data model in §5 and the sync worker in §6. Send flow (§7) consistent with the deferred MX-delivery work in §12.
- **Scope check**: v1 (§4) is a coherent product. Each item in "in scope" produces user-visible behavior. "Out of scope" items are genuinely deferrable.
- **Ambiguity check**: §10 makes the username regex and reserved-names list explicit; §6 makes cursor handling explicit; §7 makes the `From` rewrite policy explicit. No leftover handwaving on auth or scope.
