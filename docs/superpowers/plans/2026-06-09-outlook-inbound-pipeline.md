# Outlook Inbound Pipeline (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user connect their Outlook/Microsoft account via OAuth so new mail is pulled through Microsoft Graph into the existing quarantine-by-default pipeline.

**Architecture:** Add a `GraphConnector` implementing the existing `ProviderConnector` interface, backed by a Microsoft Graph adapter (`@azure/msal-node` for OAuth, `@microsoft/microsoft-graph-client` for API). The poller is changed from a single connector to a per-provider registry. OAuth `start`/`callback` routes mirror the Gmail ones. Everything else (connections table, token vault, oauth-state, repo, connections API, UI shell) is reused unchanged. Outlook only, inbound only, forward-only.

**Tech Stack:** TypeScript on Node ≥20, ESM, Fastify, `better-sqlite3`-style `node:sqlite` via `db.ts`, vitest. New deps: `@azure/msal-node`, `@microsoft/microsoft-graph-client`. Web is React + Vite.

---

## Reference Documents

- Spec: [docs/superpowers/specs/2026-06-09-outlook-inbound-pipeline-design.md](../specs/2026-06-09-outlook-inbound-pipeline-design.md)
- Slice 1 (Gmail) — the pattern this mirrors: [docs/superpowers/specs/2026-06-08-gmail-inbound-pipeline-design.md](../specs/2026-06-08-gmail-inbound-pipeline-design.md)
- Existing files this slice builds on:
  - `server/src/connectors/types.ts` — `ProviderConnector`, `OAuthTokens`, `FetchedMessage`, `OAuthExchanger`, `GmailApi`
  - `server/src/connectors/gmail.ts`, `gmail-google.ts` — the connector pattern to mirror
  - `server/src/connection-poller.ts` — single-connector tick (to be made a registry)
  - `server/src/routes/oauth-gmail.ts` — OAuth route pattern to mirror
  - `server/src/connections-repo.ts` — `upsertConnection` etc. (reused)
  - `server/src/config.ts` — `loadConnectionSecret`, `gmailRedirectUri`, `config.google` (mirror for Microsoft)
  - `server/src/api.ts` — route registration + `PUBLIC_PREFIXES` + inject-auth seam
  - `web/src/api.ts`, `web/src/components/ConnectionsPanel.tsx` — UI to extend

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `server/package.json` | Modify | Add `@azure/msal-node`, `@microsoft/microsoft-graph-client` |
| `server/src/config.ts` | Modify | `config.microsoft`, `outlookRedirectUri()` |
| `server/src/connectors/types.ts` | Modify | Add `GraphApi` interface |
| `server/src/connectors/graph.ts` | Create | `GraphConnector` (injectable api factory + exchanger) |
| `server/src/connectors/graph-ms.ts` | Create | Real msal + graph-client adapter |
| `server/src/connection-poller.ts` | Modify | Per-provider connector registry |
| `server/src/routes/oauth-outlook.ts` | Create | `GET /api/oauth/outlook/start` + `/callback` |
| `server/src/api.ts` | Modify | Register route + add callback to `PUBLIC_PREFIXES` |
| `web/src/api.ts` | Modify | `outlookConnectUrl()` |
| `web/src/components/ConnectionsPanel.tsx` | Modify | "Connect Outlook" button + provider-aware reconnect |
| `server/test/outlook-config.test.ts` | Create | `outlookRedirectUri` |
| `server/test/graph-connector.test.ts` | Create | `GraphConnector` against a stub |
| `server/test/connection-poller.test.ts` | Modify | New registry signature + multi-provider routing |
| `server/test/oauth-outlook-routes.test.ts` | Create | OAuth callback creates outlook mailbox + connection |
| `web/src/components/__tests__/ConnectionsPanel.test.tsx` | Modify | Mock `outlookConnectUrl` + assert button |

---

## Task 0: Dependencies + Microsoft config

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/config.ts`
- Create: `server/test/outlook-config.test.ts`

- [ ] **Step 0.1: Install the Microsoft SDKs**

Run:
```bash
npm install --workspace=server @azure/msal-node @microsoft/microsoft-graph-client
```
Expected: both appear under `dependencies` in `server/package.json`.

- [ ] **Step 0.2: Write the failing config test**

`server/test/outlook-config.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { config, outlookRedirectUri } from '../src/config.js';

