# Gmail Inbound Pipeline (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user connect their Gmail account via OAuth so new Gmail mail is pulled into ZeroSpam and filtered through the existing quarantine-by-default pipeline.

**Architecture:** A `connections` table stores AES-256-GCM-encrypted OAuth tokens. A provider-agnostic `ProviderConnector` interface has one implementation, `GmailConnector`, that wraps `googleapis` behind an injectable factory (so tests run against a stub, no network). OAuth `start`/`callback` routes link an account; a polling worker (`connection-poller.ts`) fetches new messages as raw RFC822 and feeds them into the existing `ingest()`. A Connections UI manages connect/list/disconnect. Inbound only, Gmail only, forward-only.

**Tech Stack:** TypeScript on Node ≥20, ESM, Fastify, `better-sqlite3`-style `node:sqlite` via `db.ts`, vitest. New dependency: `googleapis`. Web is React + Vite + Tailwind with a typed `@zerospam/shared-api` client.

---

## Reference Documents

- Spec: [docs/superpowers/specs/2026-06-08-gmail-inbound-pipeline-design.md](../specs/2026-06-08-gmail-inbound-pipeline-design.md)
- Aggregator parent spec: [docs/superpowers/specs/2026-05-01-aggregator-inbox-design.md](../specs/2026-05-01-aggregator-inbox-design.md)
- Codebase entry points this plan touches:
  - `server/src/db.ts` — schema + idempotent `colsOf` migrations + row types
  - `server/src/config.ts` — env vars + secret loaders (`loadDigestSigningSecret` is the pattern to mirror)
  - `server/src/ingest.ts` — `ingest(rawBuffer, recipient)` — the pipeline we feed
  - `server/src/api.ts` — route registration + `(req as any).account?.id` auth
  - `server/src/index.ts` — boot (`startSweeper`, `startDigester` are the patterns to mirror)
  - `server/src/digest-token.ts` — canonical base64url + HMAC sign/verify (the pattern for oauth-state)
  - `server/test/setup.ts`, `server/test/helpers.ts` — test harness
  - `web/src/api.ts`, `web/src/types.ts`, `web/src/components/MailboxManager.tsx` — UI surface

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `server/package.json` | Modify | Add `googleapis` dependency |
| `server/src/config.ts` | Modify | Google creds, poll interval, `loadConnectionSecret()` |
| `server/src/db.ts` | Modify | `connections` table (CREATE IF NOT EXISTS) + `Connection` type |
| `server/src/connection-crypto.ts` | Create | AES-256-GCM token encrypt/decrypt |
| `server/src/oauth-state.ts` | Create | HMAC-signed OAuth `state` token |
| `server/src/connectors/types.ts` | Create | `ProviderConnector`, `OAuthTokens`, `FetchedMessage`, `GmailApi` |
| `server/src/connectors/gmail.ts` | Create | `GmailConnector` (injectable api factory + oauth exchanger) |
| `server/src/connectors/gmail-google.ts` | Create | Real `googleapis`-backed factory + exchanger |
| `server/src/connections-repo.ts` | Create | Data access: create/upsert/list/get/delete/status/cursor |
| `server/src/routes/oauth-gmail.ts` | Create | `GET /api/oauth/gmail/start` + `/callback` |
| `server/src/routes/connections.ts` | Create | `GET /api/connections`, `DELETE /api/connections/:id` |
| `server/src/connection-poller.ts` | Create | `tick`, `startConnectionPoller` |
| `server/src/index.ts` | Modify | Boot the poller |
| `server/test/setup.ts` | Modify | Truncate `connections` between tests |
| `server/test/helpers.ts` | Modify | `seedConnection` helper |
| `web/src/types.ts` | Modify | `Connection` type |
| `web/src/api.ts` | Modify | `connections()`, `disconnect()`, `gmailConnectUrl()` |
| `web/src/components/ConnectionsPanel.tsx` | Create | Connect/list/disconnect UI |
| `web/src/components/MailboxManager.tsx` | Modify | Mount the Connections section |

---

## Task 0: Dependency + config + secret loader

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/config.ts`
- Create: `server/test/connection-secret.test.ts`
- Modify: `.gitignore`

- [ ] **Step 0.1: Install googleapis**

Run:
```bash
npm install --workspace=server googleapis
```
Expected: `server/package.json` gains `"googleapis"` under `dependencies`.

- [ ] **Step 0.2: Write the failing test for the connection-secret loader**

`server/test/connection-secret.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config, loadConnectionSecret } from '../src/config.js';

describe('connection secret', () => {
  const secretPath = join(config.dataDir, '.connection-secret');

  beforeEach(() => {
    delete process.env.CONNECTION_SECRET;
    if (existsSync(secretPath)) rmSync(secretPath);
  });

  it('returns a 32-byte buffer derived from env when set', () => {
    process.env.CONNECTION_SECRET = 'env-connection-secret-value-padded-out-32+';
    const k = loadConnectionSecret();
    expect(Buffer.isBuffer(k)).toBe(true);
    expect(k.length).toBe(32);
  });

  it('is deterministic for the same env value', () => {
    process.env.CONNECTION_SECRET = 'stable-secret-stable-secret-stable-secret';
    expect(loadConnectionSecret().toString('hex')).toBe(loadConnectionSecret().toString('hex'));
  });

  it('generates and persists a 32-byte secret when env is unset', () => {
    expect(existsSync(secretPath)).toBe(false);
    const k1 = loadConnectionSecret();
    expect(k1.length).toBe(32);
    expect(existsSync(secretPath)).toBe(true);
    const k2 = loadConnectionSecret();
    expect(k2.toString('hex')).toBe(k1.toString('hex'));
  });
});
```

- [ ] **Step 0.3: Run; expect FAIL**

Run: `npm test --workspace=server -- connection-secret`
Expected: FAIL — `loadConnectionSecret` is not exported from `config.ts`.

- [ ] **Step 0.4: Add config fields + loader to `server/src/config.ts`**

Add `import { hkdfSync } from 'node:crypto';` to the existing `node:crypto` import line (so it reads `import { randomBytes, hkdfSync } from 'node:crypto';`).

Add these fields inside the `config` object literal (next to `digestTickIntervalSec`):
```ts
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  connectionPollIntervalSec: envInt('CONNECTION_POLL_INTERVAL_SEC', 60),
```

Append this exported function at the end of the file:
```ts
// 32-byte key for the connection token vault (AES-256-GCM).
// Mirrors loadDigestSigningSecret: env value (HKDF-stretched) or a generated file.
export function loadConnectionSecret(): Buffer {
  const fromEnv = process.env.CONNECTION_SECRET;
  if (fromEnv && fromEnv.length > 0) {
    return Buffer.from(
      hkdfSync('sha256', Buffer.from(fromEnv, 'utf8'), Buffer.alloc(0), 'zerospam-connection-vault', 32),
    );
  }
  mkdirSync(config.dataDir, { recursive: true });
  const path = join(config.dataDir, '.connection-secret');
  if (existsSync(path)) {
    const persisted = readFileSync(path, 'utf8').trim();
    if (persisted.length > 0) return Buffer.from(persisted, 'base64');
  }
  const raw = randomBytes(32);
  writeFileSync(path, raw.toString('base64'), { mode: 0o600 });
  return raw;
}

// Build the absolute redirect URI Google calls back. Requires PUBLIC_BASE_URL.
export function gmailRedirectUri(): string {
  if (!config.publicBaseUrl) throw new Error('PUBLIC_BASE_URL is unset; cannot build OAuth redirect URI');
  return `${config.publicBaseUrl}/api/oauth/gmail/callback`;
}
```

- [ ] **Step 0.5: Run; expect PASS**

Run: `npm test --workspace=server -- connection-secret`
Expected: 3 passed.

- [ ] **Step 0.6: Ignore the generated secret file**

Append to the **root** `.gitignore`:
```
server/data/.connection-secret
```

- [ ] **Step 0.7: Commit**

```bash
git add server/package.json package-lock.json server/src/config.ts server/test/connection-secret.test.ts .gitignore
git commit -m "feat(connections): googleapis dep, OAuth config, token-vault secret loader"
```

---

## Task 1: `connections` table + `Connection` type

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/test/setup.ts`
- Modify: `server/test/helpers.ts`
- Create: `server/test/connections-schema.test.ts`

