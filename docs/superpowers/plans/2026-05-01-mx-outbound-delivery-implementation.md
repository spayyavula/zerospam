# MX Outbound Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Resend-style transactional sending API to ZeroSpam: callers POST a message to `/api/send` with an API key, the server enqueues it in a SQLite-backed `outbox`, and a background worker performs direct-MX delivery with DKIM signing, opportunistic STARTTLS, and exponential backoff on transient failures.

**Architecture:** Single-process worker for MVP (same shape as `digester.tick`). The `outbox` table is the queue boundary so workers can be split into a sibling workspace later without a rewrite. DKIM keys per sending domain are reused from `server/src/dkim.ts`. Async bounce parsing, suppression lists, complaint feedback, and webhooks are deferred — bounces this version recognises are only the synchronous 5xx response from the receiving MX.

**Tech Stack:** TypeScript / Node 20 / Fastify / SQLite (`node:sqlite` `DatabaseSync`). `nodemailer` for the SMTP client (already a dep — uses its `direct` configuration with our own MX resolution). `node:dns/promises` for MX lookups. `smtp-server` for the in-test fake MX (already a dep on the inbound side). `vitest` for tests.

**Locked decisions** (set during brainstorming, do not re-litigate):
1. Auth on `POST /api/send`: API keys (`Authorization: Bearer zsk_...`).
2. `from` validation: domain-level. Caller must own the domain via a `domains` row they're an owner of (Phase A auth), not a specific mailbox.
3. SMTP `5xx` is a hard fail. No per-code retry.
4. STARTTLS opportunistically; no cert verification.

---

## Reference Documents

- Existing inbound SMTP server: `server/src/smtp.ts`
- Existing DKIM helpers: `server/src/dkim.ts`
- Existing outbound (loopback/relay) sender: `server/src/sender.ts`
- Existing scheduler pattern (digester): `server/src/digester.ts`
- Existing auth middleware: `server/src/requireAuth.ts`

## File Structure

**New files:**
- `server/src/outbox.ts` — DB helpers: `enqueue`, `claimDue`, `markDelivered`, `markDeferred`, `markFailed`. Pure SQLite, no I/O outside the DB.
- `server/src/mx-resolver.ts` — `resolveMx(domain)` with TTL cache.
- `server/src/mx-delivery.ts` — `deliver(row)` → `{ outcome, mxHost, response }`. Walks MX list by priority, opens connection, opportunistic STARTTLS, DKIM-signs, classifies SMTP response.
- `server/src/outbox-worker.ts` — `tick()` plus `startOutboxWorker()`.
- `server/src/api-keys.ts` — DB helpers + key generation/hashing.
- `server/src/routes/keys.ts` — `POST /api/keys`, `DELETE /api/keys/:id`, `GET /api/keys`.
- `server/src/requireApiKey.ts` — Fastify pre-handler that reads `Authorization: Bearer` and attaches the user.
- `server/test/outbox.test.ts`
- `server/test/mx-resolver.test.ts`
- `server/test/mx-delivery.test.ts`
- `server/test/outbox-worker.test.ts`
- `server/test/api-keys.test.ts`
- `server/test/api-keys-routes.test.ts`
- `server/test/api-send.test.ts`
- `server/test/helpers/fake-mx.ts` — in-test SMTP server fixture.
- `server/test/helpers/dns-stub.ts` — `vi.mock('node:dns/promises')` helpers.

**Modified files:**
- `server/src/db.ts` — add `outbox` and `api_keys` tables + types.
- `server/src/api.ts` — register `keys` route plugin and the `POST /api/send` / `GET /api/send/:id` routes.
- `server/src/index.ts` — boot `startOutboxWorker()`.
- `server/test/setup.ts` — `DELETE FROM outbox; DELETE FROM api_keys;` in the per-test cleanup.
- `server/vitest.config.ts` — possible new env if we add throttle/timing knobs.

## Test Infrastructure Notes

The MX-delivery code path is the only piece in this plan that talks to a real network endpoint. The strategy is:

- **In-test fake MX server** (`server/test/helpers/fake-mx.ts`): a tiny `smtp-server` listening on a random port (`port: 0`). Test harness exposes the chosen port. The fake supports STARTTLS on demand (not for MVP) and lets each test inject the response it wants (`220` ready, `250` accept, `421` defer, `550` reject, etc.).

- **DNS stub** (`server/test/helpers/dns-stub.ts`): wraps `vi.mock('node:dns/promises', () => ({ resolveMx: stubResolveMx }))` so tests can map a target domain like `example.test` to `[{ exchange: '127.0.0.1', priority: 10 }]` and the harness ports of the fake MX.

- **Worker tests** call `tick()` directly with a stubbed `Date.now()` for retry-window assertions, exactly the same pattern as the digester tests.

- **Send-API tests** use `app.inject()` with `Authorization: Bearer <minted key>` and assert that the row in `outbox` exists with `status='queued'`. Worker behaviour is *not* re-tested at the API layer.

- All tests share the existing `setupFiles: ['./test/setup.ts']` which already wipes the DB between tests; we add the new tables to that wipe list in Task 1.

---

## Task 0: Test infrastructure — fake MX + DNS stub

**Files:**
- Create: `server/test/helpers/fake-mx.ts`
- Create: `server/test/helpers/dns-stub.ts`

This task introduces two test helpers used by Tasks 4–6. There are no source-code tests until Task 1, so the verification here is just that the helpers compile and can be imported.

- [ ] **Step 0.1: Create `server/test/helpers/fake-mx.ts`**

```ts
import { SMTPServer, type SMTPServerSession } from 'smtp-server';
import type { AddressInfo } from 'node:net';

export type FakeMxBehaviour = {
  // Per-recipient response. Default for all addresses is { code: 250 }.
  // Set { code: 4xx } to force a defer or { code: 5xx } to force a hard fail.
  rcpt?: { code: number; message?: string };
  // Response after DATA payload received. Default { code: 250, message: 'OK queued' }.
  data?: { code: number; message?: string };
};

export type ReceivedMessage = {
  envelopeFrom: string;
  envelopeTo: string[];
  raw: Buffer;
  starttls: boolean;
};

export type FakeMx = {
  port: number;
  received: ReceivedMessage[];
  setBehaviour: (b: FakeMxBehaviour) => void;
  close: () => Promise<void>;
};

export async function startFakeMx(initial: FakeMxBehaviour = {}): Promise<FakeMx> {
  let behaviour = { ...initial };
  const received: ReceivedMessage[] = [];

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'],
    onRcptTo(address, _session, callback) {
      if (behaviour.rcpt && (behaviour.rcpt.code < 200 || behaviour.rcpt.code >= 300)) {
        const err: any = new Error(behaviour.rcpt.message ?? 'rcpt rejected');
        err.responseCode = behaviour.rcpt.code;
        return callback(err);
      }
      callback();
    },
    onData(stream, session: SMTPServerSession, callback) {
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(Buffer.from(c)));
      stream.on('end', () => {
        if (behaviour.data && (behaviour.data.code < 200 || behaviour.data.code >= 300)) {
          const err: any = new Error(behaviour.data.message ?? 'data rejected');
          err.responseCode = behaviour.data.code;
          return callback(err);
        }
        received.push({
          envelopeFrom: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
          envelopeTo: session.envelope.rcptTo.map((r) => r.address),
          raw: Buffer.concat(chunks),
          starttls: !!session.tlsOptions,
        });
        callback();
      });
    },
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.server.address() as AddressInfo).port;

  return {
    port,
    received,
    setBehaviour: (b) => {
      behaviour = { ...b };
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
```

