# Outlook Inbound Pipeline (Slice 2) — Design Spec

## 1. Goal

Let a ZeroSpam user connect their existing Outlook / Microsoft account via OAuth so
that new mail is pulled into ZeroSpam through Microsoft Graph and filtered by the
existing quarantine-by-default policy. This is the second provider slice of the
aggregator, reusing the provider-agnostic machinery shipped in
[2026-06-08-gmail-inbound-pipeline-design.md](2026-06-08-gmail-inbound-pipeline-design.md):
Outlook only, inbound only, forward-only.

Success criterion: a user clicks "Connect Outlook", grants consent, and within one
poll interval new mail arriving at their Outlook address appears in ZeroSpam —
whitelisted senders in inbox, everyone else in quarantine — with no change to the
downstream pipeline.

## 2. Scope

### In scope
- A `GraphConnector` implementing the existing `ProviderConnector` interface.
- A real Microsoft Graph adapter using the official SDKs.
- Outlook OAuth routes: `GET /api/oauth/outlook/start` and `/callback`.
- A poller change to select the connector per `connections.provider`.
- "Connect Outlook" in the existing Connections UI.
- Config/env for Microsoft credentials.

### Out of scope (unchanged from slice 1)
- Send / reply `From`-rewrite, history backfill, push notifications (Graph change
  subscriptions), two-way sync, cross-mailbox whitelist, Yahoo/AOL.

## 3. Key decisions (locked in brainstorming)

1. **Official Microsoft SDKs**: `@azure/msal-node` for OAuth (auth-code exchange +
   silent refresh) and `@microsoft/microsoft-graph-client` for API calls.
2. **Authority `common`** (`AzureADandPersonalMicrosoftAccount`): both personal
   Outlook.com/Hotmail/Live and work/school Microsoft 365 accounts can connect.
3. **Reuse the Gmail credential approach**: build the real OAuth flow, unit/
   integration-test against a stubbed Graph client; the operator supplies
   `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` (Azure app registration) later.
4. **Forward-only initial sync**: on connect, drain the initial Graph delta pages
   without ingesting, keeping only the final `@odata.deltaLink` token as the seed
   cursor; only mail arriving after connect is ingested.
5. **msal token cache stored as the credential blob**: `refresh_enc` holds msal's
   serialized token cache (a string), keeping the existing `OAuthTokens` shape and
   the repo/poller unchanged.

## 4. Reused as-is (already provider-agnostic from slice 1)

- `connections` table — `provider` already `CHECK(provider IN ('gmail','outlook'))`.
- `connection-crypto.ts` token vault (AES-256-GCM) and `loadConnectionSecret()`.
- `oauth-state.ts` (HMAC signed `state`).
- `connections-repo.ts` — `upsertConnection`, `getDecryptedTokens`, `persistTokens`,
  `listConnectionsForAccount`, `recordPollSuccess/Failure`, `markNeedsReconnect`,
  `deleteConnection`.
- `routes/connections.ts` — `GET /api/connections`, `DELETE /api/connections/:id`.
- `connectors/types.ts` — `ProviderConnector`, `OAuthTokens`, `FetchedMessage`,
  `OAuthExchanger`.
- `ingest()`, whitelist/quarantine, sweeper, digest, FTS, attachments — untouched.
- Web `Connection` type and the list/disconnect/reconnect UI.

## 5. Architecture overview

```
Outlook --OAuth(msal)--> oauth-outlook routes --writes--> connections + mailbox row
   ^                                                            |
   |                                                            v
   +--<-- Graph (messages/delta, messages/{id}/$value) --------+
                          |
                connection-poller.tick()  (selects connector by provider)
                          |
                          v
                 ingest(raw, outlookAddress)   <-- existing pipeline, untouched
                          |
                  inbox  /  quarantine
```

A connected Outlook account becomes a `mailbox` row at the connected address with
`provider='outlook'`, sharing the user's `account_id` — exactly like Gmail. The
poller calls `ingest(raw, '<address>')` and existing routing applies.

## 6. New / changed components

### 6.1 `connectors/graph.ts` — `GraphConnector`

Implements `ProviderConnector`, mirroring `GmailConnector`. Constructor takes an
injectable `apiFor: (tokens) => GraphApi` factory and an `OAuthExchanger`.

```ts
export interface GraphApi {
  getProfile(): Promise<{ email: string }>;          // GET /me
  seedCursor(): Promise<string>;                      // drain initial delta → deltaToken
  listDelta(cursor: string): Promise<{ addedMessageIds: string[]; nextCursor: string }>;
  getRawMessage(id: string): Promise<Buffer>;         // GET /messages/{id}/$value
}
```

- `verifyIdentity(tokens)` → `{ email: profile.email.toLowerCase(), cursor: await seedCursor() }`.
- `ensureFresh(tokens, now)` → refresh via the exchanger when within the 2-minute
  skew (same constant as Gmail), else return as-is.
- `fetchSince(tokens, cursor)` → `listDelta(cursor)`, fetch each added message's raw
  MIME, return `{ messages, nextCursor }`.

A `GraphApi` is a small interface so tests pass a stub (no network).

### 6.2 `connectors/graph-ms.ts` — real adapter