describe('outlookRedirectUri', () => {
  const orig = config.publicBaseUrl;
  afterEach(() => {
    (config as any).publicBaseUrl = orig;
  });

  it('builds the callback URL from publicBaseUrl', () => {
    (config as any).publicBaseUrl = 'https://mail.example.com';
    expect(outlookRedirectUri()).toBe('https://mail.example.com/api/oauth/outlook/callback');
  });

  it('throws when publicBaseUrl is empty', () => {
    (config as any).publicBaseUrl = '';
    expect(() => outlookRedirectUri()).toThrow(/PUBLIC_BASE_URL/);
  });
});
```

NOTE: `config` is declared `as const`; the casts `(config as any)` are test-only mutation to exercise both branches. If `config.publicBaseUrl` cannot be reassigned at runtime (frozen), instead set `process.env.PUBLIC_BASE_URL` is NOT enough because `config` is computed once at import — in that case drop the mutation tests and keep only a single assertion that `outlookRedirectUri()` returns `${config.publicBaseUrl}/api/oauth/outlook/callback` when `publicBaseUrl` is truthy, and skip the throw test. Prefer the mutation form; only fall back if it errors.

- [ ] **Step 0.3: Run; expect FAIL**

Run: `npm test --workspace=server -- outlook-config`
Expected: FAIL — `outlookRedirectUri` is not exported.

- [ ] **Step 0.4: Add Microsoft config + helper to `server/src/config.ts`**

Add these fields inside the `config` object literal, next to the existing `google: {...}` block:
```ts
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
    tenant: process.env.MICROSOFT_TENANT ?? 'common',
  },
```

Add this exported function next to the existing `gmailRedirectUri()`:
```ts
// Absolute redirect URI Microsoft calls back. Requires PUBLIC_BASE_URL.
export function outlookRedirectUri(): string {
  if (!config.publicBaseUrl) throw new Error('PUBLIC_BASE_URL is unset; cannot build OAuth redirect URI');
  return `${config.publicBaseUrl}/api/oauth/outlook/callback`;
}
```

- [ ] **Step 0.5: Run; expect PASS**

Run: `npm test --workspace=server -- outlook-config`
Expected: 2 passed (or 1 if you fell back per the note).

- [ ] **Step 0.6: Add placeholders to `server/.env` and (committed) `server/.env.example`**

Append to `server/.env.example`:
```
# Outlook inbound pipeline (slice 2). Azure app registration (authority: common).
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT=common
```
(If `server/.env` exists locally, append the same three lines so dev picks them up. `.env` is gitignored — do not `git add` it.)

- [ ] **Step 0.7: Commit**

```bash
git add server/package.json package-lock.json server/src/config.ts server/test/outlook-config.test.ts server/.env.example
git commit -m "feat(outlook): MS Graph deps + Microsoft OAuth config"
```
End the commit message body with:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

## Task 1: `GraphApi` type + `GraphConnector` (TDD)

**Files:**
- Modify: `server/src/connectors/types.ts`
- Create: `server/src/connectors/graph.ts`
- Create: `server/test/graph-connector.test.ts`

- [ ] **Step 1.1: Add the `GraphApi` interface to `server/src/connectors/types.ts`**

Append (after the `GmailApi` interface):
```ts
// Minimal Microsoft Graph surface the connector calls. The real impl wraps
// @microsoft/microsoft-graph-client; tests pass a stub.
export interface GraphApi {
  getProfile(): Promise<{ email: string }>;            // GET /me
  seedCursor(): Promise<string>;                        // drain initial delta -> deltaLink token
  listDelta(cursor: string): Promise<{ addedMessageIds: string[]; nextCursor: string }>;
  getRawMessage(id: string): Promise<Buffer>;           // GET /messages/{id}/$value
}
```

- [ ] **Step 1.2: Write the failing test**

`server/test/graph-connector.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { GraphConnector } from '../src/connectors/graph.js';
import type { GraphApi, OAuthExchanger, OAuthTokens } from '../src/connectors/types.js';

const tokens: OAuthTokens = { accessToken: 'a', refreshToken: 'cache', expiresAt: Date.now() + 3600_000 };

function stubApi(over: Partial<GraphApi> = {}): GraphApi {
  return {
    getProfile: vi.fn(async () => ({ email: 'alice@outlook.com' })),
    seedCursor: vi.fn(async () => 'delta-TOKEN-0'),
    listDelta: vi.fn(async () => ({ addedMessageIds: ['m1', 'm2'], nextCursor: 'delta-TOKEN-1' })),
    getRawMessage: vi.fn(async (id: string) => Buffer.from(`raw-${id}`)),
    ...over,
  };
}

function stubExchanger(over: Partial<OAuthExchanger> = {}): OAuthExchanger {
  return {
    exchangeCode: vi.fn(async () => tokens),
    refresh: vi.fn(async () => ({ ...tokens, accessToken: 'fresh', expiresAt: Date.now() + 3600_000 })),
    authUrl: vi.fn((state: string) => `https://login.microsoftonline.com/common?state=${state}`),
    ...over,
  };
}