- [ ] **Step 0.2: Create `server/test/helpers/dns-stub.ts`**

```ts
import { vi } from 'vitest';

type MxRecord = { exchange: string; priority: number };

const overrides = new Map<string, MxRecord[]>();

vi.mock('node:dns/promises', async (importOriginal) => {
  const real = (await importOriginal()) as typeof import('node:dns/promises');
  return {
    ...real,
    resolveMx: async (host: string) => {
      const o = overrides.get(host.toLowerCase());
      if (o) return o;
      throw Object.assign(new Error(`no override for ${host}`), { code: 'ENOTFOUND' });
    },
  };
});

export function setMx(domain: string, records: MxRecord[]): void {
  overrides.set(domain.toLowerCase(), records);
}

export function clearMx(): void {
  overrides.clear();
}
```

- [ ] **Step 0.3: Smoke import**

Add a temporary file `server/test/helpers/_smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startFakeMx } from './fake-mx.js';
import { setMx, clearMx } from './dns-stub.js';

describe('test helpers', () => {
  it('fake MX boots and shuts down', async () => {
    const mx = await startFakeMx();
    expect(mx.port).toBeGreaterThan(0);
    await mx.close();
  });
  it('dns stub stores overrides', () => {
    setMx('example.test', [{ exchange: '127.0.0.1', priority: 10 }]);
    clearMx();
  });
});
```

- [ ] **Step 0.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/helpers/_smoke.test.ts
```
Expected: 2 passed.

- [ ] **Step 0.5: Delete the smoke file and commit**

```bash
rm server/test/helpers/_smoke.test.ts
git add server/test/helpers/fake-mx.ts server/test/helpers/dns-stub.ts
git commit -m "test(outbox): fake MX server + DNS stub helpers"
```

---

## Task 1: `outbox` and `api_keys` tables + types (DB migrations)

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/test/setup.ts`
- Create: `server/test/db-migrations-outbox.test.ts`

- [ ] **Step 1.1: Write the failing schema test**

`server/test/db-migrations-outbox.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('outbox + api_keys schema', () => {
  it('outbox has all required columns', () => {
    const cols = db.prepare('PRAGMA table_info(outbox)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    for (const c of [
      'id', 'mailbox_id', 'from_address', 'to_addresses', 'subject',
      'body_text', 'body_html', 'status', 'attempts', 'max_attempts',
      'next_attempt_at', 'last_error', 'delivered_to_mx',
      'created_at', 'delivered_at', 'failed_at',
    ]) {
      expect(names.has(c), `outbox missing: ${c}`).toBe(true);
    }
  });

  it('api_keys has all required columns', () => {
    const cols = db.prepare('PRAGMA table_info(api_keys)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    for (const c of [
      'id', 'user_id', 'name', 'key_hash', 'prefix',
      'created_at', 'last_used_at', 'revoked_at',
    ]) {
      expect(names.has(c), `api_keys missing: ${c}`).toBe(true);
    }
  });
});
```