- [ ] **Step 1.1: Write the failing schema test**

`server/test/connections-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('connections schema', () => {
  it('has all expected columns', () => {
    const cols = new Set(
      (db.prepare('PRAGMA table_info(connections)').all() as { name: string }[]).map((c) => c.name),
    );
    for (const c of [
      'id', 'account_id', 'mailbox_id', 'provider', 'access_enc', 'refresh_enc',
      'expires_at', 'cursor', 'status', 'last_polled_at', 'last_error',
      'consecutive_failures', 'created_at',
    ]) {
      expect(cols.has(c), `missing column: ${c}`).toBe(true);
    }
  });
});
```

- [ ] **Step 1.2: Run; expect FAIL**

Run: `npm test --workspace=server -- connections-schema`
Expected: FAIL — `PRAGMA table_info(connections)` returns no rows, so the first column assertion fails.

- [ ] **Step 1.3: Add the table to the `SCHEMA` string in `server/src/db.ts`**

Inside the big `const SCHEMA = \`...\`;` template (the block that ends just before `db.exec(SCHEMA);` at line ~242), add this `CREATE TABLE` (place it after the `otp_codes` table, before the closing backtick):
```sql
CREATE TABLE IF NOT EXISTS connections (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mailbox_id           INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK(provider IN ('gmail','outlook')),
  access_enc           TEXT NOT NULL,
  refresh_enc          TEXT NOT NULL,
  expires_at           INTEGER NOT NULL,
  cursor               TEXT,
  status               TEXT NOT NULL CHECK(status IN ('active','needs_reconnect','paused')),
  last_polled_at       INTEGER,
  last_error           TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_connections_due ON connections(status, last_polled_at);
```

- [ ] **Step 1.4: Add the `Connection` type to `server/src/db.ts`**

Next to the other exported row types (e.g. near `export type Mailbox = {...}`), add:
```ts
export type Connection = {
  id: number;
  account_id: number;
  mailbox_id: number;
  provider: 'gmail' | 'outlook';
  access_enc: string;
  refresh_enc: string;
  expires_at: number;
  cursor: string | null;
  status: 'active' | 'needs_reconnect' | 'paused';
  last_polled_at: number | null;
  last_error: string | null;
  consecutive_failures: number;
  created_at: number;
};
```

- [ ] **Step 1.5: Truncate `connections` between tests**

In `server/test/setup.ts`, add `DELETE FROM connections;` as the FIRST statement inside the `db.exec(\`...\`)` block in `beforeEach` (before `DELETE FROM messages_fts;`), so child rows clear before parents.

- [ ] **Step 1.6: Add a `seedConnection` helper**

Append to `server/test/helpers.ts`:
```ts
export type SeedConnectionOpts = {
  cursor?: string | null;
  status?: 'active' | 'needs_reconnect' | 'paused';
  expiresAt?: number;
  lastPolledAt?: number | null;
  consecutiveFailures?: number;
};

export function seedConnection(
  accountId: number,
  mailboxId: number,
  opts: SeedConnectionOpts = {},
): number {
  const r = db
    .prepare(
      `INSERT INTO connections
         (account_id, mailbox_id, provider, access_enc, refresh_enc, expires_at,
          cursor, status, last_polled_at, last_error, consecutive_failures, created_at)
       VALUES (?, ?, 'gmail', 'enc', 'enc', ?, ?, ?, ?, NULL, ?, ?) RETURNING id`,
    )
    .get(
      accountId,
      mailboxId,
      opts.expiresAt ?? Date.now() + 3600_000,
      opts.cursor ?? '1',
      opts.status ?? 'active',
      opts.lastPolledAt ?? null,
      opts.consecutiveFailures ?? 0,
      Date.now(),
    ) as { id: number };
  return r.id;
}
```

- [ ] **Step 1.7: Run; expect PASS**

Run: `npm test --workspace=server -- connections-schema`
Expected: 1 passed.

- [ ] **Step 1.8: Commit**

```bash
git add server/src/db.ts server/test/setup.ts server/test/helpers.ts server/test/connections-schema.test.ts
git commit -m "feat(connections): connections table, Connection type, test seam"
```

---

## Task 2: Token vault (`connection-crypto.ts`) — TDD

**Files:**
- Create: `server/src/connection-crypto.ts`
- Create: `server/test/connection-crypto.test.ts`

- [ ] **Step 2.1: Write the failing test**

`server/test/connection-crypto.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../src/connection-crypto.js';
import { randomBytes } from 'node:crypto';

const KEY = randomBytes(32);

describe('connection-crypto', () => {
  it('round-trips a token', () => {
    const blob = encryptToken('ya29.secret-access-token', KEY);
    expect(decryptToken(blob, KEY)).toBe('ya29.secret-access-token');
  });

  it('produces different ciphertext each call (random IV)', () => {
    expect(encryptToken('same', KEY)).not.toBe(encryptToken('same', KEY));
  });

  it('returns null for a tampered blob', () => {
    const blob = encryptToken('secret', KEY);
    const tampered = blob.slice(0, -2) + (blob.endsWith('A') ? 'B' : 'A');
    expect(decryptToken(tampered, KEY)).toBeNull();
  });

  it('returns null when decrypted with the wrong key', () => {
    const blob = encryptToken('secret', KEY);
    expect(decryptToken(blob, randomBytes(32))).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(decryptToken('not-base64-!!', KEY)).toBeNull();
    expect(decryptToken('', KEY)).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run; expect FAIL**

Run: `npm test --workspace=server -- connection-crypto`
Expected: FAIL — `Cannot find module '../src/connection-crypto.js'`.

- [ ] **Step 2.3: Implement `server/src/connection-crypto.ts`**

```ts
// AES-256-GCM encryption for OAuth tokens stored in the connections table.
// Blob layout (base64): [12-byte IV][16-byte GCM tag][ciphertext].

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptToken(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptToken(blob: string, key: Buffer): string | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(blob, 'base64');
  } catch {
    return null;
  }
  if (buf.length < IV_LEN + TAG_LEN) return null;
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
```

Note: `Buffer.from(x, 'base64')` does not throw on junk (it decodes leniently), so the tamper test relies on GCM tag verification failing in `decipher.final()`, and the malformed test relies on the length guard / final() throwing. Both return `null`.

- [ ] **Step 2.4: Run; expect PASS**

Run: `npm test --workspace=server -- connection-crypto`
Expected: 5 passed.

- [ ] **Step 2.5: Commit**

```bash
git add server/src/connection-crypto.ts server/test/connection-crypto.test.ts
git commit -m "feat(connections): AES-256-GCM token vault"
```

---

## Task 3: OAuth state token (`oauth-state.ts`) — TDD

**Files:**
- Create: `server/src/oauth-state.ts`
- Create: `server/test/oauth-state.test.ts`

- [ ] **Step 3.1: Write the failing test**

`server/test/oauth-state.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { signState, verifyState } from '../src/oauth-state.js';

const SECRET = 'a'.repeat(64);