describe('GraphConnector', () => {
  it('verifyIdentity returns lowercased email and a seed cursor', async () => {
    const c = new GraphConnector(() => stubApi({ getProfile: vi.fn(async () => ({ email: 'Alice@Outlook.com' })) }), stubExchanger());
    expect(await c.verifyIdentity(tokens)).toEqual({ email: 'alice@outlook.com', cursor: 'delta-TOKEN-0' });
  });

  it('fetchSince collects added messages as raw buffers and advances the delta cursor', async () => {
    const c = new GraphConnector(() => stubApi(), stubExchanger());
    const r = await c.fetchSince(tokens, 'delta-TOKEN-0');
    expect(r.messages.map((m) => m.providerMsgId)).toEqual(['m1', 'm2']);
    expect(r.messages[0].raw.toString()).toBe('raw-m1');
    expect(r.nextCursor).toBe('delta-TOKEN-1');
  });

  it('ensureFresh refreshes when near expiry', async () => {
    const ex = stubExchanger();
    const c = new GraphConnector(() => stubApi(), ex);
    const out = await c.ensureFresh({ ...tokens, expiresAt: Date.now() + 30_000 }, Date.now());
    expect(ex.refresh).toHaveBeenCalledOnce();
    expect(out.accessToken).toBe('fresh');
  });

  it('ensureFresh does NOT refresh with comfortable life left', async () => {
    const ex = stubExchanger();
    const c = new GraphConnector(() => stubApi(), ex);
    const out = await c.ensureFresh(tokens, Date.now());
    expect(ex.refresh).not.toHaveBeenCalled();
    expect(out.accessToken).toBe('a');
  });
});
```

- [ ] **Step 1.3: Run; expect FAIL**

Run: `npm test --workspace=server -- graph-connector`
Expected: FAIL — `Cannot find module '../src/connectors/graph.js'`.

- [ ] **Step 1.4: Implement `server/src/connectors/graph.ts`**

```ts
import type {
  GraphApi,
  OAuthExchanger,
  OAuthTokens,
  ProviderConnector,
  FetchedMessage,
} from './types.js';

const REFRESH_SKEW_MS = 2 * 60 * 1000; // refresh if < 2 min of life left

export class GraphConnector implements ProviderConnector {
  readonly provider = 'outlook' as const;

  constructor(
    private readonly apiFor: (tokens: OAuthTokens) => GraphApi,
    private readonly oauth: OAuthExchanger,
  ) {}

  async verifyIdentity(tokens: OAuthTokens): Promise<{ email: string; cursor: string }> {
    const api = this.apiFor(tokens);
    const profile = await api.getProfile();
    const cursor = await api.seedCursor();
    return { email: profile.email.toLowerCase(), cursor };
  }

  async ensureFresh(tokens: OAuthTokens, now: number): Promise<OAuthTokens> {
    if (tokens.expiresAt - now > REFRESH_SKEW_MS) return tokens;
    return this.oauth.refresh(tokens.refreshToken);
  }

  async fetchSince(
    tokens: OAuthTokens,
    cursor: string,
  ): Promise<{ messages: FetchedMessage[]; nextCursor: string }> {
    const api = this.apiFor(tokens);
    const { addedMessageIds, nextCursor } = await api.listDelta(cursor);
    const messages: FetchedMessage[] = [];
    for (const id of addedMessageIds) {
      messages.push({ providerMsgId: id, raw: await api.getRawMessage(id) });
    }
    return { messages, nextCursor };
  }
}
```

- [ ] **Step 1.5: Run; expect PASS**

Run: `npm test --workspace=server -- graph-connector`
Expected: 4 passed.

- [ ] **Step 1.6: Commit**

```bash
git add server/src/connectors/types.ts server/src/connectors/graph.ts server/test/graph-connector.test.ts
git commit -m "feat(outlook): GraphApi type + GraphConnector (stub-injectable)"
```
End the commit body with the Co-Authored-By trailer (as in Task 0).

---

## Task 2: Real Microsoft Graph adapter (`graph-ms.ts`)

No unit test — like `gmail-google.ts`, it only wraps SDKs and is verified by `tsc`. All logic lives in `GraphConnector` (tested).

**Files:**
- Create: `server/src/connectors/graph-ms.ts`

- [ ] **Step 2.1: Implement `server/src/connectors/graph-ms.ts`**

```ts
// Real @azure/msal-node + @microsoft/microsoft-graph-client adapter for GraphConnector.
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import type { GraphApi, OAuthExchanger, OAuthTokens } from './types.js';
import { config, outlookRedirectUri } from '../config.js';

const GRAPH_SCOPES = ['Mail.Read', 'offline_access', 'openid', 'profile', 'email', 'User.Read'];
const DELTA_PATH = '/me/mailFolders/inbox/messages/delta';

function cca(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: config.microsoft.clientId,
      clientSecret: config.microsoft.clientSecret,
      authority: `https://login.microsoftonline.com/${config.microsoft.tenant}`,
    },
  });
}