- [ ] **Step 1.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/db-migrations-outbox.test.ts
```
Expected: FAIL — both tables missing.

- [ ] **Step 1.3: Add the schema to `server/src/db.ts`**

Find the line right before `db.exec(SCHEMA);` (the constant ends with `audit_log` indices). Inside the `SCHEMA` template literal, append before the closing backtick:

```sql
CREATE TABLE IF NOT EXISTS outbox (
  id              TEXT PRIMARY KEY,
  mailbox_id      INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  from_address    TEXT NOT NULL,
  to_addresses    TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_text       TEXT,
  body_html       TEXT,
  status          TEXT NOT NULL CHECK(status IN ('queued','sending','delivered','deferred','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 8,
  next_attempt_at INTEGER NOT NULL,
  last_error      TEXT,
  delivered_to_mx TEXT,
  created_at      INTEGER NOT NULL,
  delivered_at    INTEGER,
  failed_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_mailbox ON outbox(mailbox_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  prefix        TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  revoked_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, revoked_at);
```

Then append types at the bottom of `db.ts`:
```ts
export type OutboxStatus = 'queued' | 'sending' | 'delivered' | 'deferred' | 'failed';

export type OutboxRow = {
  id: string;
  mailbox_id: number;
  from_address: string;
  to_addresses: string; // JSON array
  subject: string;
  body_text: string | null;
  body_html: string | null;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  delivered_to_mx: string | null;
  created_at: number;
  delivered_at: number | null;
  failed_at: number | null;
};

export type ApiKeyRow = {
  id: number;
  user_id: number;
  name: string;
  key_hash: string;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
};
```

- [ ] **Step 1.4: Extend the per-test cleanup**

In `server/test/setup.ts`, add to the `beforeEach` SQL block (preserve order — outbox before audit_log so the existing list remains tidy):

Find:
```ts
    DELETE FROM mailboxes;
    DELETE FROM domains;
```

Replace with:
```ts
    DELETE FROM outbox;
    DELETE FROM api_keys;
    DELETE FROM mailboxes;
    DELETE FROM domains;
```

- [ ] **Step 1.5: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: all green; new schema test passes; existing tests unaffected.

- [ ] **Step 1.6: Commit**

```bash
git add server/src/db.ts server/test/setup.ts server/test/db-migrations-outbox.test.ts
git commit -m "feat(outbox): outbox + api_keys schema + types"
```

---

## Task 2: `outbox.ts` helpers — enqueue, claim, mark-status (TDD)

**Files:**
- Create: `server/src/outbox.ts`
- Create: `server/test/outbox.test.ts`

- [ ] **Step 2.1: Write the failing test**

`server/test/outbox.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  enqueue, claimDue, markDelivered, markDeferred, markFailed,
  type EnqueueInput,
} from '../src/outbox.js';
import { seedMailbox } from './helpers.js';
import { db } from '../src/db.js';

function input(over: Partial<EnqueueInput> = {}): EnqueueInput {
  return {
    mailboxId: 0, // overridden in tests
    from: 'sender@example.com',
    to: ['recipient@target.test'],
    subject: 'hi',
    text: 'hello',
    ...over,
  };
}

describe('outbox helpers', () => {
  it('enqueue inserts a queued row with status=queued and attempts=0', () => {
    const mid = seedMailbox('sender@example.com');
    const id = enqueue(input({ mailboxId: mid }));
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as any;
    expect(row.status).toBe('queued');
    expect(row.attempts).toBe(0);
    expect(row.next_attempt_at).toBeLessThanOrEqual(Date.now());
    expect(JSON.parse(row.to_addresses)).toEqual(['recipient@target.test']);
  });

  it('claimDue returns rows whose next_attempt_at <= now and status in (queued, deferred)', () => {
    const mid = seedMailbox('sender@example.com');
    const idDue = enqueue(input({ mailboxId: mid }));
    const idFuture = enqueue(input({ mailboxId: mid }));
    db.prepare('UPDATE outbox SET next_attempt_at = ? WHERE id = ?').run(Date.now() + 60000, idFuture);

    const claimed = claimDue(10);
    expect(claimed.map((r) => r.id)).toEqual([idDue]);
    const row = db.prepare("SELECT status FROM outbox WHERE id = ?").get(idDue) as { status: string };
    expect(row.status).toBe('sending');
  });

  it('claimDue is concurrency-safe: two callers do not claim the same row', () => {
    const mid = seedMailbox('sender@example.com');
    enqueue(input({ mailboxId: mid }));
    enqueue(input({ mailboxId: mid }));
    const a = claimDue(10);
    const b = claimDue(10);
    expect(a.length + b.length).toBe(2);
    const overlap = a.filter((x) => b.some((y) => y.id === x.id));
    expect(overlap).toHaveLength(0);
  });

  it('markDelivered transitions sending → delivered', () => {
    const mid = seedMailbox('sender@example.com');
    const id = enqueue(input({ mailboxId: mid }));
    claimDue(10);
    markDelivered(id, 'mx1.target.test');
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as any;
    expect(row.status).toBe('delivered');
    expect(row.delivered_at).toBeGreaterThan(0);
    expect(row.delivered_to_mx).toBe('mx1.target.test');
  });

  it('markDeferred increments attempts and pushes next_attempt_at into the future', () => {
    const mid = seedMailbox('sender@example.com');
    const id = enqueue(input({ mailboxId: mid }));
    claimDue(10);
    const before = Date.now();
    markDeferred(id, '421 try later', 60_000);
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as any;
    expect(row.status).toBe('deferred');
    expect(row.attempts).toBe(1);
    expect(row.next_attempt_at).toBeGreaterThanOrEqual(before + 60_000 - 50);
    expect(row.last_error).toBe('421 try later');
  });

  it('markFailed transitions to failed with timestamp + error', () => {
    const mid = seedMailbox('sender@example.com');
    const id = enqueue(input({ mailboxId: mid }));
    claimDue(10);
    markFailed(id, '550 user unknown');
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as any;
    expect(row.status).toBe('failed');
    expect(row.failed_at).toBeGreaterThan(0);
    expect(row.last_error).toBe('550 user unknown');
  });
});
```

- [ ] **Step 2.2: Run; expect FAIL**

Expected: `Cannot find module '../src/outbox.js'`.

- [ ] **Step 2.3: Implement `server/src/outbox.ts`**

```ts
// Pure SQLite helpers for the outbound queue. No I/O outside the DB.
import { nanoid } from 'nanoid';
import { db, runInTx, type OutboxRow } from './db.js';

export type EnqueueInput = {
  mailboxId: number;
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  maxAttempts?: number;
};

const insertStmt = db.prepare(
  `INSERT INTO outbox (
     id, mailbox_id, from_address, to_addresses, subject,
     body_text, body_html, status, attempts, max_attempts,
     next_attempt_at, created_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)`,
);

export function enqueue(i: EnqueueInput): string {
  const id = nanoid();
  const now = Date.now();
  insertStmt.run(
    id,
    i.mailboxId,
    i.from.toLowerCase(),
    JSON.stringify(i.to.map((s) => s.toLowerCase())),
    i.subject,
    i.text ?? null,
    i.html ?? null,
    i.maxAttempts ?? 8,
    now,
    now,
  );
  return id;
}

const selectDueStmt = db.prepare(
  `SELECT * FROM outbox
    WHERE status IN ('queued','deferred')
      AND next_attempt_at <= ?
    ORDER BY next_attempt_at ASC
    LIMIT ?`,
);

const markSendingStmt = db.prepare(
  `UPDATE outbox SET status = 'sending' WHERE id = ? AND status IN ('queued','deferred')`,
);

// Claim up to `limit` due rows by transitioning them to 'sending' atomically.
// Returns the rows we actually flipped (concurrency-safe).
export function claimDue(limit: number): OutboxRow[] {
  return runInTx(() => {
    const candidates = selectDueStmt.all(Date.now(), limit) as OutboxRow[];
    const claimed: OutboxRow[] = [];
    for (const r of candidates) {
      const result = markSendingStmt.run(r.id);
      if (result.changes === 1) claimed.push({ ...r, status: 'sending' });
    }
    return claimed;
  });
}

const markDeliveredStmt = db.prepare(
  `UPDATE outbox
      SET status = 'delivered', delivered_at = ?, delivered_to_mx = ?, last_error = NULL
    WHERE id = ?`,
);

export function markDelivered(id: string, mxHost: string): void {
  markDeliveredStmt.run(Date.now(), mxHost, id);
}

const markDeferredStmt = db.prepare(
  `UPDATE outbox
      SET status = 'deferred',
          attempts = attempts + 1,
          last_error = ?,
          next_attempt_at = ?
    WHERE id = ?`,
);

export function markDeferred(id: string, reason: string, backoffMs: number): void {
  markDeferredStmt.run(reason.slice(0, 500), Date.now() + backoffMs, id);
}

const markFailedStmt = db.prepare(
  `UPDATE outbox
      SET status = 'failed', failed_at = ?, last_error = ?
    WHERE id = ?`,
);

export function markFailed(id: string, reason: string): void {
  markFailedStmt.run(Date.now(), reason.slice(0, 500), id);
}
```

- [ ] **Step 2.4: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 2.5: Commit**

```bash
git add server/src/outbox.ts server/test/outbox.test.ts
git commit -m "feat(outbox): enqueue/claimDue/markX helpers"
```

---

## Task 3: `mx-resolver.ts` with TTL cache (TDD)

**Files:**
- Create: `server/src/mx-resolver.ts`
- Create: `server/test/mx-resolver.test.ts`

- [ ] **Step 3.1: Write the failing test**

`server/test/mx-resolver.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setMx, clearMx } from './helpers/dns-stub.js';
import { resolveMx, _resetCache } from '../src/mx-resolver.js';

beforeEach(() => {
  clearMx();
  _resetCache();
});

describe('resolveMx', () => {
  it('returns sorted MX records (priority ascending)', async () => {
    setMx('target.test', [
      { exchange: 'mx2.target.test', priority: 20 },
      { exchange: 'mx1.target.test', priority: 10 },
    ]);
    const got = await resolveMx('target.test');
    expect(got.map((r) => r.exchange)).toEqual(['mx1.target.test', 'mx2.target.test']);
  });

  it('caches successful lookups within the TTL window', async () => {
    let calls = 0;
    setMx('target.test', [{ exchange: 'mx1.target.test', priority: 10 }]);
    const first = await resolveMx('target.test');
    setMx('target.test', [{ exchange: 'mx2.target.test', priority: 10 }]); // would be different
    const second = await resolveMx('target.test');
    expect(second).toEqual(first); // cache hit
  });

  it('throws on lookup failure', async () => {
    await expect(resolveMx('nope.test')).rejects.toThrow();
  });
});
```

- [ ] **Step 3.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/mx-resolver.test.ts
```
Expected: module not found.

- [ ] **Step 3.3: Implement `server/src/mx-resolver.ts`**

```ts
import { resolveMx as dnsResolveMx } from 'node:dns/promises';

export type MxRecord = { exchange: string; priority: number };

const TTL_MS = 5 * 60 * 1000; // 5 minutes
type Entry = { records: MxRecord[]; expiresAt: number };
const cache = new Map<string, Entry>();

export async function resolveMx(domain: string): Promise<MxRecord[]> {
  const key = domain.toLowerCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.records;

  const records = (await dnsResolveMx(domain)).slice().sort((a, b) => a.priority - b.priority);
  cache.set(key, { records, expiresAt: now + TTL_MS });
  return records;
}

// Test-only reset.
export function _resetCache(): void {
  cache.clear();
}
```

- [ ] **Step 3.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/mx-resolver.test.ts
```

- [ ] **Step 3.5: Commit**

```bash
git add server/src/mx-resolver.ts server/test/mx-resolver.test.ts
git commit -m "feat(outbox): MX resolver with TTL cache"
```

---

## Task 4: `mx-delivery.ts` happy path + classification (TDD)

**Files:**
- Create: `server/src/mx-delivery.ts`
- Create: `server/test/mx-delivery.test.ts`

This task implements **plain SMTP without TLS** and without DKIM (Task 5 layers those in). The point of splitting is to keep test surface small per commit.

- [ ] **Step 4.1: Write the failing test**

`server/test/mx-delivery.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startFakeMx, type FakeMx } from './helpers/fake-mx.js';
import { setMx, clearMx } from './helpers/dns-stub.js';
import { _resetCache } from '../src/mx-resolver.js';
import { deliver, type DeliveryInput } from '../src/mx-delivery.js';