describe('oauth-state', () => {
  it('round-trips a payload', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() + 600_000 }, SECRET);
    expect(verifyState(t, SECRET, Date.now())).toEqual({
      v: 1, userId: 7, accountId: 3, exp: expect.any(Number),
    });
  });

  it('returns null for a tampered token', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() + 600_000 }, SECRET);
    const bad = t.slice(0, -2) + (t.endsWith('A') ? 'B' : 'A');
    expect(verifyState(bad, SECRET, Date.now())).toBeNull();
  });

  it('returns null for an expired token', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() - 1 }, SECRET);
    expect(verifyState(t, SECRET, Date.now())).toBeNull();
  });

  it('returns null for the wrong secret', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() + 600_000 }, SECRET);
    expect(verifyState(t, 'b'.repeat(64), Date.now())).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(verifyState('nope', SECRET, Date.now())).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run; expect FAIL**

Run: `npm test --workspace=server -- oauth-state`
Expected: FAIL — `Cannot find module '../src/oauth-state.js'`.

- [ ] **Step 3.3: Implement `server/src/oauth-state.ts`**

This reuses the canonical-base64url + HMAC approach already proven in `digest-token.ts` (including the non-canonical-encoding guard).
```ts
// HMAC-signed, time-boxed state token binding an OAuth round-trip to a session.
// Format: <base64url(JSON)>.<base64url(HMAC-SHA256)>

import { createHmac, timingSafeEqual } from 'node:crypto';

export type OAuthStatePayload = {
  v: 1;
  userId: number;
  accountId: number;
  exp: number;
};

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  let buf: Buffer;
  try {
    buf = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
  if (b64urlEncode(buf) !== s) return null;
  return buf;
}

function mac(secret: string, payloadBuf: Buffer): Buffer {
  return createHmac('sha256', secret).update(payloadBuf).digest();
}

export function signState(payload: OAuthStatePayload, secret: string): string {
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  return `${b64urlEncode(payloadBuf)}.${b64urlEncode(mac(secret, payloadBuf))}`;
}

export function verifyState(token: string, secret: string, now: number): OAuthStatePayload | null {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadBuf = b64urlDecode(token.slice(0, dot));
  const sigBuf = b64urlDecode(token.slice(dot + 1));
  if (!payloadBuf || !sigBuf) return null;
  const expected = mac(secret, payloadBuf);
  if (sigBuf.length !== expected.length) return null;
  if (!timingSafeEqual(sigBuf, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBuf.toString('utf8'));
  } catch {
    return null;
  }
  if (
    !parsed || typeof parsed !== 'object' ||
    (parsed as OAuthStatePayload).v !== 1 ||
    typeof (parsed as OAuthStatePayload).userId !== 'number' ||
    typeof (parsed as OAuthStatePayload).accountId !== 'number' ||
    typeof (parsed as OAuthStatePayload).exp !== 'number'
  ) {
    return null;
  }
  const p = parsed as OAuthStatePayload;
  if (p.exp < now) return null;
  return p;
}
```

- [ ] **Step 3.4: Run; expect PASS**

Run: `npm test --workspace=server -- oauth-state`
Expected: 5 passed.

- [ ] **Step 3.5: Commit**

```bash
git add server/src/oauth-state.ts server/test/oauth-state.test.ts
git commit -m "feat(connections): HMAC OAuth state token"
```

---

## Task 4: Connector interface + `GmailConnector` — TDD

**Files:**
- Create: `server/src/connectors/types.ts`
- Create: `server/src/connectors/gmail.ts`
- Create: `server/test/gmail-connector.test.ts`

- [ ] **Step 4.1: Create the interfaces `server/src/connectors/types.ts`**

(No test of its own — it's types only; exercised by Task 4's connector test.)
```ts
export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};

export type FetchedMessage = {
  providerMsgId: string;
  raw: Buffer;
};

// Minimal Gmail surface the connector calls. The real impl wraps googleapis;
// tests pass a stub.
export interface GmailApi {
  getProfile(): Promise<{ emailAddress: string; historyId: string }>;
  listHistory(startHistoryId: string): Promise<{ addedMessageIds: string[]; historyId: string }>;
  getRawMessage(id: string): Promise<Buffer>;
}

// Exchanges/refreshes OAuth codes & tokens. Real impl wraps google-auth-library.
export interface OAuthExchanger {
  exchangeCode(code: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<OAuthTokens>;
  authUrl(state: string): string;
}

export interface ProviderConnector {
  provider: 'gmail' | 'outlook';
  verifyIdentity(tokens: OAuthTokens): Promise<{ email: string; cursor: string }>;
  ensureFresh(tokens: OAuthTokens, now: number): Promise<OAuthTokens>;
  fetchSince(
    tokens: OAuthTokens,
    cursor: string,
  ): Promise<{ messages: FetchedMessage[]; nextCursor: string }>;
}
```

- [ ] **Step 4.2: Write the failing connector test**

`server/test/gmail-connector.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { GmailConnector } from '../src/connectors/gmail.js';
import type { GmailApi, OAuthExchanger, OAuthTokens } from '../src/connectors/types.js';

const tokens: OAuthTokens = { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000 };

function stubApi(over: Partial<GmailApi> = {}): GmailApi {
  return {
    getProfile: vi.fn(async () => ({ emailAddress: 'alice@gmail.com', historyId: '100' })),
    listHistory: vi.fn(async () => ({ addedMessageIds: ['m1', 'm2'], historyId: '105' })),
    getRawMessage: vi.fn(async (id: string) => Buffer.from(`raw-${id}`)),
    ...over,
  };
}

function stubExchanger(over: Partial<OAuthExchanger> = {}): OAuthExchanger {
  return {
    exchangeCode: vi.fn(async () => tokens),
    refresh: vi.fn(async () => ({ ...tokens, accessToken: 'fresh', expiresAt: Date.now() + 3600_000 })),
    authUrl: vi.fn((state: string) => `https://consent?state=${state}`),
    ...over,
  };
}

describe('GmailConnector', () => {
  it('verifyIdentity returns email and seed cursor (current historyId)', async () => {
    const c = new GmailConnector(() => stubApi(), stubExchanger());
    expect(await c.verifyIdentity(tokens)).toEqual({ email: 'alice@gmail.com', cursor: '100' });
  });

  it('fetchSince collects added messages as raw buffers and advances cursor', async () => {
    const c = new GmailConnector(() => stubApi(), stubExchanger());
    const r = await c.fetchSince(tokens, '100');
    expect(r.messages.map((m) => m.providerMsgId)).toEqual(['m1', 'm2']);
    expect(r.messages[0].raw.toString()).toBe('raw-m1');
    expect(r.nextCursor).toBe('105');
  });

  it('ensureFresh refreshes when the access token is near expiry', async () => {
    const ex = stubExchanger();
    const c = new GmailConnector(() => stubApi(), ex);
    const nearExpiry = { ...tokens, expiresAt: Date.now() + 30_000 };
    const out = await c.ensureFresh(nearExpiry, Date.now());
    expect(ex.refresh).toHaveBeenCalledOnce();
    expect(out.accessToken).toBe('fresh');
  });

  it('ensureFresh does NOT refresh when the token has comfortable life left', async () => {
    const ex = stubExchanger();
    const c = new GmailConnector(() => stubApi(), ex);
    const out = await c.ensureFresh(tokens, Date.now());
    expect(ex.refresh).not.toHaveBeenCalled();
    expect(out.accessToken).toBe('a');
  });
});
```

- [ ] **Step 4.3: Run; expect FAIL**

Run: `npm test --workspace=server -- gmail-connector`
Expected: FAIL — `Cannot find module '../src/connectors/gmail.js'`.

- [ ] **Step 4.4: Implement `server/src/connectors/gmail.ts`**

```ts
import type {
  GmailApi,
  OAuthExchanger,
  OAuthTokens,
  ProviderConnector,
  FetchedMessage,
} from './types.js';

const REFRESH_SKEW_MS = 2 * 60 * 1000; // refresh if < 2 min of life left

export class GmailConnector implements ProviderConnector {
  readonly provider = 'gmail' as const;