export const msExchanger: OAuthExchanger = {
  authUrl(state: string): string {
    // getAuthCodeUrl is async; callers use exchanger.authUrl synchronously in the
    // Gmail flow, so we cannot await here. Build the URL via a cached promise is
    // overkill — instead expose an async variant the route awaits. See note below.
    throw new Error('use authUrlAsync for Microsoft');
  },
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const client = cca();
    const result = await client.acquireTokenByCode({
      code,
      scopes: GRAPH_SCOPES,
      redirectUri: outlookRedirectUri(),
    });
    if (!result) throw new Error('msal returned no result for acquireTokenByCode');
    return {
      accessToken: result.accessToken,
      refreshToken: client.getTokenCache().serialize(),
      expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600_000,
    };
  },
  async refresh(serializedCache: string): Promise<OAuthTokens> {
    const client = cca();
    client.getTokenCache().deserialize(serializedCache);
    const accounts = await client.getTokenCache().getAllAccounts();
    const account = accounts[0];
    if (!account) {
      const e: any = new Error('no cached account for silent refresh');
      e.authError = true;
      throw e;
    }
    const result = await client.acquireTokenSilent({ account, scopes: GRAPH_SCOPES });
    if (!result) {
      const e: any = new Error('msal acquireTokenSilent returned null');
      e.authError = true;
      throw e;
    }
    return {
      accessToken: result.accessToken,
      refreshToken: client.getTokenCache().serialize(),
      expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600_000,
    };
  },
};

// Microsoft's auth URL is async; the route awaits this instead of the sync authUrl.
export async function outlookAuthUrl(state: string): Promise<string> {
  return cca().getAuthCodeUrl({ scopes: GRAPH_SCOPES, redirectUri: outlookRedirectUri(), state });
}