let mx: FakeMx;

beforeEach(async () => {
  clearMx();
  _resetCache();
  mx = await startFakeMx();
  setMx('target.test', [{ exchange: '127.0.0.1', priority: 10 }]);
});

afterEach(async () => {
  await mx.close();
});

const baseInput: Omit<DeliveryInput, 'connectPort'> = {
  from: 'alice@example.com',
  to: ['bob@target.test'],
  raw: Buffer.from(
    'From: alice@example.com\r\nTo: bob@target.test\r\nSubject: hi\r\n\r\nbody',
    'utf8',
  ),
};

describe('mx-delivery (no TLS, no DKIM)', () => {
  it('delivers via direct MX and returns delivered outcome', async () => {
    const r = await deliver({ ...baseInput, connectPort: mx.port });
    expect(r.outcome).toBe('delivered');
    expect(r.mxHost).toBe('127.0.0.1');
    expect(mx.received).toHaveLength(1);
    expect(mx.received[0].envelopeFrom).toBe('alice@example.com');
    expect(mx.received[0].envelopeTo).toEqual(['bob@target.test']);
  });

  it('classifies a 4xx response as defer', async () => {
    mx.setBehaviour({ rcpt: { code: 421, message: 'try later' } });
    const r = await deliver({ ...baseInput, connectPort: mx.port });
    expect(r.outcome).toBe('defer');
    expect(r.response).toMatch(/421/);
  });

  it('classifies a 5xx response as fail', async () => {
    mx.setBehaviour({ rcpt: { code: 550, message: 'no such user' } });
    const r = await deliver({ ...baseInput, connectPort: mx.port });
    expect(r.outcome).toBe('fail');
    expect(r.response).toMatch(/550/);
  });

  it('returns defer when MX list is empty', async () => {
    setMx('empty.test', []);
    const r = await deliver({ ...baseInput, to: ['bob@empty.test'], connectPort: mx.port });
    expect(r.outcome).toBe('defer');
  });
});
```

- [ ] **Step 4.2: Run; expect FAIL**

Expected: module not found.

- [ ] **Step 4.3: Implement `server/src/mx-delivery.ts`**

```ts
// Direct-MX SMTP delivery. Walks MX list by priority, opens a connection,
// pipes the raw message, and classifies the SMTP response.
//
// MVP: no STARTTLS, no DKIM signing here. Task 5 layers those in.
//
// Outcome contract:
//   - 'delivered': server returned 2xx on DATA end-of-data
//   - 'defer':     transient (4xx, network error, no MX records). Worker should retry.
//   - 'fail':      permanent (5xx). Worker should hard-fail.

import nodemailer from 'nodemailer';
import { resolveMx } from './mx-resolver.js';

export type DeliveryInput = {
  from: string;
  to: string[];
  raw: Buffer;
  // connectPort is for tests only. In production we always connect to port 25.
  connectPort?: number;
};

export type DeliveryOutcome = 'delivered' | 'defer' | 'fail';

export type DeliveryResult = {
  outcome: DeliveryOutcome;
  mxHost: string | null;
  response: string;
};

function classifyError(err: any): DeliveryOutcome {
  const code = err?.responseCode;
  if (typeof code === 'number') {
    if (code >= 500 && code < 600) return 'fail';
    if (code >= 400 && code < 500) return 'defer';
  }
  // Network / unknown errors are transient.
  return 'defer';
}

export async function deliver(input: DeliveryInput): Promise<DeliveryResult> {
  // Group recipients by domain. MVP supports a single recipient domain per delivery.
  const domains = new Set(input.to.map((t) => t.split('@')[1].toLowerCase()));
  if (domains.size !== 1) {
    return { outcome: 'fail', mxHost: null, response: 'multiple recipient domains not supported' };
  }
  const [domain] = [...domains];

  let records;
  try {
    records = await resolveMx(domain);
  } catch (err: any) {
    return { outcome: 'defer', mxHost: null, response: `mx lookup failed: ${err?.message ?? err}` };
  }
  if (records.length === 0) {
    return { outcome: 'defer', mxHost: null, response: 'no mx records' };
  }

  let lastResponse = '';
  for (const rec of records) {
    const transport = nodemailer.createTransport({
      host: rec.exchange,
      port: input.connectPort ?? 25,
      secure: false,
      ignoreTLS: true,
      tls: { rejectUnauthorized: false },
    });
    try {
      const info = await transport.sendMail({
        envelope: { from: input.from, to: input.to },
        raw: input.raw,
      });
      return { outcome: 'delivered', mxHost: rec.exchange, response: info.response ?? 'ok' };
    } catch (err: any) {
      const outcome = classifyError(err);
      lastResponse = `${err?.responseCode ?? '?'} ${err?.message ?? err}`;
      if (outcome === 'fail') {
        return { outcome: 'fail', mxHost: rec.exchange, response: lastResponse };
      }
      // Defer: try the next MX in priority order.
    } finally {
      transport.close();
    }
  }
  return { outcome: 'defer', mxHost: records[records.length - 1].exchange, response: lastResponse };
}
```

- [ ] **Step 4.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/mx-delivery.test.ts
```

- [ ] **Step 4.5: Commit**

```bash
git add server/src/mx-delivery.ts server/test/mx-delivery.test.ts
git commit -m "feat(outbox): direct-MX SMTP delivery (plain, no TLS, no DKIM yet)"
```

---

## Task 5: Layer DKIM signing into delivery (TDD)

**Files:**
- Modify: `server/src/mx-delivery.ts`
- Create: `server/test/mx-delivery-dkim.test.ts`

The plain delivery path takes a raw RFC822 buffer. We extend `DeliveryInput` with a `dkim` option that tells the transport to sign with the supplied DKIM key. Tests assert that the bytes received by the fake MX include a `DKIM-Signature:` header and that the `d=` tag matches the sender domain.

- [ ] **Step 5.1: Write the failing test**