  constructor(
    // factory builds a Gmail API client bound to a set of tokens
    private readonly apiFor: (tokens: OAuthTokens) => GmailApi,
    private readonly oauth: OAuthExchanger,
  ) {}

  async verifyIdentity(tokens: OAuthTokens): Promise<{ email: string; cursor: string }> {
    const profile = await this.apiFor(tokens).getProfile();
    return { email: profile.emailAddress.toLowerCase(), cursor: profile.historyId };
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
    const { addedMessageIds, historyId } = await api.listHistory(cursor);
    const messages: FetchedMessage[] = [];
    for (const id of addedMessageIds) {
      messages.push({ providerMsgId: id, raw: await api.getRawMessage(id) });
    }
    return { messages, nextCursor: historyId };
  }
}
```

- [ ] **Step 4.5: Run; expect PASS**

Run: `npm test --workspace=server -- gmail-connector`
Expected: 4 passed.

- [ ] **Step 4.6: Commit**

```bash
git add server/src/connectors/types.ts server/src/connectors/gmail.ts server/test/gmail-connector.test.ts
git commit -m "feat(connections): ProviderConnector interface + GmailConnector (stub-injectable)"
```

---

## Task 5: Real googleapis adapter (`gmail-google.ts`)

This is the thin, network-touching glue. It has no unit test (it only wraps the SDK; all logic lives in `GmailConnector`, already tested). It is type-checked by `tsc`.

**Files:**
- Create: `server/src/connectors/gmail-google.ts`

- [ ] **Step 5.1: Implement `server/src/connectors/gmail-google.ts`**

```ts
// Real googleapis-backed factory + OAuth exchanger for GmailConnector.
import { google } from 'googleapis';
import type { GmailApi, OAuthExchanger, OAuthTokens } from './types.js';
import { config, gmailRedirectUri } from '../config.js';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function oauthClient() {
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, gmailRedirectUri());
}

export const googleExchanger: OAuthExchanger = {
  authUrl(state: string): string {
    return oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token every time
      scope: SCOPES,
      state,
    });
  },
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const { tokens } = await oauthClient().getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('google did not return both access and refresh tokens');
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
    };
  },
  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new Error('google refresh returned no access token');
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: credentials.expiry_date ?? Date.now() + 3600_000,
    };
  },
};

export function googleApiFor(tokens: OAuthTokens): GmailApi {
  const auth = oauthClient();
  auth.setCredentials({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
  const gmail = google.gmail({ version: 'v1', auth });
  return {
    async getProfile() {
      const res = await gmail.users.getProfile({ userId: 'me' });
      return {
        emailAddress: res.data.emailAddress ?? '',
        historyId: String(res.data.historyId ?? '0'),
      };
    },
    async listHistory(startHistoryId: string) {
      const added: string[] = [];
      let pageToken: string | undefined;
      let latest = startHistoryId;
      do {
        const res = await gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          historyTypes: ['messageAdded'],
          pageToken,
        });
        if (res.data.historyId) latest = String(res.data.historyId);
        for (const h of res.data.history ?? []) {
          for (const m of h.messagesAdded ?? []) {
            if (m.message?.id) added.push(m.message.id);
          }
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return { addedMessageIds: [...new Set(added)], historyId: latest };
    },
    async getRawMessage(id: string) {
      const res = await gmail.users.messages.get({ userId: 'me', id, format: 'raw' });
      return Buffer.from(String(res.data.raw ?? ''), 'base64url');
    },
  };
}
```

- [ ] **Step 5.2: Type-check**

Run: `npm run build --workspace=server`
Expected: build succeeds (exit 0).

- [ ] **Step 5.3: Commit**

```bash
git add server/src/connectors/gmail-google.ts
git commit -m "feat(connections): real googleapis Gmail adapter"
```

---

## Task 6: Connections data-access (`connections-repo.ts`) — TDD

A small module so routes and the poller share token-aware reads/writes. Encrypts/decrypts at the boundary.

**Files:**
- Create: `server/src/connections-repo.ts`
- Create: `server/test/connections-repo.test.ts`

- [ ] **Step 6.1: Write the failing test**

`server/test/connections-repo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { seedMailbox } from './helpers.js';
import { db } from '../src/db.js';
import {
  upsertConnection, listConnectionsForAccount, getDecryptedTokens,
  markNeedsReconnect, recordPollSuccess, recordPollFailure, deleteConnection,
} from '../src/connections-repo.js';

function acct(mailboxId: number): number {
  return (db.prepare('SELECT account_id FROM mailboxes WHERE id = ?').get(mailboxId) as { account_id: number }).account_id;
}

describe('connections-repo', () => {
  it('upserts a connection and round-trips decrypted tokens', () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 123 }, cursor: '100',
    });
    const t = getDecryptedTokens(id);
    expect(t).toEqual({ accessToken: 'A', refreshToken: 'R', expiresAt: 123 });
  });

  it('upsert updates the existing row for the same mailbox in place', () => {
    const mb = seedMailbox('alice@gmail.com');
    const a = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const b = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A2', refreshToken: 'R2', expiresAt: 2 }, cursor: '2',
    });
    expect(b).toBe(a);
    expect(getDecryptedTokens(a)!.accessToken).toBe('A2');
  });

  it('lists connections for an account without exposing encrypted columns', () => {
    const mb = seedMailbox('alice@gmail.com');
    upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const list = listConnectionsForAccount(acct(mb));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ provider: 'gmail', email: 'alice@gmail.com', status: 'active' });
    expect(list[0]).not.toHaveProperty('access_enc');
  });

  it('markNeedsReconnect / recordPollFailure / recordPollSuccess update bookkeeping', () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    recordPollFailure(id, 'boom', 1000);
    let row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.consecutive_failures).toBe(1);
    expect(row.last_error).toBe('boom');

    recordPollSuccess(id, '999', 2000);
    row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.consecutive_failures).toBe(0);
    expect(row.cursor).toBe('999');
    expect(row.last_polled_at).toBe(2000);
    expect(row.last_error).toBeNull();

    markNeedsReconnect(id, 'unauth');
    row = db.prepare('SELECT status FROM connections WHERE id = ?').get(id) as any;
    expect(row.status).toBe('needs_reconnect');
  });

  it('deleteConnection removes the row but keeps the mailbox', () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    deleteConnection(id);
    expect(db.prepare('SELECT 1 FROM connections WHERE id = ?').get(id)).toBeUndefined();
    expect(db.prepare('SELECT 1 FROM mailboxes WHERE id = ?').get(mb)).toBeTruthy();
  });
});
```

- [ ] **Step 6.2: Run; expect FAIL**

Run: `npm test --workspace=server -- connections-repo`
Expected: FAIL — `Cannot find module '../src/connections-repo.js'`.

- [ ] **Step 6.3: Implement `server/src/connections-repo.ts`**

```ts
import { db } from './db.js';
import type { Connection } from './db.js';
import { encryptToken, decryptToken } from './connection-crypto.js';
import { loadConnectionSecret } from './config.js';
import type { OAuthTokens } from './connectors/types.js';

export type ConnectionSummary = {
  id: number;
  provider: 'gmail' | 'outlook';
  email: string;
  status: 'active' | 'needs_reconnect' | 'paused';
  lastPolledAt: number | null;
  lastError: string | null;
  createdAt: number;
};

export type UpsertArgs = {
  accountId: number;
  mailboxId: number;
  provider: 'gmail' | 'outlook';
  tokens: OAuthTokens;
  cursor: string;
};