function clientFor(accessToken: string): Client {
  return Client.init({ authProvider: (done) => done(null, accessToken) });
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function deltaTokenFromLink(link: string | undefined): string {
  if (!link) return '';
  // deltaLink looks like ".../delta?$deltatoken=XYZ"; store the full URL as the cursor.
  return link;
}

export function graphApiFor(tokens: OAuthTokens): GraphApi {
  const client = clientFor(tokens.accessToken);
  return {
    async getProfile() {
      const me = await client.api('/me').select(['mail', 'userPrincipalName']).get();
      return { email: (me.mail ?? me.userPrincipalName ?? '') as string };
    },
    async seedCursor() {
      // Drain the initial delta WITHOUT ingesting; keep only the final deltaLink.
      let res = await client.api(DELTA_PATH).select('id').get();
      while (res['@odata.nextLink']) {
        res = await client.api(res['@odata.nextLink'] as string).get();
      }
      return deltaTokenFromLink(res['@odata.deltaLink'] as string | undefined);
    },
    async listDelta(cursor: string) {
      const added: string[] = [];
      let res = await client.api(cursor || DELTA_PATH).get();
      const collect = (r: any) => {
        for (const m of (r.value ?? []) as any[]) {
          if (m['@removed']) continue;
          if (m.id) added.push(m.id as string);
        }
      };
      collect(res);
      while (res['@odata.nextLink']) {
        res = await client.api(res['@odata.nextLink'] as string).get();
        collect(res);
      }
      return { addedMessageIds: [...new Set(added)], nextCursor: deltaTokenFromLink(res['@odata.deltaLink'] as string | undefined) || cursor };
    },
    async getRawMessage(id: string) {
      const stream = (await client.api(`/me/messages/${id}/$value`).getStream()) as NodeJS.ReadableStream;
      return streamToBuffer(stream);
    },
  };
}
```

NOTE on `authUrl`: the `OAuthExchanger` interface declares a synchronous `authUrl`, but msal's `getAuthCodeUrl` is async. The Outlook route (Task 3) awaits `outlookAuthUrl(state)` directly instead of calling `exchanger.authUrl`. The sync `authUrl` on `msExchanger` throws to make misuse obvious. `GraphConnector` never calls `authUrl` (only the route does), so this does not affect the connector.

- [ ] **Step 2.2: Type-check**

Run: `npm run build --workspace=server`
Expected: exit 0. If the Graph SDK types reject `.select('id')` (string vs string[]), `.getStream()` return type, or `done` callback typing, fix minimally (e.g. `.select(['id'])`, cast the stream, type `done` params) while preserving behavior. If a type problem can't be resolved without behavior change, STOP and report BLOCKED with the exact tsc error.

- [ ] **Step 2.3: Commit**

```bash
git add server/src/connectors/graph-ms.ts
git commit -m "feat(outlook): real Microsoft Graph adapter (msal + graph-client)"
```
End the commit body with the Co-Authored-By trailer.

---

## Task 3: Poller connector registry (TDD)

**Files:**
- Modify: `server/src/connection-poller.ts`
- Modify: `server/test/connection-poller.test.ts`

- [ ] **Step 3.1: Update the existing test calls + add a multi-provider test**

In `server/test/connection-poller.test.ts`:

First, change EVERY existing `tick({ connector: X, now: N })` call to `tick({ connectors: { gmail: X }, now: N })`. There are five such calls (the ingest/cursor test, the auth-failure test, the transient-failure test, the not-due test, and the needs_reconnect test). The existing connections in those tests are all `gmail`, so routing them via `{ gmail: ... }` preserves behavior.

Then append a new test that exercises per-provider routing and the absent-connector branch. Add these imports at the top if not present: `import { seedMailbox, seedConnection } from './helpers.js';` (already present) and reuse the existing `acct`, `fakeConnector`, `rawFrom` helpers in the file.

```ts
describe('connection-poller registry', () => {
  it('routes each connection to its provider connector', async () => {
    const gmb = seedMailbox('alice@gmail.com');
    const omb = seedMailbox('bob@outlook.com');
    const gid = upsertConnection({
      accountId: acct(gmb), mailboxId: gmb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: 'g0',
    });
    const oid = upsertConnection({
      accountId: acct(omb), mailboxId: omb, provider: 'outlook',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: 'o0',
    });

    const gmail = fakeConnector(); // provider 'gmail' in helper; cursor -> '200'
    const outlook = {
      provider: 'outlook' as const,
      verifyIdentity: vi.fn(async () => ({ email: 'bob@outlook.com', cursor: 'o0' })),
      ensureFresh: vi.fn(async (t: any) => t),
      fetchSince: vi.fn(async () => ({
        messages: [{ providerMsgId: 'om1', raw: rawFrom('news@beta.io', 'bob@outlook.com') }],
        nextCursor: 'o9',
      })),
    };

    await tick({ connectors: { gmail, outlook }, now: 5_000_000 });

    expect(gmail.fetchSince).toHaveBeenCalled();
    expect(outlook.fetchSince).toHaveBeenCalled();
    expect((db.prepare('SELECT cursor FROM connections WHERE id = ?').get(gid) as any).cursor).toBe('200');
    expect((db.prepare('SELECT cursor FROM connections WHERE id = ?').get(oid) as any).cursor).toBe('o9');
  });

  it('marks a connection needs_reconnect when no connector is registered for its provider', async () => {
    const omb = seedMailbox('bob@outlook.com');
    const oid = upsertConnection({
      accountId: acct(omb), mailboxId: omb, provider: 'outlook',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: 'o0',
    });
    await tick({ connectors: { gmail: fakeConnector() }, now: 6_000_000 }); // no outlook connector
    expect((db.prepare('SELECT status FROM connections WHERE id = ?').get(oid) as any).status).toBe('needs_reconnect');
  });
});
```

- [ ] **Step 3.2: Run; expect FAIL**

Run: `npm test --workspace=server -- connection-poller`
Expected: FAIL — `tick` does not accept `connectors` yet (type error / undefined behavior).

- [ ] **Step 3.3: Rewrite `tick` in `server/src/connection-poller.ts` to use a registry**

Add the import for the Graph connector near the Gmail import:
```ts
import { GmailConnector } from './connectors/gmail.js';
import { googleApiFor, googleExchanger } from './connectors/gmail-google.js';
import { GraphConnector } from './connectors/graph.js';
import { graphApiFor, msExchanger } from './connectors/graph-ms.js';
```

Replace the `tick` function signature and connector resolution. Change:
```ts
export async function tick(opts: { connector?: ProviderConnector; now: number }): Promise<void> {
  const connector = opts.connector ?? new GmailConnector(googleApiFor, googleExchanger);
  const now = opts.now;
```
to:
```ts
type ConnectorRegistry = Partial<Record<'gmail' | 'outlook', ProviderConnector>>;

function defaultRegistry(): ConnectorRegistry {
  return {
    gmail: new GmailConnector(googleApiFor, googleExchanger),
    outlook: new GraphConnector(graphApiFor, msExchanger),
  };
}

export async function tick(opts: { connectors?: ConnectorRegistry; now: number }): Promise<void> {
  const registry = opts.connectors ?? defaultRegistry();
  const now = opts.now;
```

Then, inside the `for (const conn of rows)` loop, AFTER the `mailbox` lookup and its `if (!mailbox) continue;`, add the per-connection connector selection:
```ts
    const connector = registry[conn.provider];
    if (!connector) {
      markNeedsReconnect(conn.id, `no connector registered for provider ${conn.provider}`);
      continue;
    }
```
The rest of the loop body (`getDecryptedTokens` → `ensureFresh` → `fetchSince` → `ingest` → `recordPollSuccess`, and the catch) is unchanged and now uses this per-connection `connector`.

`startConnectionPoller` is unchanged (it calls `tick({ now: Date.now() })`, which now uses `defaultRegistry()`).

- [ ] **Step 3.4: Run; expect PASS**

Run: `npm test --workspace=server -- connection-poller`
Expected: all pass (the five migrated gmail tests + 2 new registry tests).

- [ ] **Step 3.5: Commit**

```bash
git add server/src/connection-poller.ts server/test/connection-poller.test.ts
git commit -m "feat(outlook): per-provider connector registry in the poller"
```
End the commit body with the Co-Authored-By trailer.

---

## Task 4: Outlook OAuth routes (TDD)

**Files:**
- Create: `server/src/routes/oauth-outlook.ts`
- Modify: `server/src/api.ts`
- Create: `server/test/oauth-outlook-routes.test.ts`

- [ ] **Step 4.1: Write the failing test**

`server/test/oauth-outlook-routes.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { startApi } from '../src/api.js';
import { __setOutlookOAuthDeps } from '../src/routes/oauth-outlook.js';
import { signState } from '../src/oauth-state.js';
import { config } from '../src/config.js';
import { db } from '../src/db.js';
import { seedMailbox } from './helpers.js';
import type { FastifyInstance } from 'fastify';

function seedUser(): { userId: number; accountId: number } {
  seedMailbox('owner@zero-spam.email'); // ensures account 1 + domain exist
  return { userId: 1, accountId: 1 };
}

let app: FastifyInstance;
beforeEach(async () => {
  __setOutlookOAuthDeps({
    authUrl: async (state) => `https://login.microsoftonline.com/common/authorize?state=${state}`,
    exchanger: {
      authUrl: () => { throw new Error('use authUrlAsync'); },
      exchangeCode: async () => ({ accessToken: 'A', refreshToken: 'CACHE', expiresAt: Date.now() + 3600_000 }),
      refresh: async () => ({ accessToken: 'A', refreshToken: 'CACHE', expiresAt: Date.now() + 3600_000 }),
    },
    apiFor: () => ({
      getProfile: async () => ({ email: 'alice@outlook.com' }),
      seedCursor: async () => 'delta-0',
      listDelta: async () => ({ addedMessageIds: [], nextCursor: 'delta-0' }),
      getRawMessage: async () => Buffer.from(''),
    }),
  });
  app = await startApi({ inject: true });
});

describe('outlook oauth callback', () => {
  it('creates an outlook mailbox + active connection from a valid callback', async () => {
    const { userId, accountId } = seedUser();
    const state = signState({ v: 1, userId, accountId, exp: Date.now() + 600_000 }, config.sessionSecret);
    const res = await app.inject({
      method: 'GET',
      url: `/api/oauth/outlook/callback?code=xyz&state=${encodeURIComponent(state)}`,
    });
    expect(res.statusCode).toBe(302);

    const mb = db.prepare("SELECT * FROM mailboxes WHERE address = 'alice@outlook.com'").get() as any;
    expect(mb.provider).toBe('outlook');
    expect(mb.account_id).toBe(accountId);
    const conn = db.prepare('SELECT * FROM connections WHERE mailbox_id = ?').get(mb.id) as any;
    expect(conn.status).toBe('active');
    expect(conn.cursor).toBe('delta-0');
  });

  it('rejects a tampered state', async () => {
    seedUser();
    const res = await app.inject({ method: 'GET', url: `/api/oauth/outlook/callback?code=xyz&state=bad` });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 4.2: Run; expect FAIL**

Run: `npm test --workspace=server -- oauth-outlook-routes`
Expected: FAIL — `Cannot find module '../src/routes/oauth-outlook.js'`.

- [ ] **Step 4.3: Implement `server/src/routes/oauth-outlook.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { db, runInTx } from '../db.js';
import { config } from '../config.js';
import { signState, verifyState } from '../oauth-state.js';
import { GraphConnector } from '../connectors/graph.js';
import { graphApiFor, msExchanger, outlookAuthUrl } from '../connectors/graph-ms.js';
import { upsertConnection } from '../connections-repo.js';
import type { GraphApi, OAuthExchanger, OAuthTokens } from '../connectors/types.js';

// Swappable deps for tests (no network).
let exchanger: OAuthExchanger = msExchanger;
let apiFor: (t: OAuthTokens) => GraphApi = graphApiFor;
let authUrl: (state: string) => Promise<string> = outlookAuthUrl;
export function __setOutlookOAuthDeps(deps: {
  exchanger?: OAuthExchanger;
  apiFor?: (t: OAuthTokens) => GraphApi;
  authUrl?: (state: string) => Promise<string>;
}): void {
  if (deps.exchanger) exchanger = deps.exchanger;
  if (deps.apiFor) apiFor = deps.apiFor;
  if (deps.authUrl) authUrl = deps.authUrl;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export async function outlookOAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/oauth/outlook/start', async (req, reply) => {
    const account = (req as any).account;
    const user = (req as any).user;
    if (!account?.id || !user?.id) return reply.code(401).send({ error: 'unauthorized' });
    if (!config.microsoft.clientId || !config.microsoft.clientSecret) {
      return reply.code(503).send({ error: 'Outlook connect unavailable: MICROSOFT_CLIENT_ID/SECRET not configured' });
    }
    const state = signState(
      { v: 1, userId: user.id, accountId: account.id, exp: Date.now() + STATE_TTL_MS },
      config.sessionSecret,
    );
    return reply.redirect(await authUrl(state));
  });

  // Public via PUBLIC_PREFIXES; the signed state token is the auth proof.
  app.get('/api/oauth/outlook/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return reply.code(400).send({ error: 'missing code/state' });
    const payload = verifyState(state, config.sessionSecret, Date.now());
    if (!payload) return reply.code(400).send({ error: 'invalid or expired state' });

    let tokens: OAuthTokens;
    let identity: { email: string; cursor: string };
    try {
      const connector = new GraphConnector(apiFor, exchanger);
      tokens = await exchanger.exchangeCode(code);
      identity = await connector.verifyIdentity(tokens);
    } catch (e: any) {
      app.log.error({ err: e }, 'outlook oauth callback failed');
      return reply.code(502).send({ error: 'oauth exchange failed' });
    }

    runInTx(() => {
      let mb = db.prepare('SELECT id FROM mailboxes WHERE address = ?').get(identity.email) as { id: number } | undefined;
      if (!mb) {
        const domainName = identity.email.split('@')[1];
        const dom = db
          .prepare(
            `INSERT INTO domains (name, created_at, account_id) VALUES (?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET name = excluded.name RETURNING id`,
          )
          .get(domainName, Date.now(), payload.accountId) as { id: number };
        mb = db
          .prepare(
            `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, account_id, provider, created_at)
             VALUES (?, ?, ?, ?, ?, 'outlook', ?) RETURNING id`,
          )
          .get(identity.email, dom.id, null, config.quarantineTtlHours, payload.accountId, Date.now()) as { id: number };
      }
      upsertConnection({
        accountId: payload.accountId,
        mailboxId: mb.id,
        provider: 'outlook',
        tokens,
        cursor: identity.cursor,
      });
    });

    return reply.redirect(`${config.publicBaseUrl || ''}/?connected=outlook`);
  });
}
```

- [ ] **Step 4.4: Register in `server/src/api.ts`**

Add the import near the `gmailOAuthRoutes` import:
```ts
import { outlookOAuthRoutes } from './routes/oauth-outlook.js';
```
Add `'/api/oauth/outlook/callback'` to the `PUBLIC_PREFIXES` array (next to the gmail callback entry). Leave `/api/oauth/outlook/start` behind auth.
Register next to `await app.register(gmailOAuthRoutes);`:
```ts
  await app.register(outlookOAuthRoutes);
```

- [ ] **Step 4.5: Run; expect PASS**

Run: `npm test --workspace=server -- oauth-outlook-routes`
Expected: 2 passed.

- [ ] **Step 4.6: Run the full server suite (api.ts changed)**

Run: `npm test --workspace=server`
Expected: all green.

- [ ] **Step 4.7: Commit**

```bash
git add server/src/routes/oauth-outlook.ts server/src/api.ts server/test/oauth-outlook-routes.test.ts
git commit -m "feat(outlook): Outlook OAuth start + callback routes"
```
End the commit body with the Co-Authored-By trailer.

---

## Task 5: Web — Connect Outlook UI

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/components/ConnectionsPanel.tsx`
- Modify: `web/src/components/__tests__/ConnectionsPanel.test.tsx`

- [ ] **Step 5.1: Add `outlookConnectUrl` to `web/src/api.ts`**

In the `connections` group (next to `gmailConnectUrl`), add:
```ts
  outlookConnectUrl: () => '/api/oauth/outlook/start',
```

- [ ] **Step 5.2: Update the component test**

In `web/src/components/__tests__/ConnectionsPanel.test.tsx`, add `outlookConnectUrl: () => '/api/oauth/outlook/start',` to the mocked `api` object (alongside `gmailConnectUrl`). Then add a test:
```tsx
  it('shows a Connect Outlook button when empty', async () => {
    vi.mocked(api.connections).mockResolvedValue([]);
    render(<ConnectionsPanel />);
    expect(await screen.findByRole('link', { name: /connect outlook/i })).toBeInTheDocument();
  });
```
(Keep the existing "Connect Gmail" test; both buttons should be present.)

- [ ] **Step 5.3: Run; expect FAIL**

Run: `npm run test:run --workspace=web -- ConnectionsPanel`
Expected: FAIL — no "Connect Outlook" link yet (and `api.outlookConnectUrl` undefined in the mock if not added — add it per 5.2).

- [ ] **Step 5.4: Add the button + provider-aware reconnect in `web/src/components/ConnectionsPanel.tsx`**

In the header actions, next to the existing Connect Gmail anchor, add a Connect Outlook anchor:
```tsx
        <a
          href={api.outlookConnectUrl()}
          className="px-3 py-1.5 rounded bg-zsaccent text-zsbg text-sm font-medium"
        >
          Connect Outlook
        </a>
```
(Place it adjacent to the Connect Gmail anchor; wrap both in a flex container if needed so they sit side by side.)

Make the per-row `needs_reconnect` link provider-aware. Replace the existing reconnect anchor:
```tsx
                  {c.status === 'needs_reconnect' && (
                    <a href={api.gmailConnectUrl()} className="ml-2 text-zsaccent underline">
                      Reconnect
                    </a>
                  )}
```
with:
```tsx
                  {c.status === 'needs_reconnect' && (
                    <a
                      href={c.provider === 'outlook' ? api.outlookConnectUrl() : api.gmailConnectUrl()}
                      className="ml-2 text-zsaccent underline"
                    >
                      Reconnect
                    </a>
                  )}
```

- [ ] **Step 5.5: Run; expect PASS**

Run: `npm run test:run --workspace=web -- ConnectionsPanel`
Expected: all pass (Connect Gmail, Connect Outlook, list, disconnect).

- [ ] **Step 5.6: Run full web suite + build**

Run: `npm run test:run --workspace=web`
Expected: all green.
Run: `npm run build --workspace=web`
Expected: exit 0.

- [ ] **Step 5.7: Commit**

```bash
git add web/src/api.ts web/src/components/ConnectionsPanel.tsx web/src/components/__tests__/ConnectionsPanel.test.tsx
git commit -m "feat(outlook): Connect Outlook UI + provider-aware reconnect"
```
End the commit body with the Co-Authored-By trailer.

---

## Task 6: Final verification

- [ ] **Step 6.1: Full server suite** — `npm test --workspace=server` → all green.
- [ ] **Step 6.2: Full web suite** — `npm run test:run --workspace=web` → all green.
- [ ] **Step 6.3: Both builds** — `npm run build --workspace=server && npm run build --workspace=web` → both exit 0.
- [ ] **Step 6.4: Operator smoke note (PR description)** — to exercise end-to-end: register an Azure app (authority `common`, redirect `${PUBLIC_BASE_URL}/api/oauth/outlook/callback`, delegated scope `Mail.Read`), set `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`/`PUBLIC_BASE_URL`, then settings → Connect Outlook → consent → send yourself new Outlook mail → within `CONNECTION_POLL_INTERVAL_SEC` it appears in the `<address>` mailbox (quarantine unless whitelisted).

---

## Self-Review

**1. Spec coverage:** §6.1 GraphConnector → Task 1. §6.2 real adapter → Task 2. §6.3 poller registry → Task 3. §6.4 OAuth routes → Task 4. §6.5 config → Task 0. §6.6 UI → Task 5. §3 decisions: official SDKs (Task 0/2), authority `common` (Task 2 authority string + Task 0 `MICROSOFT_TENANT`), reuse cred approach / stub tests (Tasks 1,4), forward-only seed (`seedCursor` in Tasks 1/2), msal cache in `refresh_enc` (Task 2 `exchangeCode`/`refresh` return `refreshToken: serialize()`, repo unchanged). §7 tests → Tasks 1,3,4,5. Out-of-scope items have no tasks (intended).

**2. Placeholder scan:** No "TBD"/"handle errors"/"similar to" — every code step has complete code. Two latitude points are explicit with fallbacks: the `config` mutation in Task 0.2 (fallback described) and Graph SDK type fixes in Task 2.2 (minimal-fix instruction). The real adapter (Task 2) is build-verified only, mirroring `gmail-google.ts` precedent.

**3. Type consistency:** `GraphApi` (getProfile/seedCursor/listDelta/getRawMessage) identical across types.ts, graph.ts, graph-ms.ts, and both test stubs. `OAuthTokens {accessToken, refreshToken, expiresAt}` reused unchanged (refreshToken carries msal cache for Outlook). `ProviderConnector` methods match the Gmail connector. `ConnectorRegistry = Partial<Record<'gmail'|'outlook', ProviderConnector>>` used consistently in poller + tests. Route dep-injection setter `__setOutlookOAuthDeps({exchanger, apiFor, authUrl})` matches its test usage. `outlookConnectUrl()` used identically in api.ts, ConnectionsPanel.tsx, and its test mock.
