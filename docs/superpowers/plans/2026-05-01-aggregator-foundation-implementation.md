# Aggregator Foundation Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert ZeroSpam from single-bootstrapped-owner to a multi-tenant-aware webmail with open signup and email verification, while preserving every existing route's behaviour for `account_id = 1`.

**Architecture:** Add an `accounts` table that all per-customer data hangs off. Backfill every existing row to `account_id = 1`. Every authenticated route resolves the caller's `account_id` from their session and scopes data access to it. New `POST /api/auth/signup` mints an account + user + native `@zero-spam.email` mailbox + a one-shot HMAC-signed verification token; `GET /auth/verify?t=...` confirms the email. Login is blocked until `users.email_verified_at` is set. The existing `seed:owner` CLI still works for ops; it simply sets `email_verified_at` automatically.

**Tech Stack:** TypeScript / Node 20 / Fastify / SQLite (`node:sqlite` `DatabaseSync`) / argon2 (existing) / `node:crypto` HMAC (mirroring `server/src/digest-token.ts` pattern). React 18 / Tailwind for the signup + verification UI. Vitest for tests.

---

## Reference Documents

- Spec: `docs/superpowers/specs/2026-05-01-aggregator-inbox-design.md` (sections §4, §5, §10)
- Existing token-signing pattern: `server/src/digest-token.ts`
- Existing auth flow: `server/src/routes/auth.ts`, `server/src/requireAuth.ts`, `server/src/sessions.ts`
- Existing seed-owner CLI: `server/src/seed-owner.ts`
- Existing user helpers: `server/src/users.ts`
- Existing schema + migrations: `server/src/db.ts`
- Test fixtures: `server/test/fixtures/owner.ts`

## File Structure

**New files:**
- `server/src/accounts.ts` — DB helpers: `ensureDefaultAccount`, `createAccount`, `getAccountById`.
- `server/src/usernames.ts` — Username validation, reserved-names list, availability check.
- `server/src/verify-token.ts` — HMAC-signed email-verification token (sign/verify), keyed off `config.sessionSecret` so we don't introduce a new secret.
- `server/src/verify-email-template.ts` — Plain HTML + text rendering for the verification email body.
- `server/src/routes/signup.ts` — `POST /api/auth/signup` and `GET /auth/verify`.
- `server/test/accounts.test.ts`
- `server/test/usernames.test.ts`
- `server/test/verify-token.test.ts`
- `server/test/auth-signup.test.ts`
- `server/test/auth-verify.test.ts`
- `server/test/account-scoping.test.ts`

**Modified files:**
- `server/src/db.ts` — `accounts` table, `account_id` on `users`/`mailboxes`/`domains`, `email_verified_at` on `users`, types, migration block, default-account seeding.
- `server/src/requireAuth.ts` — fetch `account_id` from `users` and attach `req.account = { id }`.
- `server/src/routes/auth.ts` — block login when `email_verified_at IS NULL`.
- `server/src/users.ts` — extend types and helpers to set `email_verified_at`.
- `server/src/seed-owner.ts` — set `email_verified_at = now()` so the bootstrap path is still usable.
- `server/src/api.ts` — register the new `signup` route plugin; allowlist `/api/auth/signup` and `/auth/verify` in `PUBLIC_PREFIXES`.
- `server/src/api.ts` — audit the existing routes that touch `mailboxes`, `messages`, `whitelist_rules`, `aliases`, `drafts` and add `account_id` filtering.
- `server/test/fixtures/owner.ts` — `seedOwner` returns the new `accountId`; verified by default.
- `server/test/setup.ts` — add `DELETE FROM accounts;` to per-test cleanup.
- `web/src/components/Signup.tsx` — new component (signup form).
- `web/src/components/VerifyEmail.tsx` — new component (verification result page).
- `web/src/App.tsx` — route the unauthenticated screens to `LoginForm` or `Signup` based on a tab.
- `web/src/api.ts` — `signup`, `verifyEmail` helpers.

## Test Infrastructure Notes

