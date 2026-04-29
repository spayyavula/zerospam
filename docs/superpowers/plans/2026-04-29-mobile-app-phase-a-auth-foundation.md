# ZeroSpam Mobile App — Phase A: Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-owner authentication to the existing Fastify API and webmail UI: argon2id-hashed password, optional TOTP, HMAC-signed session cookie, audit log, rate-limited login, CORS allowlist, and an owner-seed CLI. All existing `/api/*` routes start requiring auth. The webmail gains a login gate.

**Architecture:** New tables (`users`, `sessions`, `pairing_codes`, `devices`, `audit_log`) added to the existing `db.ts` schema (the `pairing_codes` and `devices` tables are added in this phase but stay empty until Phase B). New `requireAuth` Fastify pre-handler accepts a cookie session OR a bearer token (bearer path is wired through but exercised in Phase B). New auth routes live in a new `server/src/routes/` folder; existing `api.ts` registers them via `app.register`. Webmail unconditionally fetches `/api/auth/me` on boot and renders either the login form or the existing app.

**Tech Stack:** Fastify 5, `@fastify/cookie`, `@fastify/rate-limit`, `argon2`, `otplib`, `node:crypto` (HMAC), Vitest 4, React 18 (existing), Tailwind (existing). No new infrastructure.

---

## Decisions inherited from the spec

| Topic | Decision |
|---|---|
| Hash | argon2id, defaults from the `argon2` library |
| Session cookie | `zs_sid`, HttpOnly, Secure, SameSite=Lax, scoped to host. Value = `<sessionId>.<HMAC-SHA256(sessionId, SESSION_SECRET)>` |
| Session TTL | 30 days, refreshed on every request (sliding) |
| TOTP | `otplib` authenticator, 30s window, ±1 step drift, 6 digits |
| Pairing tokens (Phase B) | Tables created here so Phase B can land additively. No code paths use them yet. |
| Bearer (Phase B) | `requireAuth` checks bearer too; with no devices rows, all bearer attempts return 401 in Phase A. |
| Rate limit | per-IP, 10 req/min on `/api/auth/login`; 30 req/min on `/api/auth/*`; default off elsewhere |
| CORS | `ALLOWED_ORIGINS` env (comma-separated). Dev default allows `http://localhost:5173`. |
| Audit | Insert one row per security event; failures must NOT leak why (no "user not found" vs "wrong password" distinction in the response, but the audit row records the cause) |
| Owner bootstrap | `npm run seed:owner` — interactive CLI; non-interactive `--email --password` flags for tests/CI |

---

## Conventions

- **TDD throughout.** Every new helper or route gets a failing test before the implementation.
- **Vitest fixture pattern.** `server/test/setup.ts` truncates a fixed list of tables before each test. Add new tables to that list as part of the schema task.
- **No mocks for the DB.** Tests run against the real SQLite file (single shared DB; `maxWorkers: 1`). This is the project's existing pattern — don't change it.
- **No mocks for argon2 / otplib.** They're fast enough; mocking hashes hides bugs.
- **Auth fixture for tests of protected routes.** A `seedOwner({ email, password, totp? })` helper in `test/fixtures/owner.ts` returns `{ ownerId, sessionCookie }` that integration tests pass via the `cookie` header.
- **Existing routes stay unchanged structurally.** Don't refactor `api.ts` mid-phase — only add a `preHandler` and mount the new routes.
- **Commit after each task.** Granular commit history aids review and bisecting.

---

## File structure

### NEW

| Path | Purpose |
|---|---|
| `server/src/users.ts` | Argon2 hashing + user-row CRUD (`createOwner`, `getOwnerByEmail`, `getOwnerById`, `updateOwnerPassword`, `verifyPassword`). |
| `server/src/sessions.ts` | HMAC cookie helpers (`createSession`, `validateCookie`, `destroySession`, `touchSession`). |
| `server/src/totp.ts` | TOTP helpers (`generateTotpSecret`, `verifyTotp`, `provisioningUri`). |
| `server/src/audit.ts` | `recordAudit({ event, userId?, detail?, req })` writes one row. |
| `server/src/requireAuth.ts` | Fastify pre-handler — accepts cookie session OR bearer token, populates `req.user`. |
| `server/src/routes/auth.ts` | All `/api/auth/*` routes (login, logout, password, totp). |
| `server/src/seed-owner.ts` | Interactive owner-bootstrap CLI (`npm run seed:owner`). |
| `server/test/fixtures/owner.ts` | `seedOwner()` and `loginAs()` integration-test helpers. |
| `server/test/auth-login.test.ts` | Login route tests. |
| `server/test/auth-logout.test.ts` | Logout route tests. |
| `server/test/auth-totp.test.ts` | TOTP setup/confirm/disable tests. |
| `server/test/auth-password.test.ts` | Password-change tests. |
| `server/test/require-auth.test.ts` | Middleware unit + integration tests. |
| `server/test/rate-limit.test.ts` | Login rate-limit test. |
| `server/test/users.test.ts` | Hashing + CRUD unit tests. |
| `server/test/sessions.test.ts` | Cookie HMAC + expiry tests. |
| `server/test/totp.test.ts` | TOTP unit tests. |
| `server/test/audit.test.ts` | Audit-row insertion tests. |
| `server/test/seed-owner.test.ts` | CLI smoke test. |
| `web/src/components/LoginForm.tsx` | Username + password + TOTP step component. |
| `web/src/components/TotpSetupModal.tsx` | Owner enrollment modal (QR + verify). |

### RENAMED

| From | To | Reason |
|---|---|---|
| `server/src/auth.ts` (mailauth wrapper) | `server/src/mailauth.ts` | Free up `auth.ts` namespace; `auth/*` would otherwise conflict semantically. |

### MODIFIED

| Path | Change |
|---|---|
| `server/src/db.ts` | Add `users`, `sessions`, `pairing_codes`, `devices`, `audit_log` tables to the SCHEMA constant; export new types. |
| `server/src/config.ts` | Read `SESSION_SECRET` (required), `ALLOWED_ORIGINS` (comma list), `OWNER_EMAIL` (optional, used only by seed-owner), `RATE_LIMIT_LOGIN_PER_MIN`. |
| `server/src/api.ts` | Register `@fastify/cookie`; tighten CORS config to allowlist; register `@fastify/rate-limit` plugin; mount `routes/auth.ts`; add `requireAuth` pre-handler with explicit route allowlist. |
| `server/src/ingest.ts` | Update single import: `./auth.js` → `./mailauth.js`. |
| `server/test/setup.ts` | Add `users`, `sessions`, `pairing_codes`, `devices`, `audit_log` to the truncate list. (`device_push_prefs` is added in Phase E.) |
| `server/package.json` | Add deps: `@fastify/cookie ^11.0`, `@fastify/rate-limit ^10.0`, `argon2 ^0.41`, `otplib ^12.0`. |
| `web/src/api.ts` | Add `credentials: 'include'` to `j()` (cookies on all requests); add `auth.me()`, `auth.login()`, `auth.logout()`, `auth.changePassword()`, TOTP setup helpers. |
| `web/src/App.tsx` | Wrap with auth-check: render `<LoginForm>` until `auth.me()` resolves with a user. |
| `web/src/types.ts` | Add `AuthMe`, `LoginRequest`, `LoginResponse` types. |
| Root `package.json` | Add `"seed:owner": "tsx server/src/seed-owner.ts"` script. |

---

## Tasks

### Task 0: Resolve `src/auth.ts` naming collision

The existing `server/src/auth.ts` is a tiny mailauth (SPF/DKIM/DMARC) wrapper. To free the `auth` name for user-auth, rename it. One importer (`ingest.ts`) needs updating.

**Files:**
- Rename: `server/src/auth.ts` → `server/src/mailauth.ts`
- Modify: `server/src/ingest.ts`