- **Auth** (`msExchanger: OAuthExchanger`): a `ConfidentialClientApplication`
  (authority `https://login.microsoftonline.com/${MICROSOFT_TENANT}`, default
  `common`; client id/secret from config).
  - `authUrl(state)` → `getAuthCodeUrl({ scopes: GRAPH_SCOPES, redirectUri, state })`.
  - `exchangeCode(code)` → `acquireTokenByCode({ code, scopes, redirectUri })`;
    returns `{ accessToken, refreshToken: cca.getTokenCache().serialize(), expiresAt:
    result.expiresOn.getTime() }`.
  - `refresh(serializedCache)` → new CCA, `getTokenCache().deserialize(serializedCache)`,
    `acquireTokenSilent({ account, scopes })`; returns the new access token + re-
    serialized cache + expiry.
  - `GRAPH_SCOPES = ['Mail.Read', 'offline_access', 'openid', 'profile', 'email', 'User.Read']`.
- **API** (`graphApiFor(tokens)`): a `@microsoft/microsoft-graph-client` `Client`
  with an auth provider returning `tokens.accessToken`.
  - `getProfile` → `GET /me` (`mail ?? userPrincipalName`).
  - `seedCursor` → page `GET /me/mailFolders/inbox/messages/delta?$select=id`
    following `@odata.nextLink`, discarding items, until `@odata.deltaLink`; return
    its `$deltatoken`.
  - `listDelta(cursor)` → resume from the stored delta token, collecting added
    message ids (skip `@removed`), following `nextLink`; return ids + the new delta
    token.
  - `getRawMessage(id)` → `GET /me/messages/{id}/$value` → `Buffer` of the MIME.

### 6.3 Poller registry (the one shared change)

`connection-poller.ts` `tick` currently takes a single optional `connector` and uses
it for every row. Change to a registry:

```ts
type ConnectorRegistry = Partial<Record<'gmail' | 'outlook', ProviderConnector>>;
export async function tick(opts: { connectors?: ConnectorRegistry; now: number }) { ... }
```

Default registry builds both real connectors (`GmailConnector`, `GraphConnector`).
Per row, select `registry[conn.provider]`; if absent, `markNeedsReconnect` with a
clear message and continue. `startConnectionPoller` passes no registry (uses
default). All existing Gmail behaviour is preserved.

### 6.4 `routes/oauth-outlook.ts`

Mirrors `routes/oauth-gmail.ts`:
- `GET /api/oauth/outlook/start` (authenticated): 503 if Microsoft creds unset;
  else redirect to the consent URL with a signed `state` (reusing `oauth-state`).
- `GET /api/oauth/outlook/callback` (public via `PUBLIC_PREFIXES`; the signed
  `state` is the auth proof): validate state, exchange code, `verifyIdentity`,
  find-or-create the `mailbox` (`provider='outlook'`) and `upsertConnection`,
  redirect to `/?connected=outlook`.
- `__setOutlookOAuthDeps({ exchanger, apiFor })` test seam.
- `'/api/oauth/outlook/callback'` added to `PUBLIC_PREFIXES`; `start` stays behind auth.

### 6.5 Config / env

| Var | Default | Purpose |
|---|---|---|
| `MICROSOFT_CLIENT_ID` | `''` | Azure app (client) id |
| `MICROSOFT_CLIENT_SECRET` | `''` | Azure app client secret |
| `MICROSOFT_TENANT` | `common` | authority segment |

Redirect URI: `${PUBLIC_BASE_URL}/api/oauth/outlook/callback` via `outlookRedirectUri()`.

### 6.6 UI

Add a "Connect Outlook" button (→ `/api/oauth/outlook/start`) and an Outlook icon to
`ConnectionsPanel`. List rows already render provider + status + disconnect/reconnect
generically; `reconnect` for an `outlook` row points at the Outlook start route.

## 7. Test strategy (vitest, mirrors slice 1)

- **GraphConnector** (stubbed `GraphApi`): `verifyIdentity` returns email + seed
  cursor; `fetchSince` collects added ids → raw buffers, advances the delta cursor;
  `ensureFresh` refreshes only within the skew.
- **OAuth callback** (mocked exchanger + apiFor): creates an outlook mailbox +
  active connection, seeds the cursor; invalid `state` → 400; missing creds on
  `/start` → 503.
- **Poller registry**: one tick with a `gmail` row and an `outlook` row routes each
  to its stub connector; an unknown/absent provider connector → `needs_reconnect`.
- **End-to-end** (stub Graph feeding mixed senders into a seeded account): whitelisted
  sender → inbox, others → quarantine.

## 8. Risks / open items

- **Forward-only seed cost**: draining the initial delta pages for a large mailbox is
  a one-time cost at connect. Acceptable for v1; documented.
- **msal cache shape**: storing the serialized token cache in `refresh_enc` is a
  per-connector interpretation, not a schema change. If a future provider needs a
  richer credential, generalize the vault then (not now).
- **Refresh-token lifetime**: Microsoft refresh tokens (via the cache) are long-lived
  for `common`; on `acquireTokenSilent` failure the connection is marked
  `needs_reconnect` (same path as Gmail auth failure).
- **Graph throttling (429)**: at low scale irrelevant; the poller's existing
  exponential backoff covers transient 429/5xx. Per-user pacing is a later-scale item.

## 9. Self-review

- **Placeholders**: none.
- **Consistency**: §6 components match the reused interfaces in §4 and the poller
  registry change is the only edit to shared code; scope (§2) matches decisions (§3).
- **Scope**: one provider, inbound only, forward-only — a single implementation plan.
- **Ambiguity**: token-cache storage, forward-only seeding, authority/scopes, and
  the poller's per-provider selection are all made explicit.