The plan stays inside the existing test harness: `vitest run`, `setupFiles: ['./test/setup.ts']`, the `vi.mock('nodemailer')` stub from `setup.ts` (so verification-email sends don't touch the network).

The biggest test addition is **account scoping** — for each route that accepts mailbox- or message-scoped params, we add a test where account A tries to read account B's data and gets a 404. To keep this concise, the plan introduces a single `account-scoping.test.ts` that exercises the four most representative routes (list mailboxes, list messages, list whitelist, get mailbox counts). The audit (Task 11) is responsible for the rest of the routes, but only those four routes get explicit cross-account tests — the audit pattern is the same and over-testing would be expensive boilerplate.

**Convention:** every test that calls `seedOwner()` now gets a verified owner by default (Task 9 updates the fixture). Tests that need an unverified user opt in via `seedOwner({ verified: false })`.

---

## Task 1: `accounts` table + `account_id` migrations + `email_verified_at`

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/test/setup.ts`
- Create: `server/test/accounts.test.ts`

- [ ] **Step 1.1: Write the failing schema test**

`server/test/accounts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('accounts schema', () => {
  it('accounts table has the required columns', () => {
    const cols = db.prepare('PRAGMA table_info(accounts)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    for (const c of ['id', 'name', 'plan', 'created_at']) {
      expect(names.has(c), `accounts missing: ${c}`).toBe(true);
    }
  });

  it('users has account_id and email_verified_at', () => {
    const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    expect(names.has('account_id')).toBe(true);
    expect(names.has('email_verified_at')).toBe(true);
  });

  it('mailboxes has account_id and provider', () => {
    const cols = db.prepare('PRAGMA table_info(mailboxes)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    expect(names.has('account_id')).toBe(true);
    expect(names.has('provider')).toBe(true);
  });

  it('domains has account_id', () => {
    const cols = db.prepare('PRAGMA table_info(domains)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    expect(names.has('account_id')).toBe(true);
  });

  it('the default account exists with id=1', () => {
    const row = db.prepare('SELECT id, name FROM accounts WHERE id = 1').get() as
      | { id: number; name: string }
      | undefined;
    expect(row?.id).toBe(1);
    expect(row?.name).toBe('default');
  });
});
```

- [ ] **Step 1.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/accounts.test.ts
```
Expected: FAIL — `accounts` table does not exist.

- [ ] **Step 1.3: Add the schema to `server/src/db.ts`**

Inside the `SCHEMA` template literal, just before the closing backtick (after the `audit_log` indices), add:
```sql
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  INTEGER NOT NULL
);
```

In the migrations block (where `colsOf` is used), add:
```ts
const userCols = colsOf('users');
if (!userCols.has('account_id')) {
  db.exec('ALTER TABLE users ADD COLUMN account_id INTEGER');
}
if (!userCols.has('email_verified_at')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified_at INTEGER');
}
const mailboxCols2 = colsOf('mailboxes');
if (!mailboxCols2.has('account_id')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN account_id INTEGER');
}
if (!mailboxCols2.has('provider')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN provider TEXT');
}
const domainCols2 = colsOf('domains');
if (!domainCols2.has('account_id')) {
  db.exec('ALTER TABLE domains ADD COLUMN account_id INTEGER');
}
```

(Use `mailboxCols2` and `domainCols2` to avoid clobbering the existing `mailboxCols` / `domainCols` consts already declared earlier in the migrations block.)

After the migrations block, seed the default account and backfill existing rows:
```ts
const defaultAccount = db.prepare('SELECT id FROM accounts WHERE id = 1').get() as
  | { id: number }
  | undefined;
if (!defaultAccount) {
  db.prepare(
    `INSERT INTO accounts (id, name, plan, created_at) VALUES (1, 'default', 'free', ?)`,
  ).run(Date.now());
}
db.exec(`UPDATE users      SET account_id = 1 WHERE account_id IS NULL`);
db.exec(`UPDATE mailboxes  SET account_id = 1 WHERE account_id IS NULL`);
db.exec(`UPDATE domains    SET account_id = 1 WHERE account_id IS NULL`);
db.exec(`UPDATE users      SET email_verified_at = created_at WHERE email_verified_at IS NULL`);
```

Add types at the bottom of `db.ts`:
```ts
export type Account = {
  id: number;
  name: string;
  plan: string;
  created_at: number;
};
```

Extend the existing `User` type (find it in `db.ts`):
```ts
export type User = {
  id: number;
  email: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enabled_at: number | null;
  account_id: number;
  email_verified_at: number | null;
  created_at: number;
};
```

Extend the existing `Mailbox` type to include `account_id` and `provider`:
```ts
export type Mailbox = {
  id: number;
  address: string;
  domain_id: number;
  display_name: string | null;
  quarantine_ttl_hours: number;
  created_at: number;
  digest_enabled: number;
  digest_hour: number;
  digest_recipient_mode: 'external' | 'loopback';
  owner_email: string | null;
  last_digest_sent_at: number | null;
  digest_last_error: string | null;
  digest_consecutive_failures: number;
  account_id: number;
  provider: 'gmail' | 'outlook' | null;
};
```

Extend the existing `Domain` type:
```ts
export type Domain = {
  id: number;
  name: string;
  created_at: number;
  dkim_selector: string | null;
  dkim_private_pem: string | null;
  dkim_public_pem: string | null;
  account_id: number;
};
```

- [ ] **Step 1.4: Update `server/test/setup.ts` cleanup**

Find the existing per-test wipe block. Replace with:
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
    DELETE FROM accounts WHERE id != 1;
  `);
});
```

Note: account `id=1` is preserved so it survives every test (matches the `account_id=1` invariant).

- [ ] **Step 1.5: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: all green; `accounts.test.ts` 5/5 passes; existing tests unaffected because `account_id=1` is set on every backfilled row.

- [ ] **Step 1.6: Commit**

```bash
git add server/src/db.ts server/test/setup.ts server/test/accounts.test.ts
git commit -m "feat(accounts): accounts table + account_id backfill + email_verified_at"
```

---

## Task 2: `accounts.ts` helpers

**Files:**
- Create: `server/src/accounts.ts`
- Modify: `server/test/accounts.test.ts`

- [ ] **Step 2.1: Append failing tests to `server/test/accounts.test.ts`**

```ts
import { createAccount, getAccountById, ensureDefaultAccount } from '../src/accounts.js';

describe('accounts helpers', () => {
  it('createAccount returns a row with the new id', () => {
    const a = createAccount('test-tenant');
    expect(a.id).toBeGreaterThan(1);
    expect(a.name).toBe('test-tenant');
    expect(a.plan).toBe('free');
  });

  it('getAccountById returns the account', () => {
    const a = createAccount('lookup');
    const got = getAccountById(a.id);
    expect(got?.name).toBe('lookup');
  });

  it('ensureDefaultAccount is idempotent', () => {
    ensureDefaultAccount();
    ensureDefaultAccount();
    const rows = db.prepare('SELECT COUNT(*) AS c FROM accounts WHERE id = 1').get() as { c: number };
    expect(rows.c).toBe(1);
  });
});
```

- [ ] **Step 2.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/accounts.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement `server/src/accounts.ts`**

```ts
import { db, type Account } from './db.js';

export function ensureDefaultAccount(): void {
  const row = db.prepare('SELECT id FROM accounts WHERE id = 1').get();
  if (row) return;
  db.prepare(
    `INSERT INTO accounts (id, name, plan, created_at) VALUES (1, 'default', 'free', ?)`,
  ).run(Date.now());
}

export function createAccount(name: string, plan = 'free'): Account {
  const r = db
    .prepare(
      `INSERT INTO accounts (name, plan, created_at) VALUES (?, ?, ?) RETURNING id, name, plan, created_at`,
    )
    .get(name, plan, Date.now()) as Account;
  return r;
}

export function getAccountById(id: number): Account | null {
  const r = db.prepare('SELECT id, name, plan, created_at FROM accounts WHERE id = ?').get(id) as
    | Account
    | undefined;
  return r ?? null;
}
```

- [ ] **Step 2.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/accounts.test.ts
```

- [ ] **Step 2.5: Commit**

```bash
git add server/src/accounts.ts server/test/accounts.test.ts
git commit -m "feat(accounts): createAccount/getAccountById/ensureDefaultAccount helpers"
```

---

## Task 3: `usernames.ts` — validation + reserved names

**Files:**
- Create: `server/src/usernames.ts`
- Create: `server/test/usernames.test.ts`

- [ ] **Step 3.1: Write the failing test**

`server/test/usernames.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isValidUsername, isReserved, isUsernameAvailable } from '../src/usernames.js';
import { seedMailbox } from './helpers.js';

describe('usernames', () => {
  it('accepts plain lowercase usernames between 3 and 32 chars', () => {
    expect(isValidUsername('alice')).toBe(true);
    expect(isValidUsername('a.b-c_d')).toBe(true);
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('a'.repeat(32))).toBe(true);
  });

  it('rejects too short, too long, uppercase, and bad characters', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(33))).toBe(false);
    expect(isValidUsername('Alice')).toBe(false);
    expect(isValidUsername('alice@')).toBe(false);
    expect(isValidUsername('alice space')).toBe(false);
    expect(isValidUsername('')).toBe(false);
  });

  it('flags reserved names', () => {
    for (const r of ['admin', 'postmaster', 'webmaster', 'support', 'hostmaster', 'abuse', 'noreply', 'no-reply', 'mailer-daemon']) {
      expect(isReserved(r)).toBe(true);
    }
    expect(isReserved('alice')).toBe(false);
  });

  it('isUsernameAvailable returns true when no mailbox exists at the address', () => {
    expect(isUsernameAvailable('alice', 'zero-spam.email')).toBe(true);
  });

  it('isUsernameAvailable returns false when a mailbox already exists', () => {
    seedMailbox('alice@zero-spam.email');
    expect(isUsernameAvailable('alice', 'zero-spam.email')).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/usernames.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement `server/src/usernames.ts`**

```ts
import { db } from './db.js';

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

const RESERVED: ReadonlySet<string> = new Set([
  'admin',
  'postmaster',
  'webmaster',
  'support',
  'hostmaster',
  'abuse',
  'noreply',
  'no-reply',
  'mailer-daemon',
  'root',
  'info',
  'help',
  'security',
  'privacy',
]);

export function isValidUsername(s: string): boolean {
  return USERNAME_RE.test(s);
}

export function isReserved(s: string): boolean {
  return RESERVED.has(s.toLowerCase());
}

export function isUsernameAvailable(username: string, domain: string): boolean {
  const address = `${username.toLowerCase()}@${domain.toLowerCase()}`;
  const r = db.prepare('SELECT 1 FROM mailboxes WHERE address = ?').get(address);
  return !r;
}
```

- [ ] **Step 3.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/usernames.test.ts
```

- [ ] **Step 3.5: Commit**

```bash
git add server/src/usernames.ts server/test/usernames.test.ts
git commit -m "feat(signup): username validation + reserved-names + availability check"
```

---

## Task 4: `verify-token.ts` — HMAC-signed verification token

**Files:**
- Create: `server/src/verify-token.ts`
- Create: `server/test/verify-token.test.ts`

We mirror the `digest-token.ts` shape: `<base64url(JSON payload)>.<base64url(HMAC-SHA256(secret, payload))>`. The signing secret reuses `config.sessionSecret` so we don't introduce a new key.

- [ ] **Step 4.1: Write the failing test**

`server/test/verify-token.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { signVerifyToken, verifyVerifyToken } from '../src/verify-token.js';

const SECRET = 'a'.repeat(64);

describe('verify-token', () => {
  it('round-trips a payload', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() + 60_000 } as const;
    const token = signVerifyToken(payload, SECRET);
    const got = verifyVerifyToken(token, SECRET, Date.now());
    expect(got).toEqual(payload);
  });

  it('returns null for a tampered token', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() + 60_000 } as const;
    const token = signVerifyToken(payload, SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyVerifyToken(tampered, SECRET, Date.now())).toBeNull();
  });

  it('returns null for an expired token', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() - 1 } as const;
    const token = signVerifyToken(payload, SECRET);
    expect(verifyVerifyToken(token, SECRET, Date.now())).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() + 60_000 } as const;
    const token = signVerifyToken(payload, 'other-secret-padded-out-to-32-chars-min');
    expect(verifyVerifyToken(token, SECRET, Date.now())).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(verifyVerifyToken('', SECRET, Date.now())).toBeNull();
    expect(verifyVerifyToken('no-dot-here', SECRET, Date.now())).toBeNull();
    expect(verifyVerifyToken('a.b', SECRET, Date.now())).toBeNull();
  });
});
```

- [ ] **Step 4.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/verify-token.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement `server/src/verify-token.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type VerifyTokenPayload = {
  v: 1;
  userId: number;
  exp: number;
};

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
}