export function upsertConnection(args: UpsertArgs): number {
  const key = loadConnectionSecret();
  const access = encryptToken(args.tokens.accessToken, key);
  const refresh = encryptToken(args.tokens.refreshToken, key);
  const existing = db
    .prepare('SELECT id FROM connections WHERE mailbox_id = ?')
    .get(args.mailboxId) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE connections
         SET access_enc = ?, refresh_enc = ?, expires_at = ?, cursor = ?,
             status = 'active', last_error = NULL, consecutive_failures = 0
       WHERE id = ?`,
    ).run(access, refresh, args.tokens.expiresAt, args.cursor, existing.id);
    return existing.id;
  }
  const r = db
    .prepare(
      `INSERT INTO connections
         (account_id, mailbox_id, provider, access_enc, refresh_enc, expires_at,
          cursor, status, last_polled_at, consecutive_failures, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL, 0, ?) RETURNING id`,
    )
    .get(
      args.accountId, args.mailboxId, args.provider, access, refresh,
      args.tokens.expiresAt, args.cursor, Date.now(),
    ) as { id: number };
  return r.id;
}

export function getDecryptedTokens(id: number): OAuthTokens | null {
  const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as Connection | undefined;
  if (!row) return null;
  const key = loadConnectionSecret();
  const accessToken = decryptToken(row.access_enc, key);
  const refreshToken = decryptToken(row.refresh_enc, key);
  if (accessToken == null || refreshToken == null) return null;
  return { accessToken, refreshToken, expiresAt: row.expires_at };
}

export function persistTokens(id: number, tokens: OAuthTokens): void {
  const key = loadConnectionSecret();
  db.prepare('UPDATE connections SET access_enc = ?, refresh_enc = ?, expires_at = ? WHERE id = ?').run(
    encryptToken(tokens.accessToken, key),
    encryptToken(tokens.refreshToken, key),
    tokens.expiresAt,
    id,
  );
}

export function listConnectionsForAccount(accountId: number): ConnectionSummary[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.provider, c.status, c.last_polled_at, c.last_error, c.created_at, m.address
         FROM connections c JOIN mailboxes m ON m.id = c.mailbox_id
        WHERE c.account_id = ? ORDER BY c.created_at DESC`,
    )
    .all(accountId) as Array<{
      id: number; provider: 'gmail' | 'outlook'; status: ConnectionSummary['status'];
      last_polled_at: number | null; last_error: string | null; created_at: number; address: string;
    }>;
  return rows.map((r) => ({
    id: r.id, provider: r.provider, email: r.address, status: r.status,
    lastPolledAt: r.last_polled_at, lastError: r.last_error, createdAt: r.created_at,
  }));
}

export function recordPollSuccess(id: number, cursor: string, now: number): void {
  db.prepare(
    `UPDATE connections
       SET cursor = ?, last_polled_at = ?, consecutive_failures = 0, last_error = NULL
     WHERE id = ?`,
  ).run(cursor, now, id);
}

export function recordPollFailure(id: number, error: string, now: number): void {
  db.prepare(
    `UPDATE connections
       SET consecutive_failures = consecutive_failures + 1, last_error = ?, last_polled_at = ?
     WHERE id = ?`,
  ).run(error, now, id);
}

export function markNeedsReconnect(id: number, error: string): void {
  db.prepare("UPDATE connections SET status = 'needs_reconnect', last_error = ? WHERE id = ?").run(error, id);
}

export function deleteConnection(id: number): void {
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
}
```

- [ ] **Step 6.4: Run; expect PASS**

Run: `npm test --workspace=server -- connections-repo`
Expected: 6 passed.

- [ ] **Step 6.5: Commit**

```bash
git add server/src/connections-repo.ts server/test/connections-repo.test.ts
git commit -m "feat(connections): connections data-access repo with token encryption boundary"
```

---

## Task 7: OAuth routes (`routes/oauth-gmail.ts`) — TDD

**Files:**
- Create: `server/src/routes/oauth-gmail.ts`
- Create: `server/test/oauth-gmail-routes.test.ts`
- Modify: `server/src/api.ts` (register + allow callback through auth via state)

The connector + exchanger are module-level swappable so tests inject stubs.

- [ ] **Step 7.1: Write the failing test**

`server/test/oauth-gmail-routes.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { startApi } from '../src/api.js';
import { __setGmailOAuthDeps } from '../src/routes/oauth-gmail.js';
import { signState } from '../src/oauth-state.js';
import { config } from '../src/config.js';
import { db } from '../src/db.js';
import { seedMailbox } from './helpers.js';
import type { FastifyInstance } from 'fastify';

// A test user/account with a native mailbox.
function seedUser(): { userId: number; accountId: number } {
  seedMailbox('owner@zero-spam.email'); // ensures account 1 + domain exist
  return { userId: 1, accountId: 1 };
}

let app: FastifyInstance;
beforeEach(async () => {
  __setGmailOAuthDeps({
    exchanger: {
      authUrl: (state) => `https://consent.example/?state=${state}`,
      exchangeCode: async () => ({ accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }),
      refresh: async () => ({ accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }),
    },
    apiFor: () => ({
      getProfile: async () => ({ emailAddress: 'alice@gmail.com', historyId: '500' }),
      listHistory: async () => ({ addedMessageIds: [], historyId: '500' }),
      getRawMessage: async () => Buffer.from(''),
    }),
  });
  app = await startApi({ inject: true });
});

describe('gmail oauth callback', () => {
  it('creates a gmail mailbox + active connection from a valid callback', async () => {
    const { userId, accountId } = seedUser();
    const state = signState({ v: 1, userId, accountId, exp: Date.now() + 600_000 }, config.sessionSecret);

    const res = await app.inject({
      method: 'GET',
      url: `/api/oauth/gmail/callback?code=xyz&state=${encodeURIComponent(state)}`,
    });
    expect(res.statusCode).toBe(302); // redirect back to app

    const mb = db.prepare("SELECT * FROM mailboxes WHERE address = 'alice@gmail.com'").get() as any;
    expect(mb.provider).toBe('gmail');
    expect(mb.account_id).toBe(accountId);
    const conn = db.prepare('SELECT * FROM connections WHERE mailbox_id = ?').get(mb.id) as any;
    expect(conn.status).toBe('active');
    expect(conn.cursor).toBe('500');
  });

  it('rejects a tampered state', async () => {
    seedUser();
    const res = await app.inject({ method: 'GET', url: `/api/oauth/gmail/callback?code=xyz&state=bad` });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 7.2: Run; expect FAIL**

Run: `npm test --workspace=server -- oauth-gmail-routes`
Expected: FAIL — `Cannot find module '../src/routes/oauth-gmail.js'`.

- [ ] **Step 7.3: Implement `server/src/routes/oauth-gmail.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { db, runInTx } from '../db.js';
import { config } from '../config.js';
import { signState, verifyState } from '../oauth-state.js';
import { GmailConnector } from '../connectors/gmail.js';
import { googleApiFor, googleExchanger } from '../connectors/gmail-google.js';
import { upsertConnection } from '../connections-repo.js';
import type { GmailApi, OAuthExchanger, OAuthTokens } from '../connectors/types.js';

// Swappable deps for tests (no network).
let exchanger: OAuthExchanger = googleExchanger;
let apiFor: (t: OAuthTokens) => GmailApi = googleApiFor;
export function __setGmailOAuthDeps(deps: { exchanger?: OAuthExchanger; apiFor?: (t: OAuthTokens) => GmailApi }): void {
  if (deps.exchanger) exchanger = deps.exchanger;
  if (deps.apiFor) apiFor = deps.apiFor;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export async function gmailOAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/oauth/gmail/start', async (req, reply) => {
    const account = (req as any).account;
    const user = (req as any).user;
    if (!account?.id || !user?.id) return reply.code(401).send({ error: 'unauthorized' });
    if (!config.google.clientId || !config.google.clientSecret) {
      return reply.code(503).send({ error: 'Gmail connect unavailable: GOOGLE_CLIENT_ID/SECRET not configured' });
    }
    const state = signState(
      { v: 1, userId: user.id, accountId: account.id, exp: Date.now() + STATE_TTL_MS },
      config.sessionSecret,
    );
    return reply.redirect(exchanger.authUrl(state));
  });

  // Callback is reachable without the normal auth gate (see api.ts PUBLIC list);
  // the signed state token is the auth proof and binds to the originating account.
  app.get('/api/oauth/gmail/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return reply.code(400).send({ error: 'missing code/state' });
    const payload = verifyState(state, config.sessionSecret, Date.now());
    if (!payload) return reply.code(400).send({ error: 'invalid or expired state' });

    let connector: GmailConnector;
    let tokens: OAuthTokens;
    let identity: { email: string; cursor: string };
    try {
      connector = new GmailConnector(apiFor, exchanger);
      tokens = await exchanger.exchangeCode(code);
      identity = await connector.verifyIdentity(tokens);
    } catch (e: any) {
      app.log.error({ err: e }, 'gmail oauth callback failed');
      return reply.code(502).send({ error: 'oauth exchange failed' });
    }

    runInTx(() => {
      // Find-or-create the mailbox at the connected Gmail address on this account.
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
             VALUES (?, ?, ?, ?, ?, 'gmail', ?) RETURNING id`,
          )
          .get(identity.email, dom.id, null, config.quarantineTtlHours, payload.accountId, Date.now()) as { id: number };
      }
      upsertConnection({
        accountId: payload.accountId,
        mailboxId: mb.id,
        provider: 'gmail',
        tokens,
        cursor: identity.cursor,
      });
    });

    return reply.redirect(`${config.publicBaseUrl || ''}/?connected=gmail`);
  });
}
```

- [ ] **Step 7.4: Register the routes + allow the callback through the auth gate in `server/src/api.ts`**

Add to the imports near the other route imports:
```ts
import { gmailOAuthRoutes } from './routes/oauth-gmail.js';
```
Add `'/api/oauth/gmail/callback'` to the `PUBLIC_PREFIXES` array (the callback authenticates via the signed `state` token, not the session cookie). Leave `/api/oauth/gmail/start` OUT of the list so it stays behind auth.
Register after the other `app.register(...)` route registrations:
```ts
  await app.register(gmailOAuthRoutes);