- [ ] **Step 1: Rename via git**

```bash
cd "C:/Users/sreek/myprojects/ZeroSpam Email/.worktrees/auth-foundation"
git mv server/src/auth.ts server/src/mailauth.ts
```

- [ ] **Step 2: Update the import in `ingest.ts`**

Search for `./auth.js` in `server/src/ingest.ts` and change to `./mailauth.js`.

- [ ] **Step 3: Run tests to confirm nothing else breaks**

```bash
npm test --workspace=server
```
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add server/src/mailauth.ts server/src/ingest.ts
git commit -m "refactor(server): rename auth.ts -> mailauth.ts to free name for user-auth"
```

---

### Task 1: Add new server dependencies

**Files:**
- Modify: `server/package.json` (npm will edit it)

- [ ] **Step 1: Install runtime deps**

```bash
npm install --workspace=server @fastify/cookie@^11.0.0 @fastify/rate-limit@^10.0.0 argon2@^0.41.0 otplib@^12.0.0
```

- [ ] **Step 2: Verify versions in `server/package.json`**

Read the file; confirm the four new entries appear under `dependencies` with `^` ranges.

- [ ] **Step 3: Typecheck and test**

```bash
npm run build --workspace=server && npm test --workspace=server
```
Expected: build OK, 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add server/package.json package-lock.json
git commit -m "chore(server): add deps for owner auth (cookie, rate-limit, argon2, otplib)"
```

---

### Task 2: Add new tables to `db.ts` and update test setup

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/test/setup.ts`
- Test: `server/test/db-schema.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `server/test/db-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('db schema', () => {
  it('has the auth/device/audit tables', () => {
    const names = (db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]).map((r) => r.name);
    for (const t of ['users', 'sessions', 'pairing_codes', 'devices', 'audit_log']) {
      expect(names).toContain(t);
    }
  });
});
```

- [ ] **Step 2: Run the test — it must fail**

```bash
npm test --workspace=server -- --run test/db-schema.test.ts
```
Expected: FAIL with `expected ['domains','mailboxes',...] to contain 'users'`.

- [ ] **Step 3: Add the tables to `server/src/db.ts`**

Locate the `SCHEMA` template literal. Append (before the trailing backtick):

```sql
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  totp_secret     TEXT,
  totp_enabled_at INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash   TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS devices (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  token_hash        TEXT NOT NULL UNIQUE,
  expo_push_token   TEXT,
  platform          TEXT,
  app_version       TEXT,
  created_at        INTEGER NOT NULL,
  last_seen_at      INTEGER NOT NULL,
  revoked_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event      TEXT NOT NULL,
  detail     TEXT,
  ip         TEXT,
  user_agent TEXT,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event, at DESC);
```

Then export the matching TypeScript types at the bottom of `db.ts`:

```ts
export type User = {
  id: number;
  email: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enabled_at: number | null;
  created_at: number;
};

export type Session = {
  id: string;
  user_id: number;
  created_at: number;
  expires_at: number;
  ip: string | null;
  user_agent: string | null;
};

export type Device = {
  id: number;
  user_id: number;
  name: string;
  token_hash: string;
  expo_push_token: string | null;
  platform: string | null;
  app_version: string | null;
  created_at: number;
  last_seen_at: number;
  revoked_at: number | null;
};

export type AuditLogEntry = {
  id: number;
  user_id: number | null;
  event: string;
  detail: string | null;
  ip: string | null;
  user_agent: string | null;
  at: number;
};
```

- [ ] **Step 4: Update `server/test/setup.ts` truncate list**

Replace the `beforeEach` body so it covers the new tables. Order matters: child tables before parent.

```ts
beforeEach(() => {
  db.exec(`
    DELETE FROM messages_fts;
    DELETE FROM messages;
    DELETE FROM attachments;
    DELETE FROM contacts;
    DELETE FROM whitelist_rules;
    DELETE FROM aliases;
    DELETE FROM drafts;
    DELETE FROM mailboxes;
    DELETE FROM domains;
    DELETE FROM audit_log;
    DELETE FROM pairing_codes;
    DELETE FROM devices;
    DELETE FROM sessions;
    DELETE FROM users;
  `);
});
```

- [ ] **Step 5: Run the test — must pass**

```bash
npm test --workspace=server
```
Expected: 2 tests pass (sanity + db-schema).

- [ ] **Step 6: Commit**

```bash
git add server/src/db.ts server/test/setup.ts server/test/db-schema.test.ts
git commit -m "feat(db): add users, sessions, pairing_codes, devices, audit_log tables"
```

---

### Task 3: Audit log helper

**Files:**
- Create: `server/src/audit.ts`
- Test: `server/test/audit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/test/audit.test.ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';
import { recordAudit } from '../src/audit.js';

describe('recordAudit', () => {
  it('inserts a row with normalized fields', () => {
    recordAudit({
      event: 'login.fail',
      userId: null,
      detail: { reason: 'bad-password', email: 'alice@example.com' },
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });
    const row = db.prepare('SELECT * FROM audit_log').get() as any;
    expect(row.event).toBe('login.fail');
    expect(row.user_id).toBeNull();
    expect(row.ip).toBe('127.0.0.1');
    expect(row.user_agent).toBe('vitest');
    expect(JSON.parse(row.detail)).toEqual({ reason: 'bad-password', email: 'alice@example.com' });
    expect(typeof row.at).toBe('number');
  });

  it('accepts a missing detail', () => {
    recordAudit({ event: 'login.ok', userId: 1 });
    const row = db.prepare('SELECT * FROM audit_log').get() as any;
    expect(row.user_id).toBe(1);
    expect(row.detail).toBeNull();
  });
});
```

- [ ] **Step 2: Run — must fail**

```bash
npm test --workspace=server -- --run test/audit.test.ts
```
Expected: FAIL (`Cannot find module '../src/audit.js'`).

- [ ] **Step 3: Implement `server/src/audit.ts`**