function mac(secret: string, payloadBuf: Buffer): Buffer {
  return createHmac('sha256', secret).update(payloadBuf).digest();
}

export function signVerifyToken(payload: VerifyTokenPayload, secret: string): string {
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = mac(secret, payloadBuf);
  return `${b64urlEncode(payloadBuf)}.${b64urlEncode(sig)}`;
}

export function verifyVerifyToken(token: string, secret: string, now: number): VerifyTokenPayload | null {
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
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as VerifyTokenPayload).v !== 1 ||
    typeof (parsed as VerifyTokenPayload).userId !== 'number' ||
    typeof (parsed as VerifyTokenPayload).exp !== 'number'
  ) {
    return null;
  }
  const p = parsed as VerifyTokenPayload;
  if (p.exp < now) return null;
  return p;
}
```

- [ ] **Step 4.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/verify-token.test.ts
```

- [ ] **Step 4.5: Commit**

```bash
git add server/src/verify-token.ts server/test/verify-token.test.ts
git commit -m "feat(signup): HMAC-signed email-verification token"
```

---

## Task 5: `verify-email-template.ts` — verification email body

**Files:**
- Create: `server/src/verify-email-template.ts`

This is a pure function with no I/O. Tests are inline in Task 6 — exercising it via the signup endpoint is more useful than testing the renderer in isolation.

- [ ] **Step 5.1: Implement**