```

- [ ] **Step 7.5: Run; expect PASS**

Run: `npm test --workspace=server -- oauth-gmail-routes`
Expected: 2 passed.

- [ ] **Step 7.6: Run the full server suite to check nothing regressed**

Run: `npm test --workspace=server`
Expected: all green.

- [ ] **Step 7.7: Commit**

```bash
git add server/src/routes/oauth-gmail.ts server/src/api.ts server/test/oauth-gmail-routes.test.ts
git commit -m "feat(connections): Gmail OAuth start + callback routes"
```

---

## Task 8: Sync worker (`connection-poller.ts`) — TDD

**Files:**
- Create: `server/src/connection-poller.ts`
- Create: `server/test/connection-poller.test.ts`

- [ ] **Step 8.1: Write the failing test**

`server/test/connection-poller.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { tick, backoffMs } from '../src/connection-poller.js';
import { seedMailbox, seedConnection } from './helpers.js';
import { db } from '../src/db.js';
import { upsertConnection } from '../src/connections-repo.js';
import type { ProviderConnector, OAuthTokens } from '../src/connectors/types.js';

function acct(mb: number): number {
  return (db.prepare('SELECT account_id FROM mailboxes WHERE id = ?').get(mb) as { account_id: number }).account_id;
}

function fakeConnector(over: Partial<ProviderConnector> = {}): ProviderConnector {
  return {
    provider: 'gmail',
    verifyIdentity: vi.fn(async () => ({ email: 'x@gmail.com', cursor: '1' })),
    ensureFresh: vi.fn(async (t: OAuthTokens) => t),
    fetchSince: vi.fn(async () => ({
      messages: [{ providerMsgId: 'm1', raw: rawFrom('boss@acme.com', 'alice@gmail.com') }],
      nextCursor: '200',
    })),
    ...over,
  };
}

function rawFrom(from: string, to: string): Buffer {
  return Buffer.from(
    [`From: ${from}`, `To: ${to}`, `Subject: hi`, `Date: ${new Date().toUTCString()}`,
     `Message-ID: <${Math.random()}@t>`, ``, 'body'].join('\r\n'),
  );
}

describe('connection-poller backoff', () => {
  it('grows exponentially and caps at 1h', () => {
    expect(backoffMs(0)).toBe(60_000);
    expect(backoffMs(1)).toBe(120_000);
    expect(backoffMs(10)).toBe(3_600_000);
  });
});