```ts
import { db } from './db.js';

export type AuditEvent =
  | 'login.ok'
  | 'login.fail'
  | 'logout'
  | 'password.changed'
  | 'totp.enabled'
  | 'totp.disabled'
  | 'totp.fail'
  | 'device.pair'
  | 'device.revoke'
  | 'device.signout';

export type RecordAuditInput = {
  event: AuditEvent | (string & {}); // allow forward-compat strings
  userId?: number | null;
  detail?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

const stmt = db.prepare(
  `INSERT INTO audit_log (user_id, event, detail, ip, user_agent, at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

export function recordAudit(input: RecordAuditInput): void {
  stmt.run(
    input.userId ?? null,
    input.event,
    input.detail ? JSON.stringify(input.detail) : null,
    input.ip ?? null,
    input.userAgent ?? null,
    Date.now(),
  );
}
```

- [ ] **Step 4: Run — must pass**

```bash
npm test --workspace=server -- --run test/audit.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/audit.ts server/test/audit.test.ts
git commit -m "feat(server): audit log helper"
```

---

### Task 4: Argon2 password hashing helper

**Files:**
- Create: `server/src/users.ts`
- Test: `server/test/users.test.ts`

- [ ] **Step 1: Write the failing test (hash + verify only for now — CRUD comes in Task 5)**

```ts
// server/test/users.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/users.js';

describe('password hashing', () => {
  it('hash + verify roundtrips', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'hunter2')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('returns false for malformed hashes (does not throw)', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — must fail (module not found)**

- [ ] **Step 3: Implement (start of `server/src/users.ts`)**

```ts
import argon2 from 'argon2';

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run — must pass**

```bash
npm test --workspace=server -- --run test/users.test.ts
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/users.ts server/test/users.test.ts
git commit -m "feat(server): argon2 password hashing helper"
```

---

### Task 5: User-row CRUD helpers

**Files:**
- Modify: `server/src/users.ts`
- Test: `server/test/users.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { db } from '../src/db.js';
import { createOwner, getOwnerByEmail, getOwnerById, updateOwnerPassword } from '../src/users.js';

describe('user CRUD', () => {
  it('createOwner inserts a row and rejects duplicates', async () => {
    const id = await createOwner({ email: 'alice@example.com', password: 'hunter2' });
    expect(typeof id).toBe('number');
    await expect(createOwner({ email: 'alice@example.com', password: 'x' })).rejects.toThrow();
  });

  it('getOwnerByEmail is case-insensitive on lookup', async () => {
    await createOwner({ email: 'alice@example.com', password: 'hunter2' });
    const row = getOwnerByEmail('ALICE@example.com');
    expect(row?.email).toBe('alice@example.com');
  });

  it('getOwnerById returns the row', async () => {
    const id = await createOwner({ email: 'alice@example.com', password: 'hunter2' });
    expect(getOwnerById(id)?.id).toBe(id);
  });

  it('updateOwnerPassword changes the hash', async () => {
    const id = await createOwner({ email: 'alice@example.com', password: 'old' });
    const oldHash = getOwnerById(id)!.password_hash;
    await updateOwnerPassword(id, 'new');
    expect(getOwnerById(id)!.password_hash).not.toBe(oldHash);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Append implementation to `server/src/users.ts`**

```ts
import { db, type User } from './db.js';

export type CreateOwnerInput = { email: string; password: string };

export async function createOwner(input: CreateOwnerInput): Promise<number> {
  const hash = await hashPassword(input.password);
  const r = db
    .prepare(
      `INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`,
    )
    .get(input.email.toLowerCase(), hash, Date.now()) as { id: number };
  return r.id;
}

export function getOwnerByEmail(email: string): User | undefined {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase()) as User | undefined;
}

export function getOwnerById(id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export async function updateOwnerPassword(id: number, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
}

export function setTotpSecret(id: number, secret: string | null): void {
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled_at = ? WHERE id = ?').run(
    secret,
    secret ? Date.now() : null,
    id,
  );
}
```

- [ ] **Step 4: Run — must pass**

```bash
npm test --workspace=server -- --run test/users.test.ts
```
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/users.ts server/test/users.test.ts
git commit -m "feat(server): owner CRUD helpers"
```

---

### Task 6: TOTP helper

**Files:**
- Create: `server/src/totp.ts`
- Test: `server/test/totp.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/totp.test.ts
import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import { generateTotpSecret, verifyTotp, provisioningUri } from '../src/totp.js';

describe('totp', () => {
  it('generateTotpSecret returns a base32 string', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(16);
  });

  it('verifyTotp accepts the current code', () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('verifyTotp rejects a wrong code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('provisioningUri builds an otpauth URL', () => {
    const secret = generateTotpSecret();
    const uri = provisioningUri('alice@example.com', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\/ZeroSpam:alice%40example.com\?/);
    expect(uri).toContain(`secret=${secret}`);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Implement `server/src/totp.ts`**

```ts
import { authenticator } from 'otplib';

// Allow ±1 30-second window for clock drift. Replay protection is *not* implemented;
// the OTP step is short-lived and behind the password gate, so a one-time replay
// inside the 90-second window is acceptable for a single-owner system.
authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

export function provisioningUri(accountName: string, secret: string): string {
  return authenticator.keyuri(accountName, 'ZeroSpam', secret);
}
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/totp.ts server/test/totp.test.ts
git commit -m "feat(server): totp helpers"
```

---

### Task 7: Session helpers (HMAC cookie)

**Files:**
- Create: `server/src/sessions.ts`
- Test: `server/test/sessions.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/sessions.test.ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';
import { createSession, validateCookie, destroySession, touchSession } from '../src/sessions.js';

const SECRET = 'a'.repeat(64);

describe('sessions', () => {
  it('createSession inserts a row and returns a signed cookie value', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('alice@example.com', 'hash', Date.now()) as { id: number }).id;
    const { cookieValue, sessionId, expiresAt } = createSession(userId, SECRET);
    expect(cookieValue).toMatch(/^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    expect(expiresAt).toBeGreaterThan(Date.now());
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    expect(row).toBeTruthy();
  });

  it('validateCookie returns the user id for a valid cookie', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue } = createSession(userId, SECRET);
    const result = validateCookie(cookieValue, SECRET);
    expect(result?.userId).toBe(userId);
  });

  it('validateCookie returns null for a tampered cookie', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue } = createSession(userId, SECRET);
    const tampered = cookieValue.replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    expect(validateCookie(tampered, SECRET)).toBeNull();
  });

  it('validateCookie returns null for an expired session', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue, sessionId } = createSession(userId, SECRET);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, sessionId);
    expect(validateCookie(cookieValue, SECRET)).toBeNull();
  });

  it('destroySession removes the row', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { sessionId } = createSession(userId, SECRET);
    destroySession(sessionId);
    expect(db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)).toBeUndefined();
  });

  it('touchSession extends expires_at', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { sessionId } = createSession(userId, SECRET);
    const before = (db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(sessionId) as any).expires_at;
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(before - 60_000, sessionId);
    touchSession(sessionId);
    const after = (db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(sessionId) as any).expires_at;
    expect(after).toBeGreaterThan(before - 60_000);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Implement `server/src/sessions.ts`**

```ts
import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type CreateSessionResult = {
  sessionId: string;
  cookieValue: string;
  expiresAt: number;
};

export type SessionValidation = {
  sessionId: string;
  userId: number;
  expiresAt: number;
};

function hmac(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function createSession(
  userId: number,
  secret: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): CreateSessionResult {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(sessionId, userId, now, expiresAt, meta.ip ?? null, meta.userAgent ?? null);
  return { sessionId, cookieValue: `${sessionId}.${hmac(secret, sessionId)}`, expiresAt };
}

export function validateCookie(cookieValue: string, secret: string): SessionValidation | null {
  const dot = cookieValue.indexOf('.');
  if (dot < 0) return null;
  const sessionId = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!/^[a-f0-9]{64}$/.test(sessionId) || !/^[a-f0-9]{64}$/.test(sig)) return null;
  const expected = hmac(secret, sessionId);
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?')
    .get(sessionId) as { user_id: number; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  return { sessionId, userId: row.user_id, expiresAt: row.expires_at };
}

export function destroySession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function touchSession(sessionId: string): void {
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(
    Date.now() + SESSION_TTL_MS,
    sessionId,
  );
}

export const SESSION_COOKIE_NAME = 'zs_sid';
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/sessions.ts server/test/sessions.test.ts
git commit -m "feat(server): hmac-signed session cookie helpers"
```

---

### Task 8: Config — `SESSION_SECRET`, CORS, rate-limit env

The `config` module is loaded once at import time, so unit-testing "throws on missing env" via dynamic import fights vitest's module cache. Instead, isolate the env-parsing in pure functions and unit-test those; trust the top-level `throw` to fail fast in production.

**Files:**
- Modify: `server/src/config.ts`
- Modify: `server/vitest.config.ts`
- Test: `server/test/config.test.ts` (NEW)

- [ ] **Step 1: Write failing test (pure-function form — no module-cache games)**

```ts
// server/test/config.test.ts
import { describe, it, expect } from 'vitest';
import { parseSessionSecret, parseAllowedOrigins } from '../src/config.js';

describe('config parsers', () => {
  it('parseSessionSecret throws when missing in non-test mode', () => {
    expect(() => parseSessionSecret({ value: undefined, isTest: false })).toThrow(/SESSION_SECRET/);
  });
  it('parseSessionSecret throws when too short', () => {
    expect(() => parseSessionSecret({ value: 'short', isTest: false })).toThrow(/at least 32/);
  });
  it('parseSessionSecret returns the value when valid', () => {
    expect(parseSessionSecret({ value: 'a'.repeat(64), isTest: false })).toBe('a'.repeat(64));
  });
  it('parseSessionSecret returns a default in test mode', () => {
    expect(parseSessionSecret({ value: undefined, isTest: true })).toMatch(/^.{32,}$/);
  });
  it('parseAllowedOrigins splits and trims', () => {
    expect(parseAllowedOrigins('a, b ,c')).toEqual(['a', 'b', 'c']);
  });
  it('parseAllowedOrigins falls back when empty', () => {
    expect(parseAllowedOrigins(undefined)).toEqual(['http://localhost:5173']);
  });
});
```

- [ ] **Step 2: Run — must fail (functions don't exist yet)**

- [ ] **Step 3: Edit `server/src/config.ts`**

Add the two pure parsers and consume them at module load. Append (do NOT remove existing exports):

```ts
function envInt2(name: string, fallback: number): number {
  // existing envInt has the same body; reuse if already exported. If not, alias here.
  return envInt(name, fallback);
}

export function parseSessionSecret(input: { value: string | undefined; isTest: boolean }): string {
  if (!input.value) {
    if (input.isTest) return 'a'.repeat(64);
    throw new Error('Missing required env var: SESSION_SECRET');
  }
  if (input.value.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 chars');
  }
  return input.value;
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return ['http://localhost:5173'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
```

Then change the `config` object to consume them. Find the existing `export const config = { ... } as const;` and add fields:

```ts
export const config = {
  // ... existing fields unchanged ...
  sessionSecret: parseSessionSecret({
    value: process.env.SESSION_SECRET,
    isTest: process.env.NODE_ENV === 'test',
  }),
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  rateLimitLoginPerMin: envInt('RATE_LIMIT_LOGIN_PER_MIN', 10),
  rateLimitAuthPerMin:  envInt('RATE_LIMIT_AUTH_PER_MIN', 30),
  isProd: process.env.NODE_ENV === 'production',
} as const;
```

- [ ] **Step 4: Update `server/vitest.config.ts` to set `NODE_ENV: 'test'`**

In the `test.env` block, add:

```ts
NODE_ENV: 'test',
```

(SESSION_SECRET is *not* set by tests — `parseSessionSecret` returns a default when `isTest`.)

- [ ] **Step 5: Run — must pass**

```bash
npm test --workspace=server -- --run test/config.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add server/src/config.ts server/vitest.config.ts server/test/config.test.ts
git commit -m "feat(server): config — SESSION_SECRET, ALLOWED_ORIGINS, rate-limit envs"
```

---

### Task 9: `requireAuth` middleware

**Files:**
- Create: `server/src/requireAuth.ts`
- Test: `server/test/require-auth.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/require-auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { requireAuth } from '../src/requireAuth.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/sessions.js';
import { db } from '../src/db.js';
import { config } from '../src/config.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  app.addHook('preHandler', requireAuth);
  app.get('/secret', async (req: any) => ({ userId: req.user?.id }));
  return app;
}

describe('requireAuth', () => {
  it('returns 401 with no cookie and no bearer', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'GET', url: '/secret' });
    expect(r.statusCode).toBe(401);
  });

  it('returns 200 with a valid session cookie and exposes req.user', async () => {
    const userId = (db.prepare(
      'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
    ).get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue } = createSession(userId, config.sessionSecret);
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/secret',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ userId });
  });

  it('returns 401 for a revoked-/expired session', async () => {
    const userId = (db.prepare(
      'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
    ).get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue, sessionId } = createSession(userId, config.sessionSecret);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() - 1, sessionId);
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/secret',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(r.statusCode).toBe(401);
  });

  it('returns 401 for a bearer token in Phase A (no devices yet)', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/secret',
      headers: { authorization: 'Bearer aabbccdd' },
    });
    expect(r.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Implement `server/src/requireAuth.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { db } from './db.js';
import { validateCookie, touchSession, SESSION_COOKIE_NAME } from './sessions.js';
import { config } from './config.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: number };
    session?: { id: string };
    device?: { id: number };
  }
}

function hashToken(t: string): string {
  return crypto.createHash('sha256').update(t).digest('hex');
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 1. Cookie session
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const cookieValue = cookies?.[SESSION_COOKIE_NAME];
  if (cookieValue) {
    const v = validateCookie(cookieValue, config.sessionSecret);
    if (v) {
      req.user = { id: v.userId };
      req.session = { id: v.sessionId };
      // Sliding window: refresh expiry on every authenticated request.
      touchSession(v.sessionId);
      return;
    }
  }

  // 2. Bearer token (Phase B+ uses devices; Phase A still validates the table for forward compat)
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token) {
      const row = db
        .prepare(
          `SELECT id, user_id FROM devices WHERE token_hash = ? AND revoked_at IS NULL`,
        )
        .get(hashToken(token)) as { id: number; user_id: number } | undefined;
      if (row) {
        req.user = { id: row.user_id };
        req.device = { id: row.id };
        db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(Date.now(), row.id);
        return;
      }
    }
  }

  reply.code(401).send({ error: 'unauthorized' });
}
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/requireAuth.ts server/test/require-auth.test.ts
git commit -m "feat(server): requireAuth pre-handler (cookie + bearer)"
```

---

### Task 10: Test fixtures — owner + login helpers

**Files:**
- Create: `server/test/fixtures/owner.ts`

- [ ] **Step 1: Implement (no separate test — used by later tasks)**

```ts
// server/test/fixtures/owner.ts
import { createOwner, setTotpSecret } from '../../src/users.js';
import { generateTotpSecret } from '../../src/totp.js';
import { createSession, SESSION_COOKIE_NAME } from '../../src/sessions.js';
import { config } from '../../src/config.js';

export async function seedOwner(input: {
  email?: string;
  password?: string;
  totp?: boolean;
} = {}): Promise<{
  userId: number;
  email: string;
  password: string;
  totpSecret: string | null;
}> {
  const email = input.email ?? 'owner@example.com';
  const password = input.password ?? 'hunter2-correct-horse-battery';
  const userId = await createOwner({ email, password });
  let totpSecret: string | null = null;
  if (input.totp) {
    totpSecret = generateTotpSecret();
    setTotpSecret(userId, totpSecret);
  }
  return { userId, email, password, totpSecret };
}

export function makeSessionCookie(userId: number): string {
  const { cookieValue } = createSession(userId, config.sessionSecret);
  return `${SESSION_COOKIE_NAME}=${cookieValue}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/test/fixtures/owner.ts
git commit -m "test(server): owner + session-cookie test fixtures"
```

---

### Task 11: `POST /api/auth/login` — happy path (no TOTP)

**Files:**
- Create: `server/src/routes/auth.ts`
- Test: `server/test/auth-login.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/auth-login.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { seedOwner } from './fixtures/owner.js';
import { db } from '../src/db.js';
import { SESSION_COOKIE_NAME } from '../src/sessions.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/login', () => {
  it('returns 200 + sets a session cookie on correct credentials', async () => {
    const { email, password, userId } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    const setCookie = r.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const setCookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie!;
    expect(setCookieStr).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookieStr).toContain('HttpOnly');
    // Audit row recorded
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'login.ok'").get() as any;
    expect(audit.user_id).toBe(userId);
  });

  it('returns 401 on wrong password (with audit row)', async () => {
    const { email } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: 'WRONG' },
    });
    expect(r.statusCode).toBe(401);
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'login.fail'").get() as any;
    expect(JSON.parse(audit.detail).reason).toBe('bad-password');
  });

  it('returns 401 on unknown email (same shape as wrong password)', async () => {
    await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'nobody@example.com', password: 'whatever' },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ error: 'invalid-credentials' });
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'login.fail'").get() as any;
    expect(JSON.parse(audit.detail).reason).toBe('unknown-email');
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Implement `server/src/routes/auth.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getOwnerByEmail, verifyPassword } from '../users.js';
import { verifyTotp } from '../totp.js';
import { createSession, destroySession, SESSION_COOKIE_NAME } from '../sessions.js';
import { config } from '../config.js';
import { recordAudit } from '../audit.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid-body' });
      return;
    }
    const { email, password, totp } = parsed.data;
    const user = getOwnerByEmail(email);
    const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;

    if (!user) {
      recordAudit({ event: 'login.fail', detail: { reason: 'unknown-email', email }, ip, userAgent: ua });
      reply.code(401).send({ error: 'invalid-credentials' });
      return;
    }
    const ok = await verifyPassword(user.password_hash, password);
    if (!ok) {
      recordAudit({ event: 'login.fail', userId: user.id, detail: { reason: 'bad-password' }, ip, userAgent: ua });
      reply.code(401).send({ error: 'invalid-credentials' });
      return;
    }

    if (user.totp_secret) {
      if (!totp) {
        return { needs_totp: true };
      }
      if (!verifyTotp(user.totp_secret, totp)) {
        recordAudit({ event: 'totp.fail', userId: user.id, ip, userAgent: ua });
        reply.code(401).send({ error: 'invalid-credentials' });
        return;
      }
    }

    const { cookieValue } = createSession(user.id, config.sessionSecret, { ip: ip ?? null, userAgent: ua });
    reply.setCookie(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    recordAudit({ event: 'login.ok', userId: user.id, ip, userAgent: ua });
    return { ok: true };
  });
}
```

- [ ] **Step 4: Run — must pass**

```bash
npm test --workspace=server -- --run test/auth-login.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/test/auth-login.test.ts
git commit -m "feat(server): POST /api/auth/login (password-only)"
```

---

### Task 12: `POST /api/auth/login` — TOTP step

**Files:**
- Test: `server/test/auth-login.test.ts` (append)
- Modify: `server/src/routes/auth.ts` (already supports it from Task 11)

- [ ] **Step 1: Append failing tests**

```ts
import { authenticator } from 'otplib';

describe('login + TOTP', () => {
  it('returns needs_totp:true when TOTP is enabled and the code is missing', async () => {
    const { email, password } = await seedOwner({ totp: true });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ needs_totp: true });
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('accepts the correct TOTP code and issues a cookie', async () => {
    const { email, password, totpSecret } = await seedOwner({ totp: true });
    const code = authenticator.generate(totpSecret!);
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password, totp: code },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    expect(r.headers['set-cookie']).toBeTruthy();
  });

  it('rejects a wrong TOTP code', async () => {
    const { email, password } = await seedOwner({ totp: true });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password, totp: '000000' },
    });
    expect(r.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run — must pass (Task 11 already implemented this branch). Verify all login tests still pass.**

- [ ] **Step 3: Commit**

```bash
git add server/test/auth-login.test.ts
git commit -m "test(server): TOTP login flow coverage"
```

---

### Task 13: `POST /api/auth/logout`

**Files:**
- Modify: `server/src/routes/auth.ts`
- Test: `server/test/auth-logout.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/auth-logout.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db } from '../src/db.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/logout', () => {
  it('clears the cookie and deletes the session row', async () => {
    const { userId } = await seedOwner();
    const cookieHeader = makeSessionCookie(userId);
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: cookieHeader },
    });
    expect(r.statusCode).toBe(200);
    const setCookie = r.headers['set-cookie'];
    expect(String(setCookie)).toContain('zs_sid=;');
    expect(db.prepare('SELECT count(*) AS c FROM sessions').get()).toEqual({ c: 0 });
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'logout'").get() as any;
    expect(audit.user_id).toBe(userId);
  });

  it('is idempotent without a cookie', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(r.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Append to `server/src/routes/auth.ts`**

```ts
  app.post('/api/auth/logout', async (req, reply) => {
    const cookies = (req as any).cookies as Record<string, string> | undefined;
    const raw = cookies?.[SESSION_COOKIE_NAME];
    if (raw) {
      const dot = raw.indexOf('.');
      const sessionId = dot >= 0 ? raw.slice(0, dot) : raw;
      destroySession(sessionId);
      const userId = (req as any).user?.id ?? null;
      recordAudit({ event: 'logout', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  });
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/test/auth-logout.test.ts
git commit -m "feat(server): POST /api/auth/logout"
```

---

### Task 14: `GET /api/auth/me` (used by webmail boot to check session)

**Files:**
- Modify: `server/src/routes/auth.ts`
- Test: `server/test/auth-me.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/auth-me.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  // /me path needs requireAuth
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/auth/me')) await requireAuth(req as any, reply as any);
  });
  await app.register(authRoutes);
  return app;
}

describe('GET /api/auth/me', () => {
  it('returns the user when authenticated', async () => {
    const { userId, email } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ user: { id: userId, email, totp_enabled: false } });
  });

  it('returns 401 without a session', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(r.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Append to `server/src/routes/auth.ts`**

```ts
import { getOwnerById } from '../users.js';

  app.get('/api/auth/me', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    return { user: { id: u.id, email: u.email, totp_enabled: !!u.totp_secret } };
  });
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/test/auth-me.test.ts
git commit -m "feat(server): GET /api/auth/me"
```

---

### Task 15: `POST /api/auth/password` (change password)

**Files:**
- Modify: `server/src/routes/auth.ts`
- Test: `server/test/auth-password.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/auth-password.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { getOwnerById, verifyPassword } from '../src/users.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/auth/password')) await requireAuth(req as any, reply as any);
  });
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/password', () => {
  it('updates the hash given the correct current password', async () => {
    const { userId, password } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { currentPassword: password, newPassword: 'NewerPass!12345' },
    });
    expect(r.statusCode).toBe(200);
    const fresh = getOwnerById(userId)!;
    expect(await verifyPassword(fresh.password_hash, 'NewerPass!12345')).toBe(true);
  });

  it('returns 401 if the current password is wrong', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { currentPassword: 'WRONG', newPassword: 'whatever1234' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('rejects a too-short new password', async () => {
    const { userId, password } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { currentPassword: password, newPassword: 'short' },
    });
    expect(r.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Append to `server/src/routes/auth.ts`**

```ts
import { updateOwnerPassword } from '../users.js';

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'password must be >=12 chars'),
});

  app.post('/api/auth/password', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const ok = await verifyPassword(u.password_hash, parsed.data.currentPassword);
    if (!ok) { reply.code(401).send({ error: 'invalid-credentials' }); return; }
    await updateOwnerPassword(userId, parsed.data.newPassword);
    recordAudit({ event: 'password.changed', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { ok: true };
  });
```

(Add `verifyPassword` to the imports at the top of the file.)

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/test/auth-password.test.ts
git commit -m "feat(server): POST /api/auth/password"
```

---

### Task 16: TOTP routes — setup, confirm, disable

**Files:**
- Modify: `server/src/routes/auth.ts`
- Test: `server/test/auth-totp.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// server/test/auth-totp.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authenticator } from 'otplib';
import { authRoutes } from '../src/routes/auth.js';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { getOwnerById } from '../src/users.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/auth/totp')) await requireAuth(req as any, reply as any);
  });
  await app.register(authRoutes);
  return app;
}