`server/src/verify-email-template.ts`:
```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type VerifyEmailContent = {
  username: string;
  verifyUrl: string;
  expiresHours: number;
};

export function renderVerifyEmailHtml(c: VerifyEmailContent): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;border:1px solid #e5e5ea;">
      <tr><td style="padding:24px;">
        <div style="font-size:18px;font-weight:700;">Welcome to ZeroSpam, ${escapeHtml(c.username)}.</div>
        <p style="font-size:14px;line-height:1.5;color:#444;">
          Please verify your email so we can finish setting up your inbox at
          <code>${escapeHtml(c.username)}@zero-spam.email</code>.
        </p>
        <div style="margin:20px 0;">
          <a href="${escapeHtml(c.verifyUrl)}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
            Verify email
          </a>
        </div>
        <p style="font-size:12px;color:#888;">
          This link expires in ${c.expiresHours} hours. If you didn't sign up, you can ignore this message.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderVerifyEmailText(c: VerifyEmailContent): string {
  return [
    `Welcome to ZeroSpam, ${c.username}.`,
    ``,
    `Please verify your email so we can finish setting up your inbox at ${c.username}@zero-spam.email.`,
    ``,
    `Verify: ${c.verifyUrl}`,
    ``,
    `This link expires in ${c.expiresHours} hours. If you didn't sign up, you can ignore this message.`,
  ].join('\n');
}
```

- [ ] **Step 5.2: Smoke check the build**

```bash
npm run build --workspace=server
```
Expected: clean build, no TS errors.

- [ ] **Step 5.3: Commit**

```bash
git add server/src/verify-email-template.ts
git commit -m "feat(signup): verification email HTML + text templates"
```

---

## Task 6: `POST /api/auth/signup` (TDD)

**Files:**
- Create: `server/src/routes/signup.ts`
- Modify: `server/src/api.ts`
- Create: `server/test/auth-signup.test.ts`

The signup route creates an `accounts` row, a `users` row, a `mailboxes` row at `username@<config.signupDomain>`, signs a verification token, and (mock-)sends a verification email. Login is blocked until the user verifies (covered in Task 9).

**Configuration knob.** This task introduces a `config.signupDomain` (env var `SIGNUP_DOMAIN`, default `zero-spam.email`) so dev/test can use a different value without changing tests. We need it for vitest too.

- [ ] **Step 6.1: Add `signupDomain` to `config.ts`**

In `server/src/config.ts`, add to the `config` object before the closing brace:
```ts
  signupDomain: process.env.SIGNUP_DOMAIN ?? 'zero-spam.email',
  verifyTokenExpiryHours: envInt('VERIFY_TOKEN_EXPIRY_HOURS', 24),
```

In `server/vitest.config.ts`, add to the `env` block:
```ts
      SIGNUP_DOMAIN: 'zero-spam.email',
      VERIFY_TOKEN_EXPIRY_HOURS: '24',
```

- [ ] **Step 6.2: Write the failing test**

`server/test/auth-signup.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import nodemailer from 'nodemailer';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';

// Track outbound mail by intercepting the sendMail mock.
function captureMail() {
  const sent: any[] = [];
  const orig = (nodemailer as any).default.createTransport;
  (nodemailer as any).default.createTransport = () => ({
    sendMail: async (args: any) => {
      sent.push(args);
      return { messageId: 'test', envelope: {}, response: 'ok' };
    },
  });
  return { sent, restore: () => { (nodemailer as any).default.createTransport = orig; } };
}

describe('POST /api/auth/signup', () => {
  it('creates an account + user + native mailbox and dispatches a verify email', async () => {
    const { sent, restore } = captureMail();
    const app = await startApi();
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'alice@example.com', password: 'correct-horse-battery', username: 'alice' },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json();
      expect(body).toHaveProperty('userId');
      expect(body).toHaveProperty('accountId');

      const acc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(body.accountId);
      expect(acc).toBeTruthy();

      const user = db
        .prepare('SELECT email, account_id, email_verified_at FROM users WHERE id = ?')
        .get(body.userId) as any;
      expect(user.email).toBe('alice@example.com');
      expect(user.account_id).toBe(body.accountId);
      expect(user.email_verified_at).toBeNull();

      const mb = db.prepare('SELECT address, account_id FROM mailboxes WHERE account_id = ?').get(body.accountId) as any;
      expect(mb.address).toBe('alice@zero-spam.email');

      expect(sent).toHaveLength(1);
      expect(sent[0].to).toContain('alice@example.com');
      expect(sent[0].subject.toLowerCase()).toMatch(/verify/);
      expect(sent[0].text).toMatch(/\/auth\/verify\?t=/);
    } finally {
      await app.close();
      restore();
    }
  });

  it('rejects an invalid username', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@b.com', password: 'correct-horse-battery', username: 'AL' },
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().error).toMatch(/username/i);
    } finally {
      await app.close();
    }
  });

  it('rejects a reserved username', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@b.com', password: 'correct-horse-battery', username: 'admin' },
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().error).toMatch(/reserved/i);
    } finally {
      await app.close();
    }
  });

  it('rejects a duplicate username', async () => {
    const app = await startApi();
    try {
      const first = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a1@b.com', password: 'correct-horse-battery', username: 'alice' },
      });
      expect(first.statusCode).toBe(200);
      const dup = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a2@b.com', password: 'correct-horse-battery', username: 'alice' },
      });
      expect(dup.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it('rejects a duplicate email', async () => {
    const app = await startApi();
    try {
      await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@b.com', password: 'correct-horse-battery', username: 'alice' },
      });
      const dup = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@b.com', password: 'correct-horse-battery', username: 'bob' },
      });
      expect(dup.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it('rejects a too-short password', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@b.com', password: 'short', username: 'alice' },
      });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 6.3: Run; expect FAIL**

```bash
npm test --workspace=server -- test/auth-signup.test.ts
```
Expected: FAIL — endpoint not found (404).

- [ ] **Step 6.4: Implement `server/src/routes/signup.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { isValidUsername, isReserved, isUsernameAvailable } from '../usernames.js';
import { createAccount } from '../accounts.js';
import { signVerifyToken } from '../verify-token.js';
import { sendMessage } from '../sender.js';
import {
  renderVerifyEmailHtml,
  renderVerifyEmailText,
} from '../verify-email-template.js';
import { ensureDkim } from '../dkim.js';
import { hashPassword, getOwnerByEmail } from '../users.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(200),
  username: z.string().min(1).max(64),
});

export const signupRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/signup', async (req, reply) => {
    const body = signupSchema.parse(req.body);

    const username = body.username.toLowerCase();
    if (!isValidUsername(username)) {
      return reply.code(400).send({ error: 'username must match [a-z0-9._-]{3,32}' });
    }
    if (isReserved(username)) {
      return reply.code(400).send({ error: 'reserved username' });
    }
    if (!isUsernameAvailable(username, config.signupDomain)) {
      return reply.code(409).send({ error: 'username taken' });
    }
    if (getOwnerByEmail(body.email)) {
      return reply.code(409).send({ error: 'email already registered' });
    }

    const account = createAccount(`account-${username}`);
    const passwordHash = await hashPassword(body.password);
    const userRow = db
      .prepare(
        `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
         VALUES (?, ?, ?, NULL, ?) RETURNING id`,
      )
      .get(body.email.toLowerCase(), passwordHash, account.id, Date.now()) as { id: number };

    // Ensure the signup domain exists for this account; create if not.
    let domainRow = db
      .prepare('SELECT id FROM domains WHERE name = ? AND account_id = ?')
      .get(config.signupDomain, account.id) as { id: number } | undefined;
    if (!domainRow) {
      domainRow = db
        .prepare(
          `INSERT INTO domains (name, account_id, created_at) VALUES (?, ?, ?) RETURNING id`,
        )
        .get(config.signupDomain, account.id, Date.now()) as { id: number };
    }
    ensureDkim(domainRow.id);

    const address = `${username}@${config.signupDomain}`;
    const mailboxRow = db
      .prepare(
        `INSERT INTO mailboxes (
           address, domain_id, account_id, display_name, quarantine_ttl_hours, created_at,
           digest_enabled, digest_hour, digest_recipient_mode, owner_email, last_digest_sent_at
         ) VALUES (?, ?, ?, NULL, 168, ?, 0, 8, 'external', NULL, NULL) RETURNING id`,
      )
      .get(address, domainRow.id, account.id, Date.now()) as { id: number };

    const expHours = config.verifyTokenExpiryHours;
    const exp = Date.now() + expHours * 3600 * 1000;
    const token = signVerifyToken({ v: 1, userId: userRow.id, exp }, config.sessionSecret);
    const verifyUrl = `${config.publicBaseUrl || 'http://localhost:5173'}/auth/verify?t=${encodeURIComponent(token)}`;

    const html = renderVerifyEmailHtml({ username, verifyUrl, expiresHours: expHours });
    const text = renderVerifyEmailText({ username, verifyUrl, expiresHours: expHours });
    await sendMessage({
      mailboxId: mailboxRow.id,
      to: [body.email],
      subject: 'Verify your ZeroSpam email',
      text,
      html,
    });

    return { userId: userRow.id, accountId: account.id, mailboxId: mailboxRow.id };
  });
};
```