describe('connection-poller tick', () => {
  it('ingests fetched messages and advances the cursor', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: '100',
    });
    await tick({ connector: fakeConnector(), now: 1_000_000 });

    const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.cursor).toBe('200');
    expect(row.last_polled_at).toBe(1_000_000);
    expect(row.consecutive_failures).toBe(0);
    const msg = db.prepare("SELECT folder FROM messages WHERE mailbox_id = ?").get(mb) as any;
    expect(msg.folder).toBe('quarantine'); // boss@acme.com not whitelisted
  });

  it('marks needs_reconnect on auth failure', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: '1',
    });
    const c = fakeConnector({
      ensureFresh: vi.fn(async () => { const e: any = new Error('unauth'); e.authError = true; throw e; }),
    });
    await tick({ connector: c, now: 2_000 });
    const row = db.prepare('SELECT status FROM connections WHERE id = ?').get(id) as any;
    expect(row.status).toBe('needs_reconnect');
  });

  it('records a transient failure (counter increments, status stays active)', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: '1',
    });
    const c = fakeConnector({ fetchSince: vi.fn(async () => { throw new Error('503 upstream'); }) });
    await tick({ connector: c, now: 3_000 });
    const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.status).toBe('active');
    expect(row.consecutive_failures).toBe(1);
  });

  it('skips connections that are not yet due (within backoff window)', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = seedConnection(acct(mb), mb, { status: 'active', lastPolledAt: 1000, consecutiveFailures: 1 });
    const c = fakeConnector();
    // backoff(1)=120s; lastPolled=1000ms, now=1000+60s → not due yet
    await tick({ connector: c, now: 1000 + 60_000 });
    expect(c.fetchSince).not.toHaveBeenCalled();
    const row = db.prepare('SELECT last_polled_at FROM connections WHERE id = ?').get(id) as any;
    expect(row.last_polled_at).toBe(1000);
  });

  it('skips needs_reconnect connections', async () => {
    const mb = seedMailbox('alice@gmail.com');
    seedConnection(acct(mb), mb, { status: 'needs_reconnect' });
    const c = fakeConnector();
    await tick({ connector: c, now: 9_999_999 });
    expect(c.fetchSince).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8.2: Run; expect FAIL**

Run: `npm test --workspace=server -- connection-poller`
Expected: FAIL — `Cannot find module '../src/connection-poller.js'`.

- [ ] **Step 8.3: Implement `server/src/connection-poller.ts`**

```ts
// Polls each active connection on an interval, fetching new provider mail and
// running it through ingest(). Mirrors the shape of sweeper.ts / digester.ts.

import { db } from './db.js';
import type { Connection } from './db.js';
import { ingest } from './ingest.js';
import { config } from './config.js';
import { GmailConnector } from './connectors/gmail.js';
import { googleApiFor, googleExchanger } from './connectors/gmail-google.js';
import type { ProviderConnector } from './connectors/types.js';
import {
  getDecryptedTokens, persistTokens, recordPollSuccess, recordPollFailure, markNeedsReconnect,
} from './connections-repo.js';

const ONE_HOUR_MS = 3_600_000;

export function backoffMs(failures: number): number {
  return Math.min(60_000 * 2 ** failures, ONE_HOUR_MS);
}

function isAuthError(e: unknown): boolean {
  if (e && typeof e === 'object' && (e as any).authError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /401|unauthor|invalid_grant|invalid credentials/i.test(msg);
}

export async function tick(opts: { connector?: ProviderConnector; now: number }): Promise<void> {
  const connector = opts.connector ?? new GmailConnector(googleApiFor, googleExchanger);
  const now = opts.now;

  const rows = db
    .prepare("SELECT * FROM connections WHERE status = 'active' ORDER BY id")
    .all() as Connection[];

  for (const conn of rows) {
    const due = conn.last_polled_at == null || conn.last_polled_at + backoffMs(conn.consecutive_failures) <= now;
    if (!due) continue;

    const mailbox = db.prepare('SELECT address FROM mailboxes WHERE id = ?').get(conn.mailbox_id) as
      | { address: string }
      | undefined;
    if (!mailbox) continue;

    try {
      const stored = getDecryptedTokens(conn.id);
      if (!stored) {
        markNeedsReconnect(conn.id, 'token decrypt failed');
        continue;
      }
      const fresh = await connector.ensureFresh(stored, now);
      if (fresh.accessToken !== stored.accessToken || fresh.expiresAt !== stored.expiresAt) {
        persistTokens(conn.id, fresh);
      }
      const { messages, nextCursor } = await connector.fetchSince(fresh, conn.cursor ?? '');
      for (const m of messages) {
        try {
          await ingest(m.raw, mailbox.address);
        } catch (e) {
          // One bad message must not stall the connection; log and continue.
          // eslint-disable-next-line no-console
          console.error('[poller] ingest failed', conn.id, m.providerMsgId, e);
        }
      }
      recordPollSuccess(conn.id, nextCursor, now);
    } catch (e) {
      if (isAuthError(e)) {
        markNeedsReconnect(conn.id, e instanceof Error ? e.message : String(e));
      } else {
        recordPollFailure(conn.id, e instanceof Error ? e.message : String(e), now);
      }
    }
  }
}

export function startConnectionPoller(): void {
  const intervalMs = config.connectionPollIntervalSec * 1000;
  setInterval(() => {
    tick({ now: Date.now() }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[poller] tick error', e);
    });
  }, intervalMs).unref();
}
```

- [ ] **Step 8.4: Run; expect PASS**

Run: `npm test --workspace=server -- connection-poller`
Expected: 6 passed (1 backoff + 5 tick).

- [ ] **Step 8.5: Commit**

```bash
git add server/src/connection-poller.ts server/test/connection-poller.test.ts
git commit -m "feat(connections): polling sync worker feeding ingest()"
```

---

## Task 9: Boot wiring

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 9.1: Boot the poller**

Edit `server/src/index.ts` to import and start the poller alongside the digester:
```ts
import { startSmtp } from './smtp.js';
import { startApi } from './api.js';
import { startSweeper } from './sweeper.js';
import { startDigester } from './digester.js';
import { startConnectionPoller } from './connection-poller.js';

async function main() {
  startSmtp();
  await startApi();
  startSweeper();
  startDigester();
  startConnectionPoller();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
```

- [ ] **Step 9.2: Type-check**

Run: `npm run build --workspace=server`
Expected: build succeeds (exit 0).

- [ ] **Step 9.3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(connections): boot the connection poller"
```

---

## Task 10: Connections management API (`routes/connections.ts`) — TDD

**Files:**
- Create: `server/src/routes/connections.ts`
- Create: `server/test/connections-routes.test.ts`
- Modify: `server/src/api.ts` (register)

- [ ] **Step 10.1: Write the failing test**

`server/test/connections-routes.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox } from './helpers.js';
import { upsertConnection } from '../src/connections-repo.js';
import { db } from '../src/db.js';
import type { FastifyInstance } from 'fastify';

// Stub requireAuth so injected requests carry account/user 1. The simplest seam:
// these routes read (req as any).account?.id; we set it via a preHandler in test mode.
// Here we rely on api.ts test affordance: when opts.inject and header x-test-account is set.

let app: FastifyInstance;
beforeEach(async () => {
  app = await startApi({ inject: true });
});

function acct(mb: number): number {
  return (db.prepare('SELECT account_id FROM mailboxes WHERE id = ?').get(mb) as { account_id: number }).account_id;
}

describe('connections routes', () => {
  it('GET /api/connections lists the account connections', async () => {
    const mb = seedMailbox('alice@gmail.com'); // account 1
    upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const res = await app.inject({
      method: 'GET', url: '/api/connections', headers: { 'x-test-account': '1', 'x-test-user': '1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ provider: 'gmail', email: 'alice@gmail.com' });
  });

  it('DELETE /api/connections/:id removes the row, keeps the mailbox', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const res = await app.inject({
      method: 'DELETE', url: `/api/connections/${id}`, headers: { 'x-test-account': '1', 'x-test-user': '1' },
    });
    expect(res.statusCode).toBe(200);
    expect(db.prepare('SELECT 1 FROM connections WHERE id = ?').get(id)).toBeUndefined();
    expect(db.prepare('SELECT 1 FROM mailboxes WHERE id = ?').get(mb)).toBeTruthy();
  });

  it('DELETE returns 404 for a connection on another account', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const res = await app.inject({
      method: 'DELETE', url: `/api/connections/${id}`, headers: { 'x-test-account': '999', 'x-test-user': '999' },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

NOTE: This test assumes a small test affordance in `api.ts`: in `inject` mode, read `x-test-account`/`x-test-user` headers into `req.account`/`req.user`. Add it in Step 10.3 so these routes (and future ones) are testable without a full login. If the existing test suite already provides an auth seam (check how `oauth-gmail-routes.test.ts` and other route tests authenticate), use that instead and drop the header affordance.

- [ ] **Step 10.2: Run; expect FAIL**

Run: `npm test --workspace=server -- connections-routes`
Expected: FAIL — route not registered (404 for `/api/connections`).

- [ ] **Step 10.3: Add the inject-mode auth seam to `server/src/api.ts`**

Inside `startApi`, in the `preHandler` hook, BEFORE the `requireAuth` call, add a test-only shortcut (guarded by `opts.inject`):
```ts
  app.addHook('preHandler', async (req, reply) => {
    if (PUBLIC_PREFIXES.some((p) => req.url === p || req.url.startsWith(p + '?'))) return;
    if (opts.inject) {
      const a = req.headers['x-test-account'];
      const u = req.headers['x-test-user'];
      if (a) {
        (req as any).account = { id: Number(a) };
        (req as any).user = { id: Number(u ?? a) };
        return;
      }
    }
    await requireAuth(req as any, reply as any);
  });
```
(If a cleaner existing test-auth seam exists, prefer it and skip this.)

- [ ] **Step 10.4: Implement `server/src/routes/connections.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { listConnectionsForAccount, deleteConnection } from '../connections-repo.js';

export async function connectionsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/connections', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    return listConnectionsForAccount(accountId);
  });

  app.delete('/api/connections/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const id = Number((req.params as { id: string }).id);
    const owned = db
      .prepare('SELECT 1 FROM connections WHERE id = ? AND account_id = ?')
      .get(id, accountId);
    if (!owned) return reply.code(404).send({ error: 'connection not found' });
    deleteConnection(id);
    return { ok: true };
  });
}
```

- [ ] **Step 10.5: Register in `server/src/api.ts`**

Add import:
```ts
import { connectionsRoutes } from './routes/connections.js';
```
Register alongside the others:
```ts
  await app.register(connectionsRoutes);
```

- [ ] **Step 10.6: Run; expect PASS**

Run: `npm test --workspace=server -- connections-routes`
Expected: 3 passed.

- [ ] **Step 10.7: Run the full server suite**

Run: `npm test --workspace=server`
Expected: all green.

- [ ] **Step 10.8: Commit**

```bash
git add server/src/routes/connections.ts server/src/api.ts server/test/connections-routes.test.ts
git commit -m "feat(connections): list + disconnect API"
```

---

## Task 11: Web — Connections UI

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`
- Create: `web/src/components/ConnectionsPanel.tsx`
- Create: `web/src/components/__tests__/ConnectionsPanel.test.tsx`
- Modify: `web/src/components/MailboxManager.tsx`

- [ ] **Step 11.1: Add the `Connection` type to `web/src/types.ts`**

```ts
export type Connection = {
  id: number;
  provider: 'gmail' | 'outlook';
  email: string;
  status: 'active' | 'needs_reconnect' | 'paused';
  lastPolledAt: number | null;
  lastError: string | null;
  createdAt: number;
};
```

- [ ] **Step 11.2: Add client methods to `web/src/api.ts`**

Add a local import of the type at the top (alongside other `web/src/types` imports if present, else add):
```ts
import type { Connection } from './types';
```
Add to the `api` object (e.g. after the `domains` group):
```ts
  // connections (Gmail/Outlook aggregator)
  connections: () => handle(client.get<Connection[]>('/api/connections')),
  disconnect: (id: number) => handle(client.delete<{ ok: true }>(`/api/connections/${id}`)),
  gmailConnectUrl: () => '/api/oauth/gmail/start',
```

- [ ] **Step 11.3: Write the failing component test**

`web/src/components/__tests__/ConnectionsPanel.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectionsPanel from '../ConnectionsPanel';

vi.mock('../../api', () => ({
  api: {
    connections: vi.fn(),
    disconnect: vi.fn(),
    gmailConnectUrl: () => '/api/oauth/gmail/start',
  },
}));
import { api } from '../../api';

describe('ConnectionsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists connections returned by the API', async () => {
    vi.mocked(api.connections).mockResolvedValue([
      { id: 1, provider: 'gmail', email: 'alice@gmail.com', status: 'active', lastPolledAt: null, lastError: null, createdAt: 1 },
    ]);
    render(<ConnectionsPanel />);
    expect(await screen.findByText('alice@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('shows a Connect Gmail button when empty', async () => {
    vi.mocked(api.connections).mockResolvedValue([]);
    render(<ConnectionsPanel />);
    expect(await screen.findByRole('link', { name: /connect gmail/i })).toBeInTheDocument();
  });

  it('disconnects a connection after confirm', async () => {
    vi.mocked(api.connections)
      .mockResolvedValueOnce([
        { id: 7, provider: 'gmail', email: 'bob@gmail.com', status: 'active', lastPolledAt: null, lastError: null, createdAt: 1 },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(api.disconnect).mockResolvedValue({ ok: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ConnectionsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /disconnect/i }));
    await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith(7));
  });
});
```

- [ ] **Step 11.4: Run; expect FAIL**

Run: `npm run test:run --workspace=web -- ConnectionsPanel`
Expected: FAIL — `Cannot find module '../ConnectionsPanel'`.

- [ ] **Step 11.5: Implement `web/src/components/ConnectionsPanel.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Connection } from '../types';

export default function ConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnections(await api.connections());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDisconnect = async (c: Connection) => {
    if (!window.confirm(`Disconnect ${c.email}? Imported mail is kept.`)) return;
    await api.disconnect(c.id);
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Connected accounts</h3>
        <a
          href={api.gmailConnectUrl()}
          className="px-3 py-1.5 rounded bg-zsaccent text-zsbg text-sm font-medium"
        >
          Connect Gmail
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-zsmuted">Loading…</p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-zsmuted">No connected accounts yet.</p>
      ) : (
        <ul className="divide-y divide-zsborder">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{c.email}</div>
                <div className="text-xs text-zsmuted">
                  {c.provider} · <span>{c.status}</span>
                  {c.status === 'needs_reconnect' && (
                    <a href={api.gmailConnectUrl()} className="ml-2 text-zsaccent underline">
                      Reconnect
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDisconnect(c)}
                className="text-xs px-2 py-1 rounded border border-zsborder hover:bg-zsborder/40"
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 11.6: Run; expect PASS**

Run: `npm run test:run --workspace=web -- ConnectionsPanel`
Expected: 3 passed.

- [ ] **Step 11.7: Mount the panel in `web/src/components/MailboxManager.tsx`**

Add the import near the other component imports:
```tsx
import ConnectionsPanel from './ConnectionsPanel';
```
Render `<ConnectionsPanel />` inside the MailboxManager modal body, after the mailbox list section (place it within the existing scrollable content container, separated by the same divider/`HardRule` style the file already uses for sections). Keep the change minimal — a single mount point.

- [ ] **Step 11.8: Run the full web suite + build**

Run: `npm run test:run --workspace=web`
Expected: all green.
Run: `npm run build --workspace=web`
Expected: build succeeds (exit 0).

- [ ] **Step 11.9: Commit**

```bash
git add web/src/types.ts web/src/api.ts web/src/components/ConnectionsPanel.tsx web/src/components/__tests__/ConnectionsPanel.test.tsx web/src/components/MailboxManager.tsx
git commit -m "feat(connections): Connections management UI (connect/list/disconnect)"
```

---

## Task 12: Final verification

- [ ] **Step 12.1: Full server suite**

Run: `npm test --workspace=server`
Expected: all green.

- [ ] **Step 12.2: Full web suite**

Run: `npm run test:run --workspace=web`
Expected: all green.

- [ ] **Step 12.3: Both builds**

Run: `npm run build --workspace=server && npm run build --workspace=web`
Expected: both succeed (exit 0).

- [ ] **Step 12.4: Manual smoke note (operator)**

Document in the PR description: to exercise end-to-end, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Testing-mode OAuth app with redirect `${PUBLIC_BASE_URL}/api/oauth/gmail/callback`, scope `gmail.readonly`, your address added as a test user) and `PUBLIC_BASE_URL`, then: open settings → Connect Gmail → consent → send yourself a new Gmail → within `CONNECTION_POLL_INTERVAL_SEC` it appears in the `alice@gmail.com` mailbox (quarantine unless whitelisted).

---

## Self-Review

**1. Spec coverage:**
- §6 connections table → Task 1. §7 token vault → Task 2 + secret loader Task 0. §8 connector interface + Gmail adapter → Tasks 4–5. §9 OAuth flow → Task 7. §10 sync worker → Task 8 + boot Task 9. §11 Connections UI → Task 11 + API Task 10. §12 config/env → Task 0. §13 test strategy → tests across Tasks 2,3,4,6,7,8,10,11. §3 forward-only cursor seeding → Task 4 `verifyIdentity` returns current `historyId`, used as seed in Task 7 callback. Reconnect-in-place → Task 6 `upsertConnection`. Disconnect keeps mail → Task 10 + Task 11 confirm copy.
- Gap check: send-rewrite, Outlook, backfill, push are explicitly out of scope (spec §2) — no tasks, intended.

**2. Placeholder scan:** No "TBD"/"handle errors"/"similar to" — every code step has complete code. The one soft spot (Task 11.7 mount point, Task 10.1/10.3 auth seam) gives explicit instructions plus a fallback to the existing pattern; acceptable because it depends on local file structure the implementer can see.

**3. Type consistency:** `OAuthTokens` {accessToken, refreshToken, expiresAt} used identically in types.ts, gmail.ts, gmail-google.ts, connections-repo.ts, oauth-gmail.ts, connection-poller.ts. `GmailApi` {getProfile, listHistory, getRawMessage} consistent between types.ts, the stub tests, and gmail-google.ts. `ProviderConnector` methods (`verifyIdentity`, `ensureFresh`, `fetchSince`) consistent across connector, routes, poller, and tests. `Connection` row type (server db.ts) vs `ConnectionSummary`/web `Connection` (camelCase view model) are intentionally distinct — repo maps between them. Repo function names (`upsertConnection`, `getDecryptedTokens`, `persistTokens`, `listConnectionsForAccount`, `recordPollSuccess`, `recordPollFailure`, `markNeedsReconnect`, `deleteConnection`) used identically in poller, routes, and their tests.