describe('TOTP setup → confirm → disable', () => {
  it('setup returns a secret + otpauth URI but does NOT enable yet', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/totp/setup',
      headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(body.otpauth_url).toMatch(/^otpauth:\/\//);
    // Not enabled yet — the secret is a *candidate*, stored in the user row but only confirmed below
    expect(getOwnerById(userId)!.totp_enabled_at).toBeNull();
  });

  it('confirm enables TOTP given a valid code', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    const setup = await app.inject({
      method: 'POST', url: '/api/auth/totp/setup',
      headers: { cookie: makeSessionCookie(userId) },
    });
    const { secret } = setup.json();
    const code = authenticator.generate(secret);
    const r = await app.inject({
      method: 'POST', url: '/api/auth/totp/confirm',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { code },
    });
    expect(r.statusCode).toBe(200);
    expect(getOwnerById(userId)!.totp_enabled_at).not.toBeNull();
  });

  it('confirm rejects a bad code', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/api/auth/totp/setup',
      headers: { cookie: makeSessionCookie(userId) },
    });
    const r = await app.inject({
      method: 'POST', url: '/api/auth/totp/confirm',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { code: '000000' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('disable requires the password and clears the secret', async () => {
    const { userId, password } = await seedOwner({ totp: true });
    const app = await buildApp();
    const r = await app.inject({
      method: 'DELETE', url: '/api/auth/totp',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { password },
    });
    expect(r.statusCode).toBe(200);
    expect(getOwnerById(userId)!.totp_secret).toBeNull();
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Append to `server/src/routes/auth.ts`**

```ts
import { generateTotpSecret, provisioningUri } from '../totp.js';
import { setTotpSecret } from '../users.js';
import { db } from '../db.js';

  app.post('/api/auth/totp/setup', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const secret = generateTotpSecret();
    // Store as candidate — totp_enabled_at stays null until /confirm
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled_at = NULL WHERE id = ?').run(secret, userId);
    return { secret, otpauth_url: provisioningUri(u.email, secret) };
  });

  const totpConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
  app.post('/api/auth/totp/confirm', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const parsed = totpConfirmSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
    const u = getOwnerById(userId);
    if (!u || !u.totp_secret) { reply.code(400).send({ error: 'no-pending-totp' }); return; }
    if (!verifyTotp(u.totp_secret, parsed.data.code)) {
      recordAudit({ event: 'totp.fail', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
      reply.code(401).send({ error: 'invalid-code' });
      return;
    }
    db.prepare('UPDATE users SET totp_enabled_at = ? WHERE id = ?').run(Date.now(), userId);
    recordAudit({ event: 'totp.enabled', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { ok: true };
  });

  const totpDisableSchema = z.object({ password: z.string().min(1) });
  app.delete('/api/auth/totp', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const parsed = totpDisableSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    if (!(await verifyPassword(u.password_hash, parsed.data.password))) {
      reply.code(401).send({ error: 'invalid-credentials' }); return;
    }
    setTotpSecret(userId, null);
    recordAudit({ event: 'totp.disabled', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { ok: true };
  });
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/test/auth-totp.test.ts
git commit -m "feat(server): TOTP setup/confirm/disable routes"
```

---

### Task 17: Wire `requireAuth` into `api.ts` with route allowlist

**Files:**
- Modify: `server/src/api.ts`
- Test: `server/test/require-auth-existing.test.ts` (NEW)

This task gates **every existing route**. The webmail will be unusable until Task 19 ships the login form, but that's by design — Phase A's contract is that you can sign in.

- [ ] **Step 1: Write a failing integration test**

```ts
// server/test/require-auth-existing.test.ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';

describe('existing routes are gated', () => {
  it('GET /api/mailboxes returns 401 without auth', async () => {
    const app = await startApi({ inject: true } as any);
    const r = await app.inject({ method: 'GET', url: '/api/mailboxes' });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('GET /api/health stays public', async () => {
    const app = await startApi({ inject: true } as any);
    const r = await app.inject({ method: 'GET', url: '/api/health' });
    expect(r.statusCode).toBe(200);
    await app.close();
  });
});
```

(Note: `startApi` currently does `app.listen` then return nothing. Refactor it to also support an `{inject: true}` mode that returns the Fastify instance unstarted. See Step 3.)

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Edit `server/src/api.ts`**

Top-of-file additions (after existing imports):

```ts
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { requireAuth } from './requireAuth.js';
```

Refactor `startApi` to support a test-mode signature:

```ts
export async function startApi(opts: { inject?: boolean } = {}) {
  const app = Fastify({ logger: { level: config.logLevel } });
  await app.register(cookie);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (config.allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('CORS-not-allowed'), false);
    },
    credentials: true,
  });
  await app.register(rateLimit, { global: false });

  // Public routes (no auth) — health check + auth endpoints themselves
  const PUBLIC_PREFIXES = ['/api/health', '/api/auth/login', '/api/auth/logout'];
  app.addHook('preHandler', async (req, reply) => {
    if (PUBLIC_PREFIXES.some((p) => req.url === p || req.url.startsWith(p + '?'))) return;
    await requireAuth(req as any, reply as any);
  });

  await app.register(authRoutes);

  app.get('/api/health', async () => ({ ok: true }));

  // ... existing route registrations stay below ...
  // (the rest of the file's body is unchanged)

  if (opts.inject) {
    await app.ready();
    return app;
  }
  await app.listen({ port: config.apiPort, host: '0.0.0.0' });
  return app;
}
```

Important: the existing `app.get('/api/health', ...)` line at the top of the function is duplicated — remove the *original* now that we're re-declaring it after the preHandler. Do NOT remove any other existing route.

Also update `server/src/index.ts`:

```ts
import { startApi } from './api.js';

async function main() {
  startSmtp();
  await startApi();   // keeps default behavior (listen)
  startSweeper();
}
```

(No changes needed if it's already this shape — verify.)

- [ ] **Step 4: Run all server tests — most existing tests still pass; the gating test now passes**

```bash
npm test --workspace=server
```

If existing API tests fail because they expected unauthenticated access, fix them by injecting a session cookie via `makeSessionCookie(seedOwner().userId)`. Phase 3 (digest) added some integration tests; if any exist, update them.

- [ ] **Step 5: Commit**

```bash
git add server/src/api.ts server/src/index.ts server/test/require-auth-existing.test.ts
git commit -m "feat(server): gate /api/* behind requireAuth (allowlist /health, /auth/login)"
```

---

### Task 18: Login route rate limit

**Files:**
- Modify: `server/src/routes/auth.ts`
- Test: `server/test/rate-limit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// server/test/rate-limit.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from '../src/routes/auth.js';
import { config } from '../src/config.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(authRoutes);
  return app;
}

describe('rate limit', () => {
  it('limits /api/auth/login to RATE_LIMIT_LOGIN_PER_MIN per IP', async () => {
    const app = await buildApp();
    const max = config.rateLimitLoginPerMin;
    let lastStatus = 0;
    for (let i = 0; i < max + 2; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@x.com', password: 'whatever' },
      });
      lastStatus = r.statusCode;
    }
    expect(lastStatus).toBe(429);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Add rate-limit config to the login route**

In `server/src/routes/auth.ts`, change `app.post('/api/auth/login', ...)` to:

```ts
app.post('/api/auth/login', {
  config: {
    rateLimit: { max: config.rateLimitLoginPerMin, timeWindow: '1 minute' },
  },
}, async (req, reply) => { /* unchanged body */ });
```

The `{config:{rateLimit}}` form requires `@fastify/rate-limit` to be registered with `global: false` (already done in Task 17). For TOTP/password endpoints, apply the lighter `rateLimitAuthPerMin`:

```ts
app.post('/api/auth/totp/setup', {
  config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
}, /* ... */);
// repeat for /confirm, /password, DELETE /totp
```

- [ ] **Step 4: Run — must pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/test/rate-limit.test.ts
git commit -m "feat(server): rate limit on /api/auth/* (per-IP)"
```

---

### Task 19: Owner-bootstrap CLI (`npm run seed:owner`)

**Files:**
- Create: `server/src/seed-owner.ts`
- Modify: root `package.json` (add script)
- Test: `server/test/seed-owner.test.ts`

- [ ] **Step 1: Write failing test (non-interactive flag form)**

```ts
// server/test/seed-owner.test.ts
import { describe, it, expect } from 'vitest';
import { runSeedOwner } from '../src/seed-owner.js';
import { db } from '../src/db.js';

describe('seed:owner', () => {
  it('creates the owner row from CLI flags (non-interactive)', async () => {
    await runSeedOwner({
      argv: ['--email', 'alice@example.com', '--password', 'hunter2-correct-horse'],
    });
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get('alice@example.com') as any;
    expect(u).toBeTruthy();
  });

  it('refuses to overwrite an existing owner', async () => {
    await runSeedOwner({ argv: ['--email', 'alice@example.com', '--password', 'pass-one-12345'] });
    await expect(
      runSeedOwner({ argv: ['--email', 'alice@example.com', '--password', 'pass-two-12345'] }),
    ).rejects.toThrow(/already exists/i);
  });
});
```

- [ ] **Step 2: Run — must fail**

- [ ] **Step 3: Implement `server/src/seed-owner.ts`**

```ts
import { createOwner, getOwnerByEmail } from './users.js';

export type SeedOwnerOpts = { argv: string[] };

function parse(argv: string[]): { email?: string; password?: string } {
  const out: { email?: string; password?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email') out.email = argv[++i];
    else if (argv[i] === '--password') out.password = argv[++i];
  }
  return out;
}

async function prompt(question: string, hidden = false): Promise<string> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (!hidden) {
    const a = await rl.question(question);
    rl.close();
    return a;
  }
  // For hidden input (password), turn off echo manually.
  process.stdout.write(question);
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    const onData = (b: Buffer) => {
      const c = b.toString('utf8');
      if (c === '\n' || c === '\r') {
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(buf);
      } else if (c === '') { process.exit(130); }
      else if (c === '') { buf = buf.slice(0, -1); }
      else { buf += c; }
    };
    process.stdin.on('data', onData);
  });
}

export async function runSeedOwner(opts: SeedOwnerOpts): Promise<void> {
  const flags = parse(opts.argv);
  const email = flags.email ?? (await prompt('Owner email: '));
  if (getOwnerByEmail(email)) {
    throw new Error(`Owner already exists: ${email}`);
  }
  const password = flags.password ?? (await prompt('Owner password (>=12 chars): ', true));
  if (password.length < 12) throw new Error('password must be >= 12 chars');
  const id = await createOwner({ email, password });
  console.log(`✓ owner created: ${email} (id=${id})`);
}

// Direct invocation
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeedOwner({ argv: process.argv.slice(2) }).catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Add the root script**

In `package.json` (the workspace root, not `server/package.json`):

```json
"seed:owner": "tsx server/src/seed-owner.ts"
```

- [ ] **Step 5: Run — must pass**

```bash
npm test --workspace=server -- --run test/seed-owner.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add server/src/seed-owner.ts package.json server/test/seed-owner.test.ts
git commit -m "feat(server): npm run seed:owner CLI"
```

---

### Task 20: Webmail `api.ts` — credentials + auth helpers

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/types.ts`

- [ ] **Step 1: Update `web/src/api.ts`'s `j()` helper**

Replace:
```ts
async function j<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  ...
}
```

with:
```ts
async function j<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (r.status === 401) {
    // Surface a typed signal that the App can catch.
    throw Object.assign(new Error('unauthorized'), { status: 401 });
  }
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}
```

- [ ] **Step 2: Add auth helpers to the `api` object**

Append within the `export const api = {...}` object (preserve trailing comma style):

```ts
  // auth
  authMe: () => j<{ user: { id: number; email: string; totp_enabled: boolean } }>('/api/auth/me'),
  authLogin: (b: { email: string; password: string; totp?: string }) =>
    j<{ ok: true } | { needs_totp: true }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(b),
    }),
  authLogout: () => j<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  authChangePassword: (b: { currentPassword: string; newPassword: string }) =>
    j<{ ok: true }>('/api/auth/password', { method: 'POST', body: JSON.stringify(b) }),
  totpSetup: () => j<{ secret: string; otpauth_url: string }>('/api/auth/totp/setup', { method: 'POST' }),
  totpConfirm: (b: { code: string }) => j<{ ok: true }>('/api/auth/totp/confirm', { method: 'POST', body: JSON.stringify(b) }),
  totpDisable: (b: { password: string }) => j<{ ok: true }>('/api/auth/totp', { method: 'DELETE', body: JSON.stringify(b) }),
```

- [ ] **Step 3: Add types in `web/src/types.ts`**

```ts
export type AuthMe = { user: { id: number; email: string; totp_enabled: boolean } };
export type LoginRequest = { email: string; password: string; totp?: string };
export type LoginResponse = { ok: true } | { needs_totp: true };
```

- [ ] **Step 4: Manual verify**

```bash
npm run dev:web
```

Open browser → DevTools → Network. Refresh page. `/api/auth/me` should return 401 with `Set-Cookie` honored on subsequent requests.

- [ ] **Step 5: Commit**

```bash
git add web/src/api.ts web/src/types.ts
git commit -m "feat(web): credentials:include + auth API helpers"
```

---

### Task 21: Webmail `LoginForm` component

**Files:**
- Create: `web/src/components/LoginForm.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Implement `LoginForm`**

```tsx
// web/src/components/LoginForm.tsx
import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Shield } from 'lucide-react';

export default function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const totpRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (needsTotp) totpRef.current?.focus(); }, [needsTotp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.authLogin({ email, password, totp: needsTotp ? totp : undefined });
      if ('needs_totp' in r) { setNeedsTotp(true); return; }
      onSuccess();
    } catch (e: any) {
      if (e?.status === 401) setErr('Invalid credentials');
      else if (e?.status === 429) setErr('Too many attempts. Try again later.');
      else setErr(e?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-white p-8 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-700">
          <Shield className="w-5 h-5" />
          <h1 className="text-lg font-semibold">ZeroSpam</h1>
        </div>
        <label className="block">
          <span className="text-sm text-zinc-600">Email</span>
          <input type="email" required autoFocus
            className="mt-1 w-full border border-zinc-300 rounded px-3 py-2"
            value={email} onChange={(e) => setEmail(e.target.value)} disabled={needsTotp || busy} />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-600">Password</span>
          <input type="password" required
            className="mt-1 w-full border border-zinc-300 rounded px-3 py-2"
            value={password} onChange={(e) => setPassword(e.target.value)} disabled={needsTotp || busy} />
        </label>
        {needsTotp && (
          <label className="block">
            <span className="text-sm text-zinc-600">Authenticator code</span>
            <input ref={totpRef} inputMode="numeric" pattern="\d{6}" required
              className="mt-1 w-full border border-zinc-300 rounded px-3 py-2 font-mono tracking-widest"
              value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={busy} />
          </label>
        )}
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button type="submit" disabled={busy}
          className="w-full bg-zinc-900 text-white rounded py-2 hover:bg-zinc-800 disabled:opacity-50">
          {busy ? 'Signing in…' : needsTotp ? 'Verify' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Modify `web/src/App.tsx`**

At the top of `App()`, add an auth-check effect and gate the render:

```tsx
import LoginForm from './components/LoginForm';

// ...inside App():
const [authed, setAuthed] = useState<boolean | null>(null); // null = checking
useEffect(() => {
  api.authMe()
    .then(() => setAuthed(true))
    .catch(() => setAuthed(false));
}, []);

if (authed === null) return null; // (or a quick spinner)
if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;

// ... existing render below ...
```

- [ ] **Step 3: Manual verify**

```bash
npm run dev    # starts server + web together
```

1. Open `http://localhost:5173`. You should see the login form.
2. With no owner created, login fails with "Invalid credentials".
3. Run `npm run seed:owner -- --email me@local --password testpassword12345`.
4. Log in; the existing webmail renders.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/LoginForm.tsx web/src/App.tsx
git commit -m "feat(web): login gate + LoginForm component"
```

---

### Task 22: Webmail TOTP setup modal (settings)

**Files:**
- Create: `web/src/components/TotpSetupModal.tsx`
- Modify: `web/src/App.tsx` (add a "Security" item somewhere reachable; minimal placement is acceptable for Phase A)

- [ ] **Step 1: Implement `TotpSetupModal`**

```tsx
// web/src/components/TotpSetupModal.tsx
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function TotpSetupModal({ onClose }: { onClose: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.totpSetup().then((r) => { setSecret(r.secret); setOtpauth(r.otpauth_url); }).catch(() => {});
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api.totpConfirm({ code }); setDone(true); }
    catch (e: any) { setErr(e?.status === 401 ? 'Wrong code, try again' : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="font-semibold">Two-factor authentication</h2>
        {!secret && <div>Loading…</div>}
        {secret && !done && (
          <>
            <p className="text-sm text-zinc-600">
              Scan this in your authenticator app, then enter the code below.
            </p>
            <pre className="bg-zinc-100 p-2 rounded text-xs break-all">{otpauth}</pre>
            <details className="text-sm">
              <summary className="cursor-pointer text-zinc-600">Or enter the secret manually</summary>
              <code className="block mt-1 font-mono text-sm">{secret}</code>
            </details>
            <form onSubmit={confirm} className="space-y-2">
              <input inputMode="numeric" pattern="\d{6}" required
                className="w-full border border-zinc-300 rounded px-3 py-2 font-mono tracking-widest"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" />
              {err && <div className="text-sm text-red-600">{err}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onClose} className="px-3 py-1 text-zinc-600">Cancel</button>
                <button type="submit" disabled={busy} className="bg-zinc-900 text-white px-3 py-1 rounded">
                  {busy ? 'Verifying…' : 'Verify & enable'}
                </button>
              </div>
            </form>
          </>
        )}
        {done && (
          <div className="space-y-3">
            <div className="text-green-700">Two-factor enabled.</div>
            <button onClick={onClose} className="bg-zinc-900 text-white px-3 py-1 rounded">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Surface it from App**

For Phase A, attach a tiny "Security" trigger to the existing settings cog (Settings icon in App.tsx). Add state:

```tsx
const [showSecurity, setShowSecurity] = useState(false);
// ... wire showSecurity true via a button in the existing settings dropdown
{showSecurity && <TotpSetupModal onClose={() => setShowSecurity(false)} />}
```

The exact wiring depends on App.tsx's current structure — read the existing settings menu code and add a "Two-factor authentication…" entry beside DKIM/Mailboxes.

- [ ] **Step 3: Manual verify**

Sign in → open settings → click "Two-factor authentication…" → scan with an authenticator app (e.g., 1Password, Google Authenticator) → enter code → see "enabled". Sign out, sign in again, and confirm the TOTP step appears.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/TotpSetupModal.tsx web/src/App.tsx
git commit -m "feat(web): TOTP setup modal + settings wiring"
```

---

### Task 23: README + docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the "Phase status" section**

Add to the Phase 4 line (or whatever's next):

```markdown
- 🚧 **Phase 4 (Mobile, in progress)**: Phase A done — single-owner auth (argon2id + optional TOTP), HMAC-signed session cookies, audit log, login rate limit, webmail login gate. See [docs/superpowers/specs/2026-04-29-mobile-app-design.md](docs/superpowers/specs/2026-04-29-mobile-app-design.md) and [docs/superpowers/plans/2026-04-29-mobile-app-phase-a-auth-foundation.md](docs/superpowers/plans/2026-04-29-mobile-app-phase-a-auth-foundation.md).
```

Add a new "Owner bootstrap" section under Quick start:

```markdown
### Owner bootstrap

The webmail requires you to sign in as a single owner. To create the owner:

​```bash
npm run seed:owner                                                 # interactive
npm run seed:owner -- --email me@local --password 'a-good-password' # non-interactive
​```

Then open <http://localhost:5173> and sign in.
```

Add to `Configuration`:

```markdown
SESSION_SECRET=<32+ random chars>      # required in production
ALLOWED_ORIGINS=http://localhost:5173  # comma-separated, CORS allowlist
RATE_LIMIT_LOGIN_PER_MIN=10            # default 10
RATE_LIMIT_AUTH_PER_MIN=30             # default 30
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): Phase A — owner auth + login + TOTP + bootstrap CLI"
```

---

### Task 24: End-to-end smoke

**Files:**
- Test: `server/test/e2e-auth.test.ts`

- [ ] **Step 1: Write integration test**

```ts
// server/test/e2e-auth.test.ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { runSeedOwner } from '../src/seed-owner.js';

describe('e2e: bootstrap → login → protected → logout', () => {
  it('walks the complete path', async () => {
    await runSeedOwner({ argv: ['--email', 'e2e@example.com', '--password', 'hunter-correct-horse'] });
    const app = await startApi({ inject: true } as any);

    // Protected route is 401
    let r = await app.inject({ method: 'GET', url: '/api/mailboxes' });
    expect(r.statusCode).toBe(401);

    // Login
    r = await app.inject({
      method: 'POST', url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'e2e@example.com', password: 'hunter-correct-horse' },
    });
    expect(r.statusCode).toBe(200);
    const setCookie = (r.headers['set-cookie'] as string | string[] | undefined);
    const cookieHeader = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(';')[0];

    // /me returns the user
    r = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);
    expect(r.json().user.email).toBe('e2e@example.com');

    // Protected route now succeeds
    r = await app.inject({ method: 'GET', url: '/api/mailboxes', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);

    // Logout
    r = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);

    // Now protected route is 401 again
    r = await app.inject({ method: 'GET', url: '/api/mailboxes', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(401);

    await app.close();
  });
});
```

- [ ] **Step 2: Run — must pass**

```bash
npm test --workspace=server
```

- [ ] **Step 3: Commit**

```bash
git add server/test/e2e-auth.test.ts
git commit -m "test(server): e2e bootstrap → login → protected → logout"
```

---

## Verification checklist (pre-merge)

- [ ] `npm test --workspaces --if-present` is all-green from the worktree root.
- [ ] `npm run typecheck` (set up in Section 8 of the spec — if not yet wired, just `tsc -b server`) is clean.
- [ ] `npm run dev` boots server + web; `/api/health` is 200 unauthenticated; everything else is 401.
- [ ] `npm run seed:owner -- --email me@local --password testpassword12345` creates the row.
- [ ] Sign in via the webmail UI; refresh the page (cookie persists); sign out (cookie cleared, login form returns).
- [ ] Enable TOTP via the security modal; sign out; sign back in (TOTP step appears).
- [ ] Disable TOTP via the modal (with password); sign in without a code.
- [ ] Tail `audit_log`: `sqlite3 server/data/zerospam.sqlite 'SELECT event,user_id,detail,at FROM audit_log ORDER BY id DESC LIMIT 20;'` shows the expected events.
- [ ] Hammer login 11+ times in <1m → see 429.

---

## Open issues / future-phase notes

- **Phase B prerequisites already in place:** `pairing_codes` and `devices` tables exist; `requireAuth` already validates bearer tokens. Phase B's plan adds `/api/devices/pair-init` (cookie-auth), `/api/mobile/pair` (consumes code, mints token), and the webmail "Devices" UI.
- **No revoke-all-sessions yet.** Owner can sign out their current session; killing every other session simultaneously is out-of-scope for Phase A. Add a "Sign out everywhere" button in Phase B alongside the device list.
- **No password reset.** Single-owner system; if the owner forgets the password, they can re-run `seed:owner` after manually deleting the row, or use a future `reset-owner` CLI. Out of scope.
- **CSRF.** `SameSite=Lax` cookie + JSON-content-type APIs is sufficient for our threat model. We do *not* implement an explicit CSRF token. If we ever expose form-encoded POSTs that mutate state, revisit.
- **Headers.** HSTS / CSP for the API are added at the Caddy layer in Phase F, not in Fastify. Don't add them here.