- [ ] **Step 6.5: Wire into `server/src/api.ts`**

Find:
```ts
  await app.register(authRoutes);
```

Add immediately after:
```ts
  await app.register((await import('./routes/signup.js')).signupRoutes);
```

In the `PUBLIC_PREFIXES` array, add `'/api/auth/signup'`:
```ts
  const PUBLIC_PREFIXES = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/signup',
    '/auth/verify',
    '/public/digest/allow',
  ];
```

(`/auth/verify` will be added in Task 7; allowlist it now to keep the change in one place.)

- [ ] **Step 6.6: Run; expect PASS**

```bash
npm test --workspace=server -- test/auth-signup.test.ts
```
Expected: 6/6 pass.

- [ ] **Step 6.7: Commit**

```bash
git add server/src/routes/signup.ts server/src/api.ts server/src/config.ts server/vitest.config.ts server/test/auth-signup.test.ts
git commit -m "feat(signup): POST /api/auth/signup with verification email dispatch"
```

---

## Task 7: `GET /auth/verify` (TDD)

**Files:**
- Modify: `server/src/routes/signup.ts`
- Create: `server/test/auth-verify.test.ts`

- [ ] **Step 7.1: Write the failing test**

`server/test/auth-verify.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { signVerifyToken } from '../src/verify-token.js';
import { config } from '../src/config.js';

async function signUp(app: Awaited<ReturnType<typeof startApi>>, username: string, email: string) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/signup',
    headers: { 'content-type': 'application/json' },
    payload: { email, password: 'correct-horse-battery', username },
  });
  return r.json() as { userId: number; accountId: number };
}

describe('GET /auth/verify', () => {
  it('flips email_verified_at on a valid token', async () => {
    const app = await startApi();
    try {
      const { userId } = await signUp(app, 'alice', 'alice@example.com');
      const token = signVerifyToken(
        { v: 1, userId, exp: Date.now() + 60_000 },
        config.sessionSecret,
      );
      const r = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      expect(r.statusCode).toBe(200);
      expect(r.body).toMatch(/verified/i);
      const u = db.prepare('SELECT email_verified_at FROM users WHERE id = ?').get(userId) as
        | { email_verified_at: number | null }
        | undefined;
      expect(u?.email_verified_at).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it('renders an error page for an invalid token', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({ method: 'GET', url: `/auth/verify?t=BOGUS` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toMatch(/invalid|expired/);
    } finally {
      await app.close();
    }
  });

  it('renders an error page for an expired token', async () => {
    const app = await startApi();
    try {
      const { userId } = await signUp(app, 'bob', 'bob@example.com');
      const token = signVerifyToken(
        { v: 1, userId, exp: Date.now() - 1 },
        config.sessionSecret,
      );
      const r = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toMatch(/invalid|expired/);
    } finally {
      await app.close();
    }
  });

  it('is idempotent: a second click is still a success page', async () => {
    const app = await startApi();
    try {
      const { userId } = await signUp(app, 'carol', 'carol@example.com');
      const token = signVerifyToken(
        { v: 1, userId, exp: Date.now() + 60_000 },
        config.sessionSecret,
      );
      const r1 = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      const r2 = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      expect(r1.statusCode).toBe(200);
      expect(r2.statusCode).toBe(200);
      expect(r2.body).toMatch(/verified/i);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 7.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/auth-verify.test.ts
```
Expected: FAIL — endpoint not found.

- [ ] **Step 7.3: Implement the GET route**

In `server/src/routes/signup.ts`, add to the imports:
```ts
import { verifyVerifyToken } from '../verify-token.js';
```

Append inside the `signupRoutes` plugin (after the `app.post(...)` call):
```ts
  app.get('/auth/verify', async (req, reply) => {
    const t = (req.query as { t?: string }).t ?? '';
    const payload = verifyVerifyToken(t, config.sessionSecret, Date.now());
    if (!payload) {
      reply.type('text/html');
      return renderVerifyResultHtml({ ok: false });
    }
    const user = db
      .prepare('SELECT id, email_verified_at FROM users WHERE id = ?')
      .get(payload.userId) as { id: number; email_verified_at: number | null } | undefined;
    if (!user) {
      reply.type('text/html');
      return renderVerifyResultHtml({ ok: false });
    }
    if (!user.email_verified_at) {
      db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(Date.now(), user.id);
    }
    reply.type('text/html');
    return renderVerifyResultHtml({ ok: true });
  });
```

Add a small helper at the bottom of `server/src/routes/signup.ts`:
```ts
function renderVerifyResultHtml(args: { ok: boolean }): string {
  if (args.ok) {
    return `<!doctype html><html><body style="font-family:sans-serif;padding:48px;text-align:center;">
<h1>Email verified.</h1><p>You can now log in.</p>
</body></html>`;
  }
  return `<!doctype html><html><body style="font-family:sans-serif;padding:48px;text-align:center;">