`server/test/mx-delivery-dkim.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startFakeMx, type FakeMx } from './helpers/fake-mx.js';
import { setMx, clearMx } from './helpers/dns-stub.js';
import { _resetCache } from '../src/mx-resolver.js';
import { deliver } from '../src/mx-delivery.js';
import { generateDkimKeyPair } from '../src/dkim.js';

let mx: FakeMx;

beforeEach(async () => {
  clearMx();
  _resetCache();
  mx = await startFakeMx();
  setMx('target.test', [{ exchange: '127.0.0.1', priority: 10 }]);
});

afterEach(async () => {
  await mx.close();
});

describe('mx-delivery DKIM signing', () => {
  it('signs the message with the supplied DKIM key when provided', async () => {
    const { privateKey } = generateDkimKeyPair();
    const r = await deliver({
      from: 'alice@example.com',
      to: ['bob@target.test'],
      raw: Buffer.from(
        'From: alice@example.com\r\nTo: bob@target.test\r\nSubject: hi\r\n\r\nbody',
        'utf8',
      ),
      connectPort: mx.port,
      dkim: { domainName: 'example.com', keySelector: 'zs1', privateKey },
    });
    expect(r.outcome).toBe('delivered');
    const body = mx.received[0].raw.toString('utf8');
    expect(body).toMatch(/DKIM-Signature:.*d=example\.com/);
    expect(body).toMatch(/s=zs1/);
  });

  it('sends without a DKIM-Signature header when no key is supplied', async () => {
    const r = await deliver({
      from: 'alice@example.com',
      to: ['bob@target.test'],
      raw: Buffer.from(
        'From: alice@example.com\r\nTo: bob@target.test\r\nSubject: hi\r\n\r\nbody',
        'utf8',
      ),
      connectPort: mx.port,
    });
    expect(r.outcome).toBe('delivered');
    const body = mx.received[0].raw.toString('utf8');
    expect(body).not.toMatch(/DKIM-Signature:/);
  });
});
```

- [ ] **Step 5.2: Run; expect FAIL**

Expected: TS error — `DeliveryInput` does not have a `dkim` field.

- [ ] **Step 5.3: Extend `mx-delivery.ts` with DKIM**

In `server/src/mx-delivery.ts`, extend the type:
```ts
export type DeliveryInput = {
  from: string;
  to: string[];
  raw: Buffer;
  connectPort?: number;
  dkim?: {
    domainName: string;
    keySelector: string;
    privateKey: string;
  };
};
```

In the per-MX loop, replace the `await transport.sendMail({...})` call body with:
```ts
      const info = await transport.sendMail({
        envelope: { from: input.from, to: input.to },
        raw: input.raw,
        dkim: input.dkim
          ? {
              domainName: input.dkim.domainName,
              keySelector: input.dkim.keySelector,
              privateKey: input.dkim.privateKey,
            }
          : undefined,
      });
```

- [ ] **Step 5.4: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 5.5: Commit**

```bash
git add server/src/mx-delivery.ts server/test/mx-delivery-dkim.test.ts
git commit -m "feat(outbox): DKIM-sign messages on delivery when key is provided"
```

---

## Task 6: `outbox-worker.tick` + retry policy (TDD)

**Files:**
- Create: `server/src/outbox-worker.ts`
- Create: `server/test/outbox-worker.test.ts`

- [ ] **Step 6.1: Write the failing test**

`server/test/outbox-worker.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startFakeMx, type FakeMx } from './helpers/fake-mx.js';
import { setMx, clearMx } from './helpers/dns-stub.js';
import { _resetCache } from '../src/mx-resolver.js';
import { tick, _setConnectPortOverride } from '../src/outbox-worker.js';
import { enqueue } from '../src/outbox.js';
import { seedMailbox, seedDomain } from './helpers.js';
import { db } from '../src/db.js';

let mx: FakeMx;

beforeEach(async () => {
  clearMx();
  _resetCache();
  mx = await startFakeMx();
  setMx('target.test', [{ exchange: '127.0.0.1', priority: 10 }]);
  _setConnectPortOverride(mx.port);
});

afterEach(async () => {
  _setConnectPortOverride(undefined);
  await mx.close();
});

describe('outbox-worker.tick', () => {
  it('claims and delivers a queued row', async () => {
    seedDomain('example.com');
    const mid = seedMailbox('alice@example.com');
    const id = enqueue({
      mailboxId: mid,
      from: 'alice@example.com',
      to: ['bob@target.test'],
      subject: 'hello',
      text: 'body',
    });
    const r = await tick();
    expect(r.delivered).toEqual([id]);
    const row = db.prepare('SELECT status FROM outbox WHERE id = ?').get(id) as { status: string };
    expect(row.status).toBe('delivered');
  });

  it('marks deferred on a 4xx response and increments attempts', async () => {
    seedDomain('example.com');
    const mid = seedMailbox('alice@example.com');
    mx.setBehaviour({ rcpt: { code: 421, message: 'try later' } });
    const id = enqueue({
      mailboxId: mid,
      from: 'alice@example.com',
      to: ['bob@target.test'],
      subject: 'hello',
      text: 'body',
    });
    const r = await tick();
    expect(r.deferred).toEqual([id]);
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as any;
    expect(row.status).toBe('deferred');
    expect(row.attempts).toBe(1);
    expect(row.next_attempt_at).toBeGreaterThan(Date.now() + 30_000); // ~60s minimum minus jitter
  });

  it('marks failed on a 5xx response immediately', async () => {
    seedDomain('example.com');
    const mid = seedMailbox('alice@example.com');
    mx.setBehaviour({ rcpt: { code: 550, message: 'unknown user' } });
    const id = enqueue({
      mailboxId: mid,
      from: 'alice@example.com',
      to: ['bob@target.test'],
      subject: 'hello',
      text: 'body',
    });
    const r = await tick();
    expect(r.failed).toEqual([id]);
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as any;
    expect(row.status).toBe('failed');
    expect(row.last_error).toMatch(/550/);
  });

  it('hard-fails after attempts reach max_attempts on a defer', async () => {
    seedDomain('example.com');
    const mid = seedMailbox('alice@example.com');
    mx.setBehaviour({ rcpt: { code: 421, message: 'try later' } });
    const id = enqueue({
      mailboxId: mid,
      from: 'alice@example.com',
      to: ['bob@target.test'],
      subject: 'hello',
      text: 'body',
      maxAttempts: 1,
    });
    const r = await tick();
    expect(r.failed).toEqual([id]);
    const row = db.prepare('SELECT status FROM outbox WHERE id = ?').get(id) as { status: string };
    expect(row.status).toBe('failed');
  });
});
```

- [ ] **Step 6.2: Run; expect FAIL**

Expected: module not found.

- [ ] **Step 6.3: Implement `server/src/outbox-worker.ts`**