<h1>This link is expired or invalid.</h1><p>Sign up again or contact support.</p>
</body></html>`;
}
```

- [ ] **Step 7.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/auth-verify.test.ts
```

- [ ] **Step 7.5: Commit**

```bash
git add server/src/routes/signup.ts server/test/auth-verify.test.ts
git commit -m "feat(signup): GET /auth/verify endpoint + result page"
```

---

## Task 8: Block login until verified

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-login.test.ts`

- [ ] **Step 8.1: Append failing test to `server/test/auth-login.test.ts`**

```ts
describe('login is blocked until verified', () => {
  it('rejects with email-not-verified error for an unverified user', async () => {
    const app = await startApi();
    try {
      const signup = await app.inject({
        method: 'POST', url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'pending@example.com', password: 'correct-horse-battery', username: 'pending' },
      });
      expect(signup.statusCode).toBe(200);

      const login = await app.inject({
        method: 'POST', url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'pending@example.com', password: 'correct-horse-battery' },
      });
      expect(login.statusCode).toBe(403);
      expect(login.json().error).toMatch(/verify/i);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 8.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/auth-login.test.ts
```
Expected: FAIL — login currently returns 200 regardless of verification state.

- [ ] **Step 8.3: Update `server/src/routes/auth.ts`**

Find the existing login handler. After the password check (right after `if (!ok) { ... }`), insert:
```ts
    if (!user.email_verified_at) {
      recordAudit({ event: 'login.fail', userId: user.id, detail: { reason: 'email-not-verified' }, ip, userAgent: ua });
      reply.code(403).send({ error: 'email not verified' });
      return;
    }
```

- [ ] **Step 8.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/auth-login.test.ts
```
Expected: existing login tests + new verify-block test all pass. (Existing tests should already work because `seedOwner` will be updated in Task 10 to set `email_verified_at`.)

If existing tests fail because `seedOwner` is creating unverified users, hold off — Task 10 fixes the fixture. Confirm only the new test passes, then move on.

- [ ] **Step 8.5: Commit**

```bash
git add server/src/routes/auth.ts server/test/auth-login.test.ts
git commit -m "feat(auth): block login until email verified"
```

---

## Task 9: requireAuth attaches `account_id` to `req.account`

**Files:**
- Modify: `server/src/requireAuth.ts`
- Create: `server/test/require-auth-account.test.ts`

- [ ] **Step 9.1: Write the failing test**

`server/test/require-auth-account.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

describe('requireAuth attaches account_id', () => {
  it('attaches req.account.id from the authenticated user', async () => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    app.addHook('preHandler', requireAuth);
    app.get('/echo', async (req) => ({
      userId: (req as any).user?.id,
      accountId: (req as any).account?.id,
    }));
    const { userId } = await seedOwner();
    const r = await app.inject({
      method: 'GET',
      url: '/echo',
      headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().accountId).toBe(1);
  });
});
```

- [ ] **Step 9.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/require-auth-account.test.ts
```
Expected: FAIL — `req.account` is undefined.

- [ ] **Step 9.3: Update `server/src/requireAuth.ts`**

In the `declare module 'fastify'` block, add `account`:
```ts
declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: number };
    account?: { id: number };
    session?: { id: string };
    device?: { id: number };
  }
}
```

After the cookie-validation success path (inside the `if (cookieValue)` block, just before `return`), look up the account and attach it:
```ts
      const userRow = db
        .prepare('SELECT account_id FROM users WHERE id = ?')
        .get(v.userId) as { account_id: number } | undefined;
      if (userRow) req.account = { id: userRow.account_id };
```

After the bearer-token success path (inside the `if (row)` block), do the same:
```ts
        const userRow = db
          .prepare('SELECT account_id FROM users WHERE id = ?')
          .get(row.user_id) as { account_id: number } | undefined;
        if (userRow) req.account = { id: userRow.account_id };
```

- [ ] **Step 9.4: Run; expect PASS**

```bash
npm test --workspace=server -- test/require-auth-account.test.ts
```

- [ ] **Step 9.5: Commit**

```bash
git add server/src/requireAuth.ts server/test/require-auth-account.test.ts
git commit -m "feat(auth): requireAuth attaches account_id to req.account"
```

---

## Task 10: Update `seedOwner` fixture + `seed-owner` CLI to verify by default

**Files:**
- Modify: `server/test/fixtures/owner.ts`
- Modify: `server/src/users.ts`
- Modify: `server/src/seed-owner.ts`

The fixture has been the source of test owners; existing tests assume the owner is fully usable for login. We update `createOwner` to accept a `verified` option (defaulting to `true` from the fixture path so existing tests keep working; the signup route always passes `verified=false`).

- [ ] **Step 10.1: Inspect current `seedOwner` shape**

```bash
sed -n '1,40p' server/test/fixtures/owner.ts
```
Note the current return shape — it returns `userId`, `email`, `password`, `totpSecret`. We'll add `accountId`.

- [ ] **Step 10.2: Update `server/src/users.ts`**

Find `createOwner` and update the signature:
```ts
export async function createOwner(input: {
  email: string;
  password: string;
  verified?: boolean;
}): Promise<number> {
```

Inside the function, where it inserts into `users`, change the `email_verified_at` value to `input.verified === false ? null : Date.now()`:
```ts
  const row = db
    .prepare(
      `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
       VALUES (?, ?, 1, ?, ?) RETURNING id`,
    )
    .get(
      input.email.toLowerCase(),
      hash,
      input.verified === false ? null : Date.now(),
      Date.now(),
    ) as { id: number };
  return row.id;
```

(Adjust the `INSERT` to include `account_id = 1` and `email_verified_at` — the existing INSERT may not set them. The migration backfilled existing rows; new rows must set them explicitly.)

- [ ] **Step 10.3: Update `seedOwner` in `server/test/fixtures/owner.ts`**

Replace the body with:
```ts
export async function seedOwner(input: {
  email?: string;
  password?: string;
  totp?: boolean;
  verified?: boolean;
} = {}): Promise<{
  userId: number;
  accountId: number;
  email: string;
  password: string;
  totpSecret: string | null;
}> {
  const email = input.email ?? 'owner@example.com';
  const password = input.password ?? 'hunter2-correct-horse-battery';
  const userId = await createOwner({ email, password, verified: input.verified !== false });
  const accountRow = db.prepare('SELECT account_id FROM users WHERE id = ?').get(userId) as { account_id: number };
  let totpSecret: string | null = null;
  if (input.totp) {
    totpSecret = generateTotpSecret();
    setTotpSecret(userId, totpSecret);
  }
  return { userId, accountId: accountRow.account_id, email, password, totpSecret };
}
```

Add `import { db } from '../../src/db.js';` at the top.

- [ ] **Step 10.4: Update `seed-owner` CLI**

In `server/src/seed-owner.ts`, find the `createOwner` call:
```ts
  const id = await createOwner({ email, password });
```
Change to:
```ts
  const id = await createOwner({ email, password, verified: true });
```

- [ ] **Step 10.5: Run all tests; expect PASS**

```bash
npm test --workspace=server
```
Expected: all green. (Existing tests now create verified owners by default; the new "block unverified login" test still passes because the signup-then-login test uses the signup endpoint which doesn't verify.)

- [ ] **Step 10.6: Commit**

```bash
git add server/src/users.ts server/test/fixtures/owner.ts server/src/seed-owner.ts
git commit -m "feat(auth): seedOwner + seed-owner CLI verify by default; createOwner accepts verified flag"
```

---

## Task 11: Audit existing routes for account scoping

**Files:**
- Modify: `server/src/api.ts`
- Create: `server/test/account-scoping.test.ts`

We add cross-account 404 tests for four representative routes (`GET /api/mailboxes`, `GET /api/messages`, `GET /api/whitelist`, `GET /api/mailboxes/:id/counts`). The audit also tightens these routes to filter by `account_id`. Other routes that take a `mailboxId` query/param follow the same pattern; a follow-up commit can extend if needed, but four routes give us a representative test surface that proves the audit pattern.

- [ ] **Step 11.1: Write the failing test**

`server/test/account-scoping.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { createAccount } from '../src/accounts.js';
import { db } from '../src/db.js';
import { seedMailbox, injectQuarantined } from './helpers.js';

async function setupTwoAccounts() {
  const a1 = await seedOwner({ email: 'a@x.com' });
  // Spawn a second account + user manually
  const acct2 = createAccount('two');
  const u2 = db
    .prepare(
      `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
       VALUES (?, 'x', ?, ?, ?) RETURNING id`,
    )
    .get('b@y.com', acct2.id, Date.now(), Date.now()) as { id: number };
  // Mailbox owned by account 2
  const mb2 = seedMailbox('victim@example.com');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct2.id, mb2);
  await injectQuarantined({ to: 'victim@example.com', from: 'a@b.com' });
  return { account1Cookie: makeSessionCookie(a1.userId), mb2Id: mb2 };
}

describe('account scoping', () => {
  it("GET /api/mailboxes does not leak another account's mailboxes", async () => {
    const app = await startApi();
    try {
      const { account1Cookie } = await setupTwoAccounts();
      const r = await app.inject({ method: 'GET', url: '/api/mailboxes', headers: { cookie: account1Cookie } });
      const list = r.json() as { id: number; address: string }[];
      expect(list.find((x) => x.address === 'victim@example.com')).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("GET /api/messages?mailboxId=<other> returns 404", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/messages?mailboxId=${mb2Id}&folder=quarantine`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("GET /api/whitelist?mailboxId=<other> returns 404", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/whitelist?mailboxId=${mb2Id}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("GET /api/mailboxes/:id/counts returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/mailboxes/${mb2Id}/counts`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 11.2: Run; expect FAIL**

```bash
npm test --workspace=server -- test/account-scoping.test.ts
```
Expected: 4 FAIL (the routes return data or 200 instead of 404).

- [ ] **Step 11.3: Update `server/src/api.ts` — `GET /api/mailboxes`**

Find the `app.get('/api/mailboxes', ...)` handler. Replace the SQL with:
```ts
  app.get('/api/mailboxes', async (req) => {
    const accountId = req.account?.id ?? 0;
    return db
      .prepare(
        `SELECT * FROM mailboxes WHERE account_id = ? ORDER BY id ASC`,
      )
      .all(accountId);
  });
```

- [ ] **Step 11.4: Add a helper for "does this mailbox belong to the caller?"**

In `server/src/api.ts`, near the top of the `startApi` function (after the route preHandler block), add:
```ts
  function ownsMailbox(accountId: number, mailboxId: number): boolean {
    const r = db
      .prepare('SELECT 1 FROM mailboxes WHERE id = ? AND account_id = ?')
      .get(mailboxId, accountId);
    return !!r;
  }
```

- [ ] **Step 11.5: Update `GET /api/messages`**

In the existing `app.get('/api/messages', ...)` handler, before the SELECT, add:
```ts
    const accountId = req.account?.id ?? 0;
    if (!ownsMailbox(accountId, q.mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
```

(Make sure the handler signature is `async (req, reply) => {...}`. If it's currently `async (req) => {...}`, change it to include `reply`.)

- [ ] **Step 11.6: Update `GET /api/whitelist`**

Find the existing `app.get('/api/whitelist', ...)` handler. Add the same guard before its SELECT:
```ts
    const accountId = req.account?.id ?? 0;
    const mailboxId = Number((req.query as { mailboxId?: string }).mailboxId);
    if (!ownsMailbox(accountId, mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
```

- [ ] **Step 11.7: Update `GET /api/mailboxes/:id/counts`**

Find the existing handler. Add:
```ts
    const accountId = req.account?.id ?? 0;
    if (!ownsMailbox(accountId, Number((req.params as { id: string }).id))) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
```

- [ ] **Step 11.8: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: all green; 4 new account-scoping tests pass; existing tests still work because they all run as `account_id=1` against `account_id=1` mailboxes.

- [ ] **Step 11.9: Commit**

```bash
git add server/src/api.ts server/test/account-scoping.test.ts
git commit -m "feat(auth): scope mailboxes/messages/whitelist/counts by account_id"
```

---

## Task 12: Web — signup form + verification UI

**Files:**
- Create: `web/src/components/Signup.tsx`
- Create: `web/src/components/VerifyEmail.tsx`
- Modify: `web/src/api.ts`
- Modify: `web/src/App.tsx`

The existing webmail mounts `LoginForm` if there's no session. We add a tab switcher: "Sign in" (existing) / "Sign up" (new). The verification page is a separate top-level route that's hit by clicking the link in the verification email; it checks the URL hash `?t=...` and POSTs nothing — the GET endpoint is server-rendered HTML (Task 7), so this client component is only used when the SPA is the landing target. To keep things simple, the link in the email points at `/auth/verify?t=...` which is handled by the server; this component is just the SPA-side fallback if a user lands at `/verify-email` from the SPA's router.

Since the spec calls for a client-side onboarding gate, we keep things minimal: `App.tsx` shows the `LoginForm` ↔ `Signup` toggle, and on signup-success it shows a "check your inbox" message until the user logs in.

- [ ] **Step 12.1: Add API helpers**

In `web/src/api.ts`, add inside the exported `api` object:
```ts
  signup: (b: { email: string; password: string; username: string }) =>
    j<{ userId: number; accountId: number; mailboxId: number }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(b),
    }),
```

- [ ] **Step 12.2: Create `web/src/components/Signup.tsx`**

```tsx
import { useState } from 'react';
import { api } from '../api';

type Props = { onSwitchToLogin: () => void };

export default function Signup({ onSwitchToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.signup({ email: email.trim(), password, username: username.trim().toLowerCase() });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'sign-up failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-sm mx-auto p-8 text-center">
        <h1 className="text-xl font-semibold mb-4">Check your inbox.</h1>
        <p className="text-sm text-zsmuted">
          We sent a verification link to <strong>{email}</strong>. Click it to finish setting up your inbox at{' '}
          <code>{username}@zero-spam.email</code>.
        </p>
        <button onClick={onSwitchToLogin} className="mt-6 text-sm text-zsaccent">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto p-8 space-y-3">
      <h1 className="text-xl font-semibold">Create your ZeroSpam inbox</h1>
      <label className="block text-xs text-zsmuted">
        Username
        <input
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9._-]+"
          className="mt-1 w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
          placeholder="alice"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <span className="text-[11px] text-zsmuted">{username || 'alice'}@zero-spam.email</span>
      </label>
      <label className="block text-xs text-zsmuted">
        Email (where verification + recovery messages go)
        <input
          required
          type="email"
          className="mt-1 w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-xs text-zsmuted">
        Password (12+ chars)
        <input
          required
          type="password"
          minLength={12}
          className="mt-1 w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <div className="text-xs text-zsdanger">{error}</div>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
      <button type="button" onClick={onSwitchToLogin} className="w-full text-xs text-zsmuted">
        Already have an account? Sign in
      </button>
    </form>
  );
}
```

- [ ] **Step 12.3: Update `web/src/App.tsx`**

Find the section that renders `<LoginForm />` when the session is missing. Replace with a toggle:

```tsx
// At the top of App.tsx, with other component imports:
import Signup from './components/Signup';

// Inside the App component, where LoginForm is rendered when not authed,
// add a state that toggles between login and signup:
const [authView, setAuthView] = useState<'login' | 'signup'>('login');

// Then in the unauthed render branch:
return authView === 'login' ? (
  <LoginForm onSwitchToSignup={() => setAuthView('signup')} />
) : (
  <Signup onSwitchToLogin={() => setAuthView('login')} />
);
```

If `LoginForm` doesn't currently take an `onSwitchToSignup` prop, add it:
- In `web/src/components/LoginForm.tsx`, change the props type to `{ onSwitchToSignup?: () => void }` and render a small "Need an account? Sign up" button that calls it (mirror the link on the signup form).

- [ ] **Step 12.4: Verify the web build**

```bash
npm run build --workspace=web
```
Expected: clean Vite build, no TS errors.

- [ ] **Step 12.5: Smoke-test manually (optional but recommended)**

Run `npm run dev`, open `http://localhost:5173`, click "Need an account? Sign up", fill in the form, submit. The signup should succeed; the page should show "Check your inbox" with the chosen username.

- [ ] **Step 12.6: Commit**

```bash
git add web/src/components/Signup.tsx web/src/api.ts web/src/App.tsx web/src/components/LoginForm.tsx
git commit -m "feat(web): signup form + login/signup toggle"
```

---

## Final Verification

- [ ] **Step F.1: Run the full test suite**

```bash
npm test --workspace=server
```
Expected: all green. Existing tests + new tests from Tasks 1-11.

- [ ] **Step F.2: Build both workspaces**

```bash
npm run build
```
Expected: server + web both build cleanly.

- [ ] **Step F.3: End-to-end manual smoke**

In a clean sandbox dir:
1. `mkdir foundation-smoke && DATA_DIR=$PWD/foundation-smoke npm run dev` (server + web).
2. Open `http://localhost:5173`. Click "Sign up". Fill in: username `smoke`, email `you@personal.test`, password `correct-horse-battery`. Submit.
3. Look at the dev server's stdout — the verification email goes through `nodemailer` (mocked in tests, real in dev). For dev convenience, watch the `[server]` logs for the `verifyUrl` (or open the messages table: `sqlite3 foundation-smoke/zerospam.sqlite "SELECT body_text FROM messages WHERE folder='sent' ORDER BY received_at DESC LIMIT 1;"`).
4. Open the `verifyUrl` in the browser. Confirm the success page renders.
5. Return to `http://localhost:5173` → Sign in with the new credentials. You should see an empty inbox at `smoke@zero-spam.email`.
6. As a separate user, repeat steps 1-5 with username `another` and confirm both accounts exist independently (account scoping = no cross-leakage of mailboxes).

- [ ] **Step F.4: Final commit (if anything trailing)**

```bash
git add <files>
git commit -m "chore(foundation): smoke-test fixes"
```

---

## Self-Review Notes

| Spec section | Covered by |
|---|---|
| §4 in-scope: open signup with email/password + verification + optional TOTP | Tasks 6, 7, 8 |
| §4 in-scope: account boundary, account_id=1 backfill | Tasks 1, 2 |
| §5 data model: accounts, account_id, email_verified_at | Task 1 |
| §10 username regex `[a-z0-9._-]{3,32}` + reserved-names | Task 3 |
| §10 verification token + email | Tasks 4, 5, 6 |
| §10 GET /auth/verify | Task 7 |
| §10 login blocked until verified | Task 8 |
| §11 unit tests (signup validation, auth flow) | Tasks 6, 7, 8 |
| Multi-tenant scope on existing routes | Tasks 9, 11 |
| Test fixture migration | Task 10 |
| Web onboarding | Task 12 |

**Out of scope for Plan A** (handled by Plan B once Foundation is in):
- `connections` table + Gmail/Outlook OAuth flows
- Provider clients + sync worker
- Unified-inbox UI
- Send-as-zero-spam.email rewrite
- Connection settings panel

**Open questions deferred** (still in §13 of the spec):
- Token encryption key rotation runbook — moot for Plan A (no provider tokens yet).
- Connection-removal data retention — moot for Plan A.
- Username changes after signup — explicitly out of scope.