```ts
// Outbound delivery worker. Claims due rows, delivers via direct MX, persists
// outcome with retry policy.
//
// Retry policy:
//   backoff_ms = min(60s · 2^(attempts-1), 4h) · (0.8 + 0.4 · random)
// Once attempts >= max_attempts and the latest outcome is not 'delivered',
// the row is hard-failed (status='failed').

import { db, type Mailbox, type Domain } from './db.js';
import { ensureDkim } from './dkim.js';
import { claimDue, markDelivered, markDeferred, markFailed } from './outbox.js';
import { deliver, type DeliveryInput } from './mx-delivery.js';
import { config } from './config.js';

const BATCH = 25;
const MAX_BACKOFF_MS = 4 * 60 * 60 * 1000;

let connectPortOverride: number | undefined;
// Test-only: pin the port the worker connects to (so tests can point at a fake MX).
export function _setConnectPortOverride(port: number | undefined): void {
  connectPortOverride = port;
}

function backoffMs(nextAttempts: number): number {
  const base = Math.min(60_000 * 2 ** (nextAttempts - 1), MAX_BACKOFF_MS);
  const jitter = 0.8 + 0.4 * Math.random();
  return Math.floor(base * jitter);
}

const findMailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ?');

export type TickResult = {
  delivered: string[];
  deferred: string[];
  failed: string[];
};

export async function tick(): Promise<TickResult> {
  const result: TickResult = { delivered: [], deferred: [], failed: [] };
  const due = claimDue(BATCH);
  for (const row of due) {
    const mb = findMailbox.get(row.mailbox_id) as Mailbox | undefined;
    if (!mb) {
      markFailed(row.id, 'mailbox missing');
      result.failed.push(row.id);
      continue;
    }
    let domain: Domain | null = null;
    try {
      domain = ensureDkim(mb.domain_id);
    } catch (e: any) {
      markDeferred(row.id, `dkim init failed: ${e?.message ?? e}`, backoffMs(row.attempts + 1));
      result.deferred.push(row.id);
      continue;
    }

    const input: DeliveryInput = {
      from: row.from_address,
      to: JSON.parse(row.to_addresses) as string[],
      raw: rfc822(row),
      connectPort: connectPortOverride,
      dkim:
        domain && domain.dkim_selector && domain.dkim_private_pem
          ? {
              domainName: domain.name,
              keySelector: domain.dkim_selector,
              privateKey: domain.dkim_private_pem,
            }
          : undefined,
    };

    const r = await deliver(input);
    if (r.outcome === 'delivered') {
      markDelivered(row.id, r.mxHost ?? '');
      result.delivered.push(row.id);
    } else if (r.outcome === 'fail') {
      markFailed(row.id, r.response);
      result.failed.push(row.id);
    } else {
      const nextAttempts = row.attempts + 1;
      if (nextAttempts >= row.max_attempts) {
        markFailed(row.id, `max attempts: ${r.response}`);
        result.failed.push(row.id);
      } else {
        markDeferred(row.id, r.response, backoffMs(nextAttempts));
        result.deferred.push(row.id);
      }
    }
  }
  return result;
}

function rfc822(row: { from_address: string; to_addresses: string; subject: string; body_text: string | null; body_html: string | null; }): Buffer {
  const to = (JSON.parse(row.to_addresses) as string[]).join(', ');
  const headers = [
    `From: ${row.from_address}`,
    `To: ${to}`,
    `Subject: ${row.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${row.from_address.split('@')[1]}>`,
    `MIME-Version: 1.0`,
  ];
  if (row.body_html && row.body_text) {
    const boundary = `b-${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return Buffer.from(
      headers.join('\r\n') +
        `\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${row.body_text}\r\n` +
        `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${row.body_html}\r\n` +
        `--${boundary}--\r\n`,
      'utf8',
    );
  }
  if (row.body_html) {
    headers.push('Content-Type: text/html; charset=utf-8');
    return Buffer.from(headers.join('\r\n') + '\r\n\r\n' + row.body_html, 'utf8');
  }
  headers.push('Content-Type: text/plain; charset=utf-8');
  return Buffer.from(headers.join('\r\n') + '\r\n\r\n' + (row.body_text ?? ''), 'utf8');
}

export function startOutboxWorker(): () => void {
  const run = async () => {
    try {
      await tick();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[outbox] tick failure', e);
    }
  };
  void run();
  const interval = setInterval(run, config.outboxTickIntervalSec * 1000);
  // eslint-disable-next-line no-console
  console.log(`[outbox] worker running every ${config.outboxTickIntervalSec}s`);
  return () => clearInterval(interval);
}
```

- [ ] **Step 6.4: Add `outboxTickIntervalSec` to `config.ts`**

Find:
```ts
  digestTickIntervalSec: envInt('DIGEST_TICK_INTERVAL_SEC', 60),
} as const;
```

Replace with:
```ts
  digestTickIntervalSec: envInt('DIGEST_TICK_INTERVAL_SEC', 60),
  outboxTickIntervalSec: envInt('OUTBOX_TICK_INTERVAL_SEC', 5),
} as const;
```

Add to `server/vitest.config.ts` env block:
```ts
      OUTBOX_TICK_INTERVAL_SEC: '5',
```

- [ ] **Step 6.5: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 6.6: Commit**

```bash
git add server/src/outbox-worker.ts server/src/config.ts server/vitest.config.ts server/test/outbox-worker.test.ts
git commit -m "feat(outbox): worker tick with exp-backoff retry + max-attempts hard-fail"
```

---

## Task 7: `api-keys.ts` helpers + tests

**Files:**
- Create: `server/src/api-keys.ts`
- Create: `server/test/api-keys.test.ts`

- [ ] **Step 7.1: Write the failing test**

`server/test/api-keys.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mintApiKey, validateApiKey, listApiKeys, revokeApiKey } from '../src/api-keys.js';
import { seedOwner } from './fixtures/owner.js';

describe('api keys', () => {
  it('mintApiKey returns a plaintext key with zsk_ prefix and stores only the hash', async () => {
    const { userId } = await seedOwner();
    const { plaintext, prefix, id } = mintApiKey(userId, 'my key');
    expect(plaintext.startsWith('zsk_')).toBe(true);
    expect(plaintext.length).toBeGreaterThanOrEqual(32);
    expect(prefix).toBe(plaintext.slice(0, 12));
    expect(id).toBeGreaterThan(0);
  });

  it('validateApiKey returns the user_id for a non-revoked key', async () => {
    const { userId } = await seedOwner();
    const { plaintext } = mintApiKey(userId, 'k1');
    const v = validateApiKey(plaintext);
    expect(v?.userId).toBe(userId);
  });

  it('validateApiKey returns null for a wrong key', async () => {
    const { userId } = await seedOwner();
    mintApiKey(userId, 'k1');
    expect(validateApiKey('zsk_definitelynotreal')).toBeNull();
  });

  it('revokeApiKey blocks subsequent validation', async () => {
    const { userId } = await seedOwner();
    const { plaintext, id } = mintApiKey(userId, 'k1');
    revokeApiKey(id);
    expect(validateApiKey(plaintext)).toBeNull();
  });

  it('listApiKeys returns metadata only — no plaintext, no hash', async () => {
    const { userId } = await seedOwner();
    mintApiKey(userId, 'k1');
    const rows = listApiKeys(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('key_hash');
    expect(rows[0].name).toBe('k1');
    expect(rows[0].prefix.startsWith('zsk_')).toBe(true);
  });
});
```

- [ ] **Step 7.2: Run; expect FAIL**

Expected: module not found.

- [ ] **Step 7.3: Implement `server/src/api-keys.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db.js';

const PREFIX = 'zsk_';

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export type MintResult = {
  id: number;
  plaintext: string;
  prefix: string;
};

export function mintApiKey(userId: number, name: string): MintResult {
  // 32 bytes = 256 bits; base64url ≈ 43 chars; with 'zsk_' prefix = 47 chars total.
  const body = randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const plaintext = PREFIX + body;
  const prefix = plaintext.slice(0, 12);
  const r = db
    .prepare(
      `INSERT INTO api_keys (user_id, name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(userId, name, hashKey(plaintext), prefix, Date.now()) as { id: number };
  return { id: r.id, plaintext, prefix };
}

export function validateApiKey(plaintext: string): { userId: number; keyId: number } | null {
  if (!plaintext || !plaintext.startsWith(PREFIX)) return null;
  const row = db
    .prepare(
      'SELECT id, user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL',
    )
    .get(hashKey(plaintext)) as { id: number; user_id: number } | undefined;
  if (!row) return null;
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(Date.now(), row.id);
  return { userId: row.user_id, keyId: row.id };
}

export type ApiKeyMeta = {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
};

export function listApiKeys(userId: number): ApiKeyMeta[] {
  return db
    .prepare(
      'SELECT id, user_id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE user_id = ? ORDER BY id DESC',
    )
    .all(userId) as ApiKeyMeta[];
}

export function revokeApiKey(id: number): void {
  db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(Date.now(), id);
}
```

- [ ] **Step 7.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/api-keys.test.ts
```

- [ ] **Step 7.5: Commit**

```bash
git add server/src/api-keys.ts server/test/api-keys.test.ts
git commit -m "feat(api-keys): mint/validate/list/revoke + sha256 storage"
```

---

## Task 8: `requireApiKey` pre-handler (TDD)

**Files:**
- Create: `server/src/requireApiKey.ts`
- Create: `server/test/require-api-key.test.ts`

- [ ] **Step 8.1: Write the failing test**

`server/test/require-api-key.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { requireApiKey } from '../src/requireApiKey.js';
import { mintApiKey } from '../src/api-keys.js';
import { seedOwner } from './fixtures/owner.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  app.addHook('preHandler', requireApiKey);
  app.get('/protected', async (req) => ({ userId: (req as any).user?.id }));
  return app;
}

describe('requireApiKey', () => {
  it('rejects with 401 when no Authorization header', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'GET', url: '/protected' });
    expect(r.statusCode).toBe(401);
  });

  it('rejects with 401 when key is unknown', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer zsk_nonexistent' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('attaches user.id when key is valid', async () => {
    const { userId } = await seedOwner();
    const { plaintext } = mintApiKey(userId, 'k1');
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().userId).toBe(userId);
  });
});
```

- [ ] **Step 8.2: Run; expect FAIL**

- [ ] **Step 8.3: Implement `server/src/requireApiKey.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { validateApiKey } from './api-keys.js';

export async function requireApiKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'missing api key' });
    return;
  }
  const token = auth.slice('Bearer '.length).trim();
  const v = validateApiKey(token);
  if (!v) {
    reply.code(401).send({ error: 'invalid api key' });
    return;
  }
  req.user = { id: v.userId };
}
```

- [ ] **Step 8.4: Run; expect PASS**

- [ ] **Step 8.5: Commit**

```bash
git add server/src/requireApiKey.ts server/test/require-api-key.test.ts
git commit -m "feat(api-keys): requireApiKey Fastify pre-handler"
```

---

## Task 9: `POST /api/keys`, `GET /api/keys`, `DELETE /api/keys/:id` (TDD)

**Files:**
- Create: `server/src/routes/keys.ts`
- Modify: `server/src/api.ts`
- Create: `server/test/api-keys-routes.test.ts`

- [ ] **Step 9.1: Write the failing test**

`server/test/api-keys-routes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

async function authedApp() {
  const app = await startApi();
  const { userId } = await seedOwner();
  return { app, cookie: makeSessionCookie(userId) };
}

describe('api key routes', () => {
  it('POST /api/keys returns plaintext exactly once', async () => {
    const { app, cookie } = await authedApp();
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/keys',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { name: 'my key' },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json();
      expect(body.plaintext.startsWith('zsk_')).toBe(true);
      expect(body.id).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it('GET /api/keys lists metadata without plaintext', async () => {
    const { app, cookie } = await authedApp();
    try {
      await app.inject({
        method: 'POST', url: '/api/keys',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { name: 'k1' },
      });
      const r = await app.inject({ method: 'GET', url: '/api/keys', headers: { cookie } });
      const list = r.json();
      expect(list).toHaveLength(1);
      expect(list[0]).not.toHaveProperty('key_hash');
      expect(list[0]).not.toHaveProperty('plaintext');
    } finally {
      await app.close();
    }
  });

  it('DELETE /api/keys/:id revokes the key', async () => {
    const { app, cookie } = await authedApp();
    try {
      const m = await app.inject({
        method: 'POST', url: '/api/keys',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { name: 'k1' },
      });
      const id = m.json().id;
      const r = await app.inject({
        method: 'DELETE', url: `/api/keys/${id}`, headers: { cookie },
      });
      expect(r.statusCode).toBe(200);
      const list = await app.inject({ method: 'GET', url: '/api/keys', headers: { cookie } });
      const row = list.json()[0];
      expect(row.revoked_at).not.toBeNull();
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 9.2: Run; expect FAIL**

- [ ] **Step 9.3: Implement `server/src/routes/keys.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { mintApiKey, listApiKeys, revokeApiKey } from '../api-keys.js';

const createSchema = z.object({ name: z.string().min(1).max(80) });

export const keyRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/keys', async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    const body = createSchema.parse(req.body);
    const r = mintApiKey(userId, body.name);
    return { id: r.id, plaintext: r.plaintext, prefix: r.prefix };
  });

  app.get('/api/keys', async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    return listApiKeys(userId);
  });

  app.delete('/api/keys/:id', async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    revokeApiKey(Number(id));
    return { ok: true };
  });
};
```

- [ ] **Step 9.4: Wire it into `server/src/api.ts`**

Find the line `await app.register(authRoutes);` and add immediately after:
```ts
  await app.register((await import('./routes/keys.js')).keyRoutes);
```

- [ ] **Step 9.5: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 9.6: Commit**

```bash
git add server/src/routes/keys.ts server/src/api.ts server/test/api-keys-routes.test.ts
git commit -m "feat(api-keys): POST/GET/DELETE /api/keys routes"
```

---

## Task 10: `POST /api/send` + `GET /api/send/:id` (TDD)

**Files:**
- Modify: `server/src/api.ts`
- Create: `server/test/api-send.test.ts`

The `/api/send` endpoint is the only one that uses `requireApiKey` instead of `requireAuth`. Same approach as the existing `PUBLIC_PREFIXES` allowlist: we add `/api/send` to a new allowlist and wire `requireApiKey` separately.

- [ ] **Step 10.1: Write the failing test**

`server/test/api-send.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner } from './fixtures/owner.js';
import { seedDomain, seedMailbox } from './helpers.js';
import { mintApiKey } from '../src/api-keys.js';
import { db } from '../src/db.js';

async function authedSend() {
  const app = await startApi();
  const { userId } = await seedOwner();
  const { plaintext } = mintApiKey(userId, 'send key');
  return { app, key: plaintext };
}

describe('POST /api/send', () => {
  it('rejects without an API key (401)', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/send',
        headers: { 'content-type': 'application/json' },
        payload: { from: 'a@example.com', to: ['b@target.test'], subject: 's', text: 't' },
      });
      expect(r.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('enqueues an outbox row and returns its id', async () => {
    const { app, key } = await authedSend();
    seedDomain('example.com');
    seedMailbox('alice@example.com');
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/send',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        payload: {
          from: 'alice@example.com',
          to: ['bob@target.test'],
          subject: 'hi',
          text: 'hello',
        },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json();
      expect(body.id).toBeTruthy();
      expect(body.status).toBe('queued');
      const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(body.id) as any;
      expect(row.status).toBe('queued');
      expect(row.from_address).toBe('alice@example.com');
    } finally {
      await app.close();
    }
  });

  it('rejects when from-domain is not owned (404)', async () => {
    const { app, key } = await authedSend();
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/send',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        payload: {
          from: 'mallory@somebody-elses.test',
          to: ['victim@target.test'],
          subject: 'spoof',
          text: 'no',
        },
      });
      expect(r.statusCode).toBe(404);
      expect(r.json().error).toMatch(/domain/i);
    } finally {
      await app.close();
    }
  });

  it('GET /api/send/:id returns the row', async () => {
    const { app, key } = await authedSend();
    seedDomain('example.com');
    seedMailbox('alice@example.com');
    try {
      const m = await app.inject({
        method: 'POST', url: '/api/send',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        payload: { from: 'alice@example.com', to: ['bob@target.test'], subject: 's', text: 't' },
      });
      const id = m.json().id;
      const r = await app.inject({
        method: 'GET', url: `/api/send/${id}`,
        headers: { authorization: `Bearer ${key}` },
      });
      expect(r.statusCode).toBe(200);
      expect(r.json().id).toBe(id);
      expect(r.json().status).toBe('queued');
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 10.2: Run; expect FAIL**

- [ ] **Step 10.3: Wire `/api/send` into `server/src/api.ts`**

In `server/src/api.ts`, replace the existing `PUBLIC_PREFIXES`/`preHandler` block (the one that gates everything behind `requireAuth`) with:

```ts
  const PUBLIC_PREFIXES = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/logout',
    '/public/digest/allow',
  ];
  const API_KEY_PREFIXES = ['/api/send'];
  app.addHook('preHandler', async (req, reply) => {
    if (PUBLIC_PREFIXES.some((p) => req.url === p || req.url.startsWith(p + '?'))) return;
    if (API_KEY_PREFIXES.some((p) => req.url === p || req.url.startsWith(p + '/') || req.url.startsWith(p + '?'))) {
      const { requireApiKey } = await import('./requireApiKey.js');
      await requireApiKey(req as any, reply as any);
      return;
    }
    await requireAuth(req as any, reply as any);
  });
```

In the same file, find the `// ---- public digest action routes ----` comment and insert immediately **before** it:

```ts
  // ---- /api/send (api-key auth) ----
  const sendSchema = z.object({
    from: z.string().email(),
    to: z.array(z.string().email()).min(1).max(50),
    subject: z.string().min(1).max(200),
    text: z.string().optional(),
    html: z.string().optional(),
  });

  app.post('/api/send', async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    const body = sendSchema.parse(req.body);
    const fromDomain = body.from.split('@')[1].toLowerCase();
    // Domain ownership: caller must have a mailbox in that domain on this server.
    // (Simplification for MVP: domain ownership = at least one mailbox in the domain.)
    const mailbox = db
      .prepare(
        `SELECT m.id FROM mailboxes m JOIN domains d ON m.domain_id = d.id WHERE d.name = ? LIMIT 1`,
      )
      .get(fromDomain) as { id: number } | undefined;
    if (!mailbox) {
      return reply.code(404).send({ error: 'sending domain not configured' });
    }
    const { enqueue } = await import('./outbox.js');
    const id = enqueue({
      mailboxId: mailbox.id,
      from: body.from,
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
    return { id, status: 'queued' };
  });

  app.get('/api/send/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as
      | { id: string; status: string; mailbox_id: number; from_address: string; to_addresses: string; subject: string; attempts: number; last_error: string | null; created_at: number; delivered_at: number | null; failed_at: number | null }
      | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    return {
      id: row.id, status: row.status, attempts: row.attempts,
      from: row.from_address, to: JSON.parse(row.to_addresses),
      subject: row.subject, last_error: row.last_error,
      created_at: row.created_at, delivered_at: row.delivered_at, failed_at: row.failed_at,
    };
  });
```

- [ ] **Step 10.4: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 10.5: Commit**

```bash
git add server/src/api.ts server/test/api-send.test.ts
git commit -m "feat(send): POST /api/send + GET /api/send/:id with api-key auth + domain check"
```

---

## Task 11: Boot wiring — `startOutboxWorker` + `index.ts`

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 11.1: Wire it into `server/src/index.ts`**

```ts
import { startSmtp } from './smtp.js';
import { startApi } from './api.js';
import { startSweeper } from './sweeper.js';
import { startDigester } from './digester.js';
import { startOutboxWorker } from './outbox-worker.js';

async function main() {
  startSmtp();
  await startApi();
  startSweeper();
  startDigester();
  startOutboxWorker();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
```

- [ ] **Step 11.2: Smoke-build**

```bash
npm run build --workspace=server
```
Expected: clean build.

- [ ] **Step 11.3: Run all tests**

```bash
npm test --workspace=server
```
Expected: all green.

- [ ] **Step 11.4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(outbox): boot worker alongside sweeper/digester"
```

---

## Final Verification

- [ ] **Step F.1: Run the full test suite**

```bash
npm test --workspace=server
```
Expected: all green.

- [ ] **Step F.2: Build both workspaces**

```bash
npm run build
```
Expected: server + web both build cleanly.

- [ ] **Step F.3: End-to-end manual smoke**

1. Start the server pointing at a clean sandbox dir, with a short worker tick (`OUTBOX_TICK_INTERVAL_SEC=3`):
   ```bash
   DATA_DIR=$PWD/send-smoke OUTBOX_TICK_INTERVAL_SEC=3 npm run dev:server
   ```
2. In another shell: `DATA_DIR=$PWD/send-smoke npm run seed:owner -- --email me@local.test --password "smoke-password-123456"`.
3. Login (cookie auth), POST `/api/keys` → keep the `plaintext` shown.
4. Create a mailbox `alice@yourdomain.test` via the UI or API so the domain is "owned".
5. Set up a fake MX in another shell (use the helper from `server/test/helpers/fake-mx.ts` standalone — or just point at an SMTP debug tool like `aiosmtpd -n -l localhost:2526` and override `OUTBOX_MX_PORT_OVERRIDE`).
6. Override DNS for `yourdomain.test` (e.g. add to `/etc/hosts` if you control the resolver) or pick a sender domain whose MX you can hit.
7. `curl -X POST http://localhost:8025/api/send -H "Authorization: Bearer zsk_..." -H "content-type: application/json" -d '{"from":"alice@yourdomain.test","to":["bob@target.test"],"subject":"hi","text":"hello"}'`.
8. Within ~3s, the worker tick should pick it up. `GET /api/send/:id` should report `status='delivered'`. The fake MX should show the received raw RFC822 with a `DKIM-Signature` header.

- [ ] **Step F.4: Final commit (if anything trailing)**

If anything was tweaked during smoke:
```bash
git add <files>
git commit -m "chore(outbox): smoke-test fixes"
```

---

## Self-Review Notes

| Concern | Covered |
|---|---|
| API key model (decision #1) | Tasks 7, 8, 9 |
| Domain-level `from` validation (decision #2) | Task 10 (`mailboxes JOIN domains` lookup) |
| Strict 5xx hard-fail (decision #3) | Task 4 `classifyError` returns `fail` for 5xx |
| Opportunistic STARTTLS (decision #4) | Task 4 transport: `secure: false`, `ignoreTLS: true`, `tls: { rejectUnauthorized: false }` (note: this disables STARTTLS for MVP simplicity — extend later if you want STARTTLS-when-offered) |
| Outbox table | Task 1 |
| Worker tick + retry policy | Task 6 |
| DKIM signing | Task 5 |
| Boot wiring | Task 11 |

**Out of scope for this plan (deferred):**
- Async bounce parsing (DSN, VERP).
- Suppression list, complaint feedback (FBL).
- Webhooks.
- Open/click tracking.
- Multi-tenant accounting (per-key rate limits, billing meters).
- IP rotation, warm-up, reputation tracking.
- MTA-STS / DANE.

**Note on TLS:** The MVP uses `ignoreTLS: true` to avoid the failure mode where receiving MX certs are misconfigured. A natural follow-up is to add opportunistic STARTTLS: try `requireTLS: false` first, accept any cert, fall back to plaintext on TLS-handshake failure. That belongs in a Phase-2 plan once we have telemetry on which receivers actually offer STARTTLS.
