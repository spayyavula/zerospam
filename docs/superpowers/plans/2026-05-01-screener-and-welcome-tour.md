# Screener + Welcome Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-05-01-screener-and-welcome-tour-design.md](../specs/2026-05-01-screener-and-welcome-tour-design.md)

**Goal:** Add an in-app HEY-style Screener (per-sender Yes/No triage over Quarantine) plus a one-time welcome tour overlay.

**Architecture:** Screener is a derived view over the existing `messages` table — no new lifecycle state. A new `screener_mutes` table holds 30-day soft mutes. Two new schema columns: `mailboxes.screener_sla_hours` (default 48) and `users.tour_completed_at`. Free-mail domain classification lives server-side; web reflects the server response.

**Tech Stack:** TypeScript, Fastify, node:sqlite, vitest (server). React 18 + Vite + Tailwind (web).

**Conventions established by existing code:**
- All authenticated routes use `requireAuth` global pre-handler in `api.ts` (line 57). Cross-tenant access returns **404** via `ownsMailbox`/`ownsMessage` helpers (api.ts lines 68–118).
- Schema additions are **idempotent ALTERs** gated on `colsOf(table)` checks in `db.ts` (line 222).
- Test setup at `server/test/setup.ts` truncates all tables in `beforeEach`. Account-scoping tests use `setupTwoAccounts()` helper from `server/test/account-scoping.test.ts`.
- Route modules live at `server/src/routes/*.ts` and are registered in `api.ts` via `app.register(routeFn)`.
- Web types in `web/src/types.ts`; API client in `web/src/api.ts`; SSE in `web/src/api.ts` `subscribeEvents`.

**Body-field naming convention for the screener namespace:** The new `/api/screener/*` routes use **snake_case** in JSON request bodies and query strings (e.g., `mailbox_id`, `sender_address`). This intentionally differs from the older `/api/mailboxes`, `/api/whitelist`, `/api/messages` routes which use camelCase (`mailboxId`). The convention is internally consistent across the screener server schemas, web client calls, and tests — do not mix them. The PATCH extension in Task 7 keeps the existing camelCase (`screenerSlaHours`) because it modifies an existing camelCase route.

**Testing rule for every server task:** TDD — write the failing test first, run it to confirm failure, implement, run the suite, commit.

**Build & test commands (Windows PowerShell-friendly):**
```bash
npm run build --workspace=server
npm test --workspace=server
```

---

## File Structure

### New server files
- `server/src/screener-domains.ts` — `FREE_MAIL_DOMAINS` constant
- `server/src/routes/screener.ts` — all 4 screener routes
- `server/src/routes/tour.ts` — tour-complete route
- `server/test/screener-routes.test.ts` — functional tests for screener routes
- `server/test/screener-account-scoping.test.ts` — cross-tenant tests
- `server/test/mailboxes-sla.test.ts` — PATCH SLA validation
- `server/test/tour-routes.test.ts` — tour-complete route + auth/me extension

### Modified server files
- `server/src/db.ts` — add `screener_mutes` table; ALTERs for `mailboxes.screener_sla_hours` and `users.tour_completed_at`
- `server/src/events.ts` — add `screener:changed` event variant
- `server/src/api.ts` — register screener + tour route modules; extend `/api/mailboxes/:id/counts` with screener bucket; extend PATCH `/api/mailboxes/:id` body schema with `screenerSlaHours`
- `server/src/routes/auth.ts` — extend `/api/auth/me` response with `tour_completed_at`
- `server/test/setup.ts` — add `DELETE FROM screener_mutes` to truncate list

### New web files
- `web/src/components/Screener.tsx`
- `web/src/components/DomainExpandToast.tsx`
- `web/src/components/WelcomeTour.tsx`

### Modified web files
- `web/src/types.ts` — extend `SidebarFolder`, `Counts`, `AuthMe`; add `ScreenerSender`, `AllowResponse`, `RejectResponse`
- `web/src/api.ts` — add `screenerList`, `screenerAllow`, `screenerAllowDomain`, `screenerReject`, `tourComplete`
- `web/src/components/Sidebar.tsx` — add `screener` entry above Inbox
- `web/src/components/MailboxManager.tsx` — add SLA hours input
- `web/src/App.tsx` — render `<Screener />` for `folder === 'screener'`; mount `<WelcomeTour />`; mount `<DomainExpandToast />` portal

### New docs
- `docs/screener-smoke.md` — manual smoke checklist

---

## Task 1: Database schema migrations + event type

**Files:**
- Modify: `server/src/db.ts` (add CREATE TABLE for `screener_mutes`; ALTER for `mailboxes.screener_sla_hours`; ALTER for `users.tour_completed_at`)
- Modify: `server/src/events.ts` (add `screener:changed` variant)
- Modify: `server/test/setup.ts` (add `DELETE FROM screener_mutes` in `beforeEach`)
- Create: `server/test/migrations.test.ts` (asserts the new columns and table exist)

- [ ] **Step 1: Write the failing test**

Create `server/test/migrations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('schema migrations for screener + tour', () => {
  it('mailboxes has screener_sla_hours column with default 48', () => {
    const cols = db.prepare("PRAGMA table_info('mailboxes')").all() as { name: string; dflt_value: string | null }[];
    const c = cols.find((x) => x.name === 'screener_sla_hours');
    expect(c).toBeDefined();
    expect(c!.dflt_value).toBe('48');
  });

  it('users has tour_completed_at column (nullable)', () => {
    const cols = db.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    expect(cols.find((x) => x.name === 'tour_completed_at')).toBeDefined();
  });

  it('screener_mutes table exists with expected shape', () => {
    const cols = db.prepare("PRAGMA table_info('screener_mutes')").all() as { name: string }[];
    const names = cols.map((c) => c.name).sort();
    expect(names).toEqual(['expires_at', 'id', 'mailbox_id', 'muted_at', 'sender_addr']);
  });

  it('screener_mutes has UNIQUE(mailbox_id, sender_addr)', () => {
    const idx = db.prepare("PRAGMA index_list('screener_mutes')").all() as { name: string; unique: number }[];
    const uniqueIdxs = idx.filter((i) => i.unique === 1);
    expect(uniqueIdxs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- migrations.test.ts`
Expected: 4 failing assertions (column not found / table not found).

- [ ] **Step 3: Add the screener_mutes CREATE TABLE in `db.ts`**

In `server/src/db.ts`, append to the `SCHEMA` template literal (after `digest_tokens_used` table, around line 218):

```sql
CREATE TABLE IF NOT EXISTS screener_mutes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id   INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  sender_addr  TEXT    NOT NULL,
  muted_at     INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  UNIQUE(mailbox_id, sender_addr)
);
CREATE INDEX IF NOT EXISTS idx_screener_mutes_lookup
  ON screener_mutes(mailbox_id, sender_addr, expires_at);
```

- [ ] **Step 4: Add the idempotent ALTERs in `db.ts`**

After the existing `mailboxCols2` block (around line 322), add:

```ts
const mailboxCols3 = colsOf('mailboxes');
if (!mailboxCols3.has('screener_sla_hours')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN screener_sla_hours INTEGER NOT NULL DEFAULT 48');
}

const userCols2 = colsOf('users');
if (!userCols2.has('tour_completed_at')) {
  db.exec('ALTER TABLE users ADD COLUMN tour_completed_at INTEGER');
}
```

- [ ] **Step 5: Add `screener:changed` event type in `events.ts`**

Modify `server/src/events.ts`:

```ts
export type AppEvent =
  | { type: 'message:new'; mailboxId: number; messageId: string; folder: string }
  | { type: 'message:updated'; mailboxId: number; messageId: string }
  | { type: 'message:deleted'; mailboxId: number; messageId: string }
  | { type: 'whitelist:changed'; mailboxId: number }
  | { type: 'screener:changed'; mailboxId: number };
```

- [ ] **Step 6: Add `DELETE FROM screener_mutes` to test setup**

In `server/test/setup.ts`, add `DELETE FROM screener_mutes;` to the `db.exec` block. Place it before `DELETE FROM accounts ...`:

```ts
    DELETE FROM screener_mutes;
    DELETE FROM accounts WHERE id NOT IN (${DEFAULT_ACCOUNT_ID}, ${SYSTEM_ACCOUNT_ID});
    DELETE FROM digest_tokens_used;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test --workspace=server -- migrations.test.ts`
Expected: 4 passing.

Run full suite: `npm test --workspace=server`
Expected: 187+4 = 191 passing.

- [ ] **Step 8: Commit**

```bash
git add server/src/db.ts server/src/events.ts server/test/setup.ts server/test/migrations.test.ts
git commit -m "feat(db): add screener_mutes table + screener_sla_hours + tour_completed_at columns"
```

---

## Task 2: FREE_MAIL_DOMAINS constant

**Files:**
- Create: `server/src/screener-domains.ts`
- Create: `server/test/screener-domains.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/screener-domains.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FREE_MAIL_DOMAINS, isFreeMailDomain } from '../src/screener-domains.js';

describe('FREE_MAIL_DOMAINS', () => {
  it('includes the major free-mail providers', () => {
    for (const d of ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'aol.com']) {
      expect(FREE_MAIL_DOMAINS.has(d)).toBe(true);
    }
  });

  it('isFreeMailDomain is case-insensitive', () => {
    expect(isFreeMailDomain('GMAIL.com')).toBe(true);
    expect(isFreeMailDomain('Yahoo.COM')).toBe(true);
  });

  it('returns false for custom domains', () => {
    expect(isFreeMailDomain('acme.com')).toBe(false);
    expect(isFreeMailDomain('zero-spam.email')).toBe(false);
  });

  it('returns false for empty / null-ish input', () => {
    expect(isFreeMailDomain('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- screener-domains.test.ts`
Expected: FAIL "Cannot find module 'screener-domains.js'".

- [ ] **Step 3: Create `server/src/screener-domains.ts`**

```ts
export const FREE_MAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'aol.com',
  'aim.com',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'fastmail.com',
  'fastmail.fm',
  'tutanota.com',
  'zoho.com',
]);

export function isFreeMailDomain(domain: string): boolean {
  if (!domain) return false;
  return FREE_MAIL_DOMAINS.has(domain.toLowerCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=server -- screener-domains.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add server/src/screener-domains.ts server/test/screener-domains.test.ts
git commit -m "feat(screener): FREE_MAIL_DOMAINS constant + isFreeMailDomain helper"
```

---

## Task 3: GET /api/screener

**Files:**
- Create: `server/src/routes/screener.ts`
- Create: `server/test/screener-routes.test.ts`
- Modify: `server/src/api.ts` (register the route module)

- [ ] **Step 1: Write the failing test**

Create `server/test/screener-routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db } from '../src/db.js';
import { seedMailbox, injectQuarantined } from './helpers.js';

async function setupOwnerWithMailbox(addr = 'alice@example.com') {
  const o = await seedOwner({ email: 'alice@x.com' });
  const acct = (db.prepare('SELECT account_id FROM users WHERE id = ?').get(o.userId) as { account_id: number }).account_id;
  const mb = seedMailbox(addr);
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct, mb);
  return { cookie: makeSessionCookie(o.userId), mailboxId: mb, accountId: acct };
}

describe('GET /api/screener', () => {
  it('returns one row per unique sender within SLA, sorted by latest desc', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      // Sarah sends 2 messages
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com', subject: 'first' });
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com', subject: 'second' });
      // Bob sends 1
      await injectQuarantined({ to: 'alice@example.com', from: 'bob@beta.io', subject: 'hello' });

      const r = await app.inject({
        method: 'GET',
        url: `/api/screener?mailbox_id=${mailboxId}`,
        headers: { cookie },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { senders: { address: string; message_count: number; latest_subject: string }[] };
      expect(body.senders.length).toBe(2);
      // sorted by latest first; bob arrived after sarah's two
      expect(body.senders[0].address).toBe('bob@beta.io');
      expect(body.senders[0].message_count).toBe(1);
      const sarah = body.senders.find((s) => s.address === 'sarah@acme.com')!;
      expect(sarah.message_count).toBe(2);
    } finally {
      await app.close();
    }
  });

  it('excludes whitelisted senders', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      db.prepare(
        `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, created_at) VALUES (?, 'address', ?, ?)`,
      ).run(mailboxId, 'sarah@acme.com', Date.now());
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com' });
      await injectQuarantined({ to: 'alice@example.com', from: 'bob@beta.io' });

      const r = await app.inject({ method: 'GET', url: `/api/screener?mailbox_id=${mailboxId}`, headers: { cookie } });
      const body = r.json() as { senders: { address: string }[] };
      expect(body.senders.map((s) => s.address)).toEqual(['bob@beta.io']);
    } finally {
      await app.close();
    }
  });

  it('excludes muted senders whose mute is still active', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      await injectQuarantined({ to: 'alice@example.com', from: 'spammer@bad.io' });
      db.prepare(
        `INSERT INTO screener_mutes (mailbox_id, sender_addr, muted_at, expires_at) VALUES (?, ?, ?, ?)`,
      ).run(mailboxId, 'spammer@bad.io', Date.now(), Date.now() + 86400000);

      const r = await app.inject({ method: 'GET', url: `/api/screener?mailbox_id=${mailboxId}`, headers: { cookie } });
      const body = r.json() as { senders: { address: string }[] };
      expect(body.senders.length).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('re-includes a sender after mute expires', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      await injectQuarantined({ to: 'alice@example.com', from: 'reformed@ex.io' });
      db.prepare(
        `INSERT INTO screener_mutes (mailbox_id, sender_addr, muted_at, expires_at) VALUES (?, ?, ?, ?)`,
      ).run(mailboxId, 'reformed@ex.io', Date.now() - 31 * 86400000, Date.now() - 86400000);

      const r = await app.inject({ method: 'GET', url: `/api/screener?mailbox_id=${mailboxId}`, headers: { cookie } });
      const body = r.json() as { senders: { address: string }[] };
      expect(body.senders.map((s) => s.address)).toEqual(['reformed@ex.io']);
    } finally {
      await app.close();
    }
  });

  it('excludes messages older than the per-mailbox SLA', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      db.prepare('UPDATE mailboxes SET screener_sla_hours = 1 WHERE id = ?').run(mailboxId);
      const id = await injectQuarantined({ to: 'alice@example.com', from: 'late@x.io' });
      // Backdate the message 2 hours
      db.prepare('UPDATE messages SET received_at = ? WHERE id = ?').run(Date.now() - 2 * 3600000, id);

      const r = await app.inject({ method: 'GET', url: `/api/screener?mailbox_id=${mailboxId}`, headers: { cookie } });
      const body = r.json() as { senders: { address: string }[] };
      expect(body.senders.length).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('returns the messages array per sender', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com', subject: 'a' });
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com', subject: 'b' });

      const r = await app.inject({ method: 'GET', url: `/api/screener?mailbox_id=${mailboxId}`, headers: { cookie } });
      const body = r.json() as { senders: { address: string; messages: { id: string; subject: string }[] }[] };
      const sarah = body.senders.find((s) => s.address === 'sarah@acme.com')!;
      expect(sarah.messages.length).toBe(2);
      expect(sarah.messages.map((m) => m.subject).sort()).toEqual(['a', 'b']);
    } finally {
      await app.close();
    }
  });

  it('rejects mailbox_id missing or non-numeric', async () => {
    const app = await startApi();
    try {
      const { cookie } = await setupOwnerWithMailbox();
      const r = await app.inject({ method: 'GET', url: `/api/screener`, headers: { cookie } });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- screener-routes.test.ts`
Expected: FAIL — `/api/screener` not found.

- [ ] **Step 3: Create `server/src/routes/screener.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';

type SenderRow = {
  address: string;
  name: string | null;
  message_count: number;
  latest_subject: string;
  latest_preview: string;
  latest_received_at: number;
  first_received_at: number;
};

type MessageRow = {
  id: string;
  mailbox_id: number;
  folder: string;
  from_address: string;
  from_name: string | null;
  to_addresses: string;
  subject: string | null;
  preview: string | null;
  received_at: number;
  expires_at: number | null;
  read: number;
  starred: number;
  spf_pass: number | null;
  dkim_pass: number | null;
  dmarc_pass: number | null;
  whitelist_match: string | null;
  size_bytes: number;
  attachment_count: number;
};

function ownsMailbox(accountId: number, mailboxId: number): boolean {
  return !!db
    .prepare('SELECT 1 FROM mailboxes WHERE id = ? AND account_id = ?')
    .get(mailboxId, accountId);
}

function getSlaMs(mailboxId: number): number {
  const r = db
    .prepare('SELECT screener_sla_hours FROM mailboxes WHERE id = ?')
    .get(mailboxId) as { screener_sla_hours: number } | undefined;
  return (r?.screener_sla_hours ?? 48) * 3600000;
}

const listQuery = z.object({
  mailbox_id: z.coerce.number().int().positive(),
});

export async function screenerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/screener', async (req, reply) => {
    const accountId = (req as any).account?.id ?? 0;
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid query' });
    const { mailbox_id } = parsed.data;
    if (!ownsMailbox(accountId, mailbox_id)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const now = Date.now();
    const slaMs = getSlaMs(mailbox_id);
    const cutoff = now - slaMs;

    // Per-sender aggregate, then per-message detail in two queries.
    const senderRows = db
      .prepare(
        `SELECT
            m.from_address AS address,
            (SELECT m2.from_name FROM messages m2
              WHERE m2.mailbox_id = m.mailbox_id AND m2.from_address = m.from_address
              ORDER BY m2.received_at DESC LIMIT 1) AS name,
            COUNT(*) AS message_count,
            (SELECT m2.subject FROM messages m2
              WHERE m2.mailbox_id = m.mailbox_id AND m2.from_address = m.from_address
              ORDER BY m2.received_at DESC LIMIT 1) AS latest_subject,
            (SELECT m2.preview FROM messages m2
              WHERE m2.mailbox_id = m.mailbox_id AND m2.from_address = m.from_address
              ORDER BY m2.received_at DESC LIMIT 1) AS latest_preview,
            MAX(m.received_at) AS latest_received_at,
            MIN(m.received_at) AS first_received_at
         FROM messages m
         WHERE m.mailbox_id = ?
           AND m.folder = 'quarantine'
           AND m.received_at >= ?
           AND NOT EXISTS (
             SELECT 1 FROM whitelist_rules wr
             WHERE wr.mailbox_id = m.mailbox_id
               AND ((wr.kind = 'address' AND wr.pattern = m.from_address)
                 OR (wr.kind = 'domain'  AND m.from_address LIKE '%@' || wr.pattern))
           )
           AND NOT EXISTS (
             SELECT 1 FROM screener_mutes sm
             WHERE sm.mailbox_id = m.mailbox_id
               AND sm.sender_addr = m.from_address
               AND sm.expires_at > ?
           )
         GROUP BY m.from_address
         ORDER BY latest_received_at DESC`,
      )
      .all(mailbox_id, cutoff, now) as SenderRow[];

    const senders = senderRows.map((s) => {
      const messages = db
        .prepare(
          `SELECT id, mailbox_id, folder, from_address, from_name, to_addresses,
                  subject, preview, received_at, expires_at, read, starred,
                  spf_pass, dkim_pass, dmarc_pass, whitelist_match, size_bytes, attachment_count
             FROM messages
             WHERE mailbox_id = ? AND from_address = ? AND folder = 'quarantine'
             ORDER BY received_at DESC`,
        )
        .all(mailbox_id, s.address) as MessageRow[];
      return {
        address: s.address,
        name: s.name,
        message_count: s.message_count,
        latest_subject: s.latest_subject ?? '',
        latest_preview: s.latest_preview ?? '',
        latest_received_at: s.latest_received_at,
        first_received_at: s.first_received_at,
        messages,
      };
    });

    return { senders };
  });
}
```

- [ ] **Step 4: Register the route module in `api.ts`**

In `server/src/api.ts`, after the existing `app.register((await import('./routes/signup.js')).signupRoutes);` line (around line 63), add:

```ts
  await app.register((await import('./routes/screener.js')).screenerRoutes);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=server -- screener-routes.test.ts`
Expected: 7 passing.

Run: `npm run build --workspace=server` — must compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/screener.ts server/src/api.ts server/test/screener-routes.test.ts
git commit -m "feat(screener): GET /api/screener — per-sender groups within SLA, excluding whitelist + active mutes"
```

---

## Task 4: POST /api/screener/allow

**Files:**
- Modify: `server/src/routes/screener.ts`
- Modify: `server/test/screener-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `server/test/screener-routes.test.ts`:

```ts
import { isFreeMailDomain } from '../src/screener-domains.js';

describe('POST /api/screener/allow', () => {
  it('whitelists exact address, moves quarantined messages to inbox, returns count', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      const m1 = await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com', subject: 'a' });
      const m2 = await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com', subject: 'b' });

      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'sarah@acme.com' },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { moved: number; rule_id: number; sender_address: string; domain: string; suggest_domain_expand: boolean };
      expect(body.moved).toBe(2);
      expect(body.sender_address).toBe('sarah@acme.com');
      expect(body.domain).toBe('acme.com');
      expect(body.suggest_domain_expand).toBe(true);
      expect(typeof body.rule_id).toBe('number');

      const folders = db.prepare('SELECT folder FROM messages WHERE id IN (?, ?)').all(m1, m2) as { folder: string }[];
      expect(folders.every((f) => f.folder === 'inbox')).toBe(true);

      const rule = db.prepare(
        "SELECT pattern, note FROM whitelist_rules WHERE mailbox_id = ? AND kind = 'address' AND pattern = ?",
      ).get(mailboxId, 'sarah@acme.com') as { pattern: string; note: string };
      expect(rule.note).toBe('screener:allow');
    } finally {
      await app.close();
    }
  });

  it('suggest_domain_expand=false for free-mail senders', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      await injectQuarantined({ to: 'alice@example.com', from: 'pat@gmail.com' });
      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'pat@gmail.com' },
      });
      const body = r.json() as { suggest_domain_expand: boolean; domain: string };
      expect(body.domain).toBe('gmail.com');
      expect(body.suggest_domain_expand).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('rejects bodies without sender_address or with malformed input', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId },
      });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- screener-routes.test.ts -t "POST /api/screener/allow"`
Expected: 3 failing — route not found.

- [ ] **Step 3: Implement the route**

In `server/src/routes/screener.ts`, add imports at the top:

```ts
import { isFreeMailDomain } from '../screener-domains.js';
import { bus } from '../events.js';
```

Add inside `screenerRoutes(app)`, after the GET handler:

```ts
const allowSchema = z.object({
  mailbox_id: z.number().int().positive(),
  sender_address: z.string().email(),
});

app.post('/api/screener/allow', async (req, reply) => {
  const accountId = (req as any).account?.id ?? 0;
  const parsed = allowSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
  const { mailbox_id, sender_address } = parsed.data;
  const sender = sender_address.toLowerCase();
  if (!ownsMailbox(accountId, mailbox_id)) {
    return reply.code(404).send({ error: 'mailbox not found' });
  }
  const domain = sender.split('@')[1] ?? '';
  let ruleId = 0;
  let moved = 0;
  db.exec('BEGIN');
  try {
    const ruleRow = db
      .prepare(
        `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at)
         VALUES (?, 'address', ?, 'screener:allow', ?) RETURNING id`,
      )
      .get(mailbox_id, sender, Date.now()) as { id: number };
    ruleId = ruleRow.id;
    const u = db
      .prepare(
        `UPDATE messages SET folder = 'inbox'
         WHERE mailbox_id = ? AND from_address = ? AND folder = 'quarantine'`,
      )
      .run(mailbox_id, sender);
    moved = Number(u.changes);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  bus.publish({ type: 'whitelist:changed', mailboxId: mailbox_id });
  bus.publish({ type: 'screener:changed', mailboxId: mailbox_id });
  return {
    moved,
    rule_id: ruleId,
    sender_address: sender,
    domain,
    suggest_domain_expand: !isFreeMailDomain(domain),
  };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=server -- screener-routes.test.ts`
Expected: 10 passing (7 from Task 3 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/screener.ts server/test/screener-routes.test.ts
git commit -m "feat(screener): POST /api/screener/allow — whitelist exact + move to inbox + free-mail domain hint"
```

---

## Task 5: POST /api/screener/allow-domain

**Files:**
- Modify: `server/src/routes/screener.ts`
- Modify: `server/test/screener-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `server/test/screener-routes.test.ts`:

```ts
describe('POST /api/screener/allow-domain', () => {
  it('whitelists domain, moves all quarantined messages from that domain to inbox', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      const m1 = await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com' });
      const m2 = await injectQuarantined({ to: 'alice@example.com', from: 'otto@acme.com' });
      await injectQuarantined({ to: 'alice@example.com', from: 'bob@beta.io' });

      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow-domain',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, domain: 'acme.com' },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { moved: number; rule_id: number };
      expect(body.moved).toBe(2);

      const folders = db.prepare('SELECT folder FROM messages WHERE id IN (?, ?)').all(m1, m2) as { folder: string }[];
      expect(folders.every((f) => f.folder === 'inbox')).toBe(true);

      const rule = db.prepare(
        "SELECT pattern, note FROM whitelist_rules WHERE mailbox_id = ? AND kind = 'domain'",
      ).get(mailboxId) as { pattern: string; note: string };
      expect(rule.pattern).toBe('acme.com');
      expect(rule.note).toBe('screener:allow-domain');
    } finally {
      await app.close();
    }
  });

  it('returns 422 for free-mail domains and creates no rule', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow-domain',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, domain: 'gmail.com' },
      });
      expect(r.statusCode).toBe(422);
      const count = db.prepare('SELECT COUNT(*) AS c FROM whitelist_rules WHERE mailbox_id = ?').get(mailboxId) as { c: number };
      expect(count.c).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('lowercases the domain before matching', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com' });
      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow-domain',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, domain: 'ACME.COM' },
      });
      expect(r.statusCode).toBe(200);
      const rule = db.prepare("SELECT pattern FROM whitelist_rules WHERE mailbox_id = ?").get(mailboxId) as { pattern: string };
      expect(rule.pattern).toBe('acme.com');
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- screener-routes.test.ts -t "allow-domain"`
Expected: 3 failing.

- [ ] **Step 3: Implement the route**

Add to `server/src/routes/screener.ts` inside `screenerRoutes(app)`:

```ts
const allowDomainSchema = z.object({
  mailbox_id: z.number().int().positive(),
  domain: z.string().min(3).regex(/^[a-z0-9.-]+$/i),
});

app.post('/api/screener/allow-domain', async (req, reply) => {
  const accountId = (req as any).account?.id ?? 0;
  const parsed = allowDomainSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
  const { mailbox_id } = parsed.data;
  const domain = parsed.data.domain.toLowerCase();
  if (!ownsMailbox(accountId, mailbox_id)) {
    return reply.code(404).send({ error: 'mailbox not found' });
  }
  if (isFreeMailDomain(domain)) {
    return reply.code(422).send({ error: 'cannot trust free-mail domain — trust the address instead' });
  }
  let ruleId = 0;
  let moved = 0;
  db.exec('BEGIN');
  try {
    const ruleRow = db
      .prepare(
        `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at)
         VALUES (?, 'domain', ?, 'screener:allow-domain', ?) RETURNING id`,
      )
      .get(mailbox_id, domain, Date.now()) as { id: number };
    ruleId = ruleRow.id;
    const u = db
      .prepare(
        `UPDATE messages SET folder = 'inbox'
         WHERE mailbox_id = ? AND folder = 'quarantine' AND from_address LIKE '%@' || ?`,
      )
      .run(mailbox_id, domain);
    moved = Number(u.changes);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  bus.publish({ type: 'whitelist:changed', mailboxId: mailbox_id });
  bus.publish({ type: 'screener:changed', mailboxId: mailbox_id });
  return { moved, rule_id: ruleId };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=server -- screener-routes.test.ts`
Expected: 13 passing.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/screener.ts server/test/screener-routes.test.ts
git commit -m "feat(screener): POST /api/screener/allow-domain — domain whitelist, rejects free-mail"
```

---

## Task 6: POST /api/screener/reject

**Files:**
- Modify: `server/src/routes/screener.ts`
- Modify: `server/test/screener-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `server/test/screener-routes.test.ts`:

```ts
describe('POST /api/screener/reject', () => {
  it('trashes the sender batch and creates a 30-day mute', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      const m1 = await injectQuarantined({ to: 'alice@example.com', from: 'spammer@bad.io' });
      const m2 = await injectQuarantined({ to: 'alice@example.com', from: 'spammer@bad.io' });

      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/reject',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'spammer@bad.io' },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { trashed: number };
      expect(body.trashed).toBe(2);

      const folders = db.prepare('SELECT folder FROM messages WHERE id IN (?, ?)').all(m1, m2) as { folder: string }[];
      expect(folders.every((f) => f.folder === 'trash')).toBe(true);

      const mute = db.prepare('SELECT expires_at FROM screener_mutes WHERE mailbox_id = ? AND sender_addr = ?')
        .get(mailboxId, 'spammer@bad.io') as { expires_at: number };
      const now = Date.now();
      expect(mute.expires_at).toBeGreaterThan(now + 29 * 86400000);
      expect(mute.expires_at).toBeLessThan(now + 31 * 86400000);
    } finally {
      await app.close();
    }
  });

  it('is idempotent: a second reject within mute window refreshes mute and trashes new messages', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setupOwnerWithMailbox();
      await injectQuarantined({ to: 'alice@example.com', from: 'spammer@bad.io' });
      await app.inject({
        method: 'POST',
        url: '/api/screener/reject',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'spammer@bad.io' },
      });
      const m2 = await injectQuarantined({ to: 'alice@example.com', from: 'spammer@bad.io' });

      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/reject',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'spammer@bad.io' },
      });
      expect(r.statusCode).toBe(200);
      const f = db.prepare('SELECT folder FROM messages WHERE id = ?').get(m2) as { folder: string };
      expect(f.folder).toBe('trash');
      const muteCount = db.prepare('SELECT COUNT(*) AS c FROM screener_mutes WHERE mailbox_id = ? AND sender_addr = ?')
        .get(mailboxId, 'spammer@bad.io') as { c: number };
      expect(muteCount.c).toBe(1);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- screener-routes.test.ts -t "/api/screener/reject"`
Expected: 2 failing.

- [ ] **Step 3: Implement the route**

Add to `server/src/routes/screener.ts` inside `screenerRoutes(app)`:

```ts
const rejectSchema = z.object({
  mailbox_id: z.number().int().positive(),
  sender_address: z.string().email(),
});

const MUTE_DURATION_MS = 30 * 86400000;

app.post('/api/screener/reject', async (req, reply) => {
  const accountId = (req as any).account?.id ?? 0;
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
  const { mailbox_id } = parsed.data;
  const sender = parsed.data.sender_address.toLowerCase();
  if (!ownsMailbox(accountId, mailbox_id)) {
    return reply.code(404).send({ error: 'mailbox not found' });
  }
  let trashed = 0;
  const now = Date.now();
  db.exec('BEGIN');
  try {
    const u = db
      .prepare(
        `UPDATE messages SET folder = 'trash'
         WHERE mailbox_id = ? AND from_address = ? AND folder = 'quarantine'`,
      )
      .run(mailbox_id, sender);
    trashed = Number(u.changes);
    db.prepare(
      `INSERT INTO screener_mutes (mailbox_id, sender_addr, muted_at, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(mailbox_id, sender_addr) DO UPDATE SET
         muted_at = excluded.muted_at,
         expires_at = excluded.expires_at`,
    ).run(mailbox_id, sender, now, now + MUTE_DURATION_MS);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  bus.publish({ type: 'screener:changed', mailboxId: mailbox_id });
  return { trashed };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=server -- screener-routes.test.ts`
Expected: 15 passing.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/screener.ts server/test/screener-routes.test.ts
git commit -m "feat(screener): POST /api/screener/reject — trash batch + 30-day soft mute (idempotent UPSERT)"
```

---

## Task 7: PATCH /api/mailboxes/:id — extend with screenerSlaHours

**Files:**
- Modify: `server/src/api.ts` (extend `patchMailboxSchema` and the SET-builder)
- Create: `server/test/mailboxes-sla.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/mailboxes-sla.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db } from '../src/db.js';
import { seedMailbox } from './helpers.js';

async function setup() {
  const o = await seedOwner({ email: 'a@x.com' });
  const acct = (db.prepare('SELECT account_id FROM users WHERE id = ?').get(o.userId) as { account_id: number }).account_id;
  const mb = seedMailbox('alice@example.com');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct, mb);
  return { cookie: makeSessionCookie(o.userId), mailboxId: mb };
}

describe('PATCH /api/mailboxes/:id — screenerSlaHours', () => {
  it('accepts a valid value and persists it', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setup();
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${mailboxId}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { screenerSlaHours: 24 },
      });
      expect(r.statusCode).toBe(200);
      const row = db.prepare('SELECT screener_sla_hours FROM mailboxes WHERE id = ?').get(mailboxId) as { screener_sla_hours: number };
      expect(row.screener_sla_hours).toBe(24);
    } finally {
      await app.close();
    }
  });

  it('rejects 0', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setup();
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${mailboxId}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { screenerSlaHours: 0 },
      });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('rejects 721', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setup();
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${mailboxId}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { screenerSlaHours: 721 },
      });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- mailboxes-sla.test.ts`
Expected: 3 failing — PATCH ignores unknown field, returns ok, but DB column not updated.

- [ ] **Step 3: Extend `patchMailboxSchema` in `api.ts`**

In `server/src/api.ts`, locate `patchMailboxSchema` (just above the PATCH handler). Add a field:

```ts
  const patchMailboxSchema = z.object({
    displayName: z.string().nullable().optional(),
    quarantineTtlHours: z.number().int().min(1).max(8760).optional(),
    digestEnabled: z.boolean().optional(),
    digestHour: z.number().int().min(0).max(23).optional(),
    digestRecipientMode: z.enum(['external', 'loopback']).optional(),
    ownerEmail: z.string().email().nullable().optional(),
    screenerSlaHours: z.number().int().min(1).max(720).optional(),
  });
```

(If your existing schema differs in field set, only add the `screenerSlaHours` line.)

- [ ] **Step 4: Add the SET-builder branch**

In the same handler, alongside the other `if (body.X !== undefined) { fields.push(...); values.push(...); }` blocks (around lines 195–218), add:

```ts
    if (body.screenerSlaHours !== undefined) {
      fields.push('screener_sla_hours = ?');
      values.push(body.screenerSlaHours);
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=server -- mailboxes-sla.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add server/src/api.ts server/test/mailboxes-sla.test.ts
git commit -m "feat(api): PATCH /api/mailboxes/:id accepts screenerSlaHours (1..720)"
```

---

## Task 8: /api/mailboxes/:id/counts — add screener bucket

**Files:**
- Modify: `server/src/api.ts` (the GET counts handler at line ~251)
- Create: `server/test/screener-counts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/screener-counts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db } from '../src/db.js';
import { seedMailbox, injectQuarantined } from './helpers.js';

async function setup() {
  const o = await seedOwner({ email: 'a@x.com' });
  const acct = (db.prepare('SELECT account_id FROM users WHERE id = ?').get(o.userId) as { account_id: number }).account_id;
  const mb = seedMailbox('alice@example.com');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct, mb);
  return { cookie: makeSessionCookie(o.userId), mailboxId: mb };
}

describe('GET /api/mailboxes/:id/counts — screener bucket', () => {
  it('counts unique unscreened senders within SLA', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setup();
      // 2 from sarah, 1 from bob
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com' });
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com' });
      await injectQuarantined({ to: 'alice@example.com', from: 'bob@beta.io' });

      const r = await app.inject({ method: 'GET', url: `/api/mailboxes/${mailboxId}/counts`, headers: { cookie } });
      const body = r.json() as { screener: { total: number; unread: number } };
      expect(body.screener.total).toBe(2);
      expect(body.screener.unread).toBe(2);
    } finally {
      await app.close();
    }
  });

  it('excludes whitelisted senders from screener count', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setup();
      db.prepare(
        `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, created_at) VALUES (?, 'address', ?, ?)`,
      ).run(mailboxId, 'sarah@acme.com', Date.now());
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@acme.com' });
      await injectQuarantined({ to: 'alice@example.com', from: 'bob@beta.io' });

      const r = await app.inject({ method: 'GET', url: `/api/mailboxes/${mailboxId}/counts`, headers: { cookie } });
      const body = r.json() as { screener: { total: number } };
      expect(body.screener.total).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('excludes muted senders from screener count', async () => {
    const app = await startApi();
    try {
      const { cookie, mailboxId } = await setup();
      await injectQuarantined({ to: 'alice@example.com', from: 'spammer@bad.io' });
      db.prepare(
        `INSERT INTO screener_mutes (mailbox_id, sender_addr, muted_at, expires_at) VALUES (?, ?, ?, ?)`,
      ).run(mailboxId, 'spammer@bad.io', Date.now(), Date.now() + 86400000);
      const r = await app.inject({ method: 'GET', url: `/api/mailboxes/${mailboxId}/counts`, headers: { cookie } });
      const body = r.json() as { screener: { total: number } };
      expect(body.screener.total).toBe(0);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- screener-counts.test.ts`
Expected: 3 failing — `body.screener` is undefined.

- [ ] **Step 3: Modify the counts handler in `api.ts`**

In `server/src/api.ts`, find the GET `/api/mailboxes/:id/counts` handler (line ~251). Replace the `out` initializer block and add the screener computation. Locate this code:

```ts
    const out: Record<string, { total: number; unread: number }> = {
      inbox: { total: 0, unread: 0 },
```

…and after the existing folder loop that builds `out`, before `return out`, add:

```ts
    // Screener bucket: unique senders matching the screener filter (within SLA, not whitelisted, not muted).
    const slaRow = db
      .prepare('SELECT screener_sla_hours FROM mailboxes WHERE id = ?')
      .get(Number(id)) as { screener_sla_hours: number } | undefined;
    const slaMs = (slaRow?.screener_sla_hours ?? 48) * 3600000;
    const now = Date.now();
    const cutoff = now - slaMs;
    const screenerRow = db
      .prepare(
        `SELECT
            COUNT(DISTINCT m.from_address) AS total,
            COUNT(DISTINCT CASE WHEN m.read = 0 THEN m.from_address ELSE NULL END) AS unread
         FROM messages m
         WHERE m.mailbox_id = ?
           AND m.folder = 'quarantine'
           AND m.received_at >= ?
           AND NOT EXISTS (
             SELECT 1 FROM whitelist_rules wr
             WHERE wr.mailbox_id = m.mailbox_id
               AND ((wr.kind = 'address' AND wr.pattern = m.from_address)
                 OR (wr.kind = 'domain'  AND m.from_address LIKE '%@' || wr.pattern))
           )
           AND NOT EXISTS (
             SELECT 1 FROM screener_mutes sm
             WHERE sm.mailbox_id = m.mailbox_id
               AND sm.sender_addr = m.from_address
               AND sm.expires_at > ?
           )`,
      )
      .get(Number(id), cutoff, now) as { total: number; unread: number };
    out.screener = { total: screenerRow.total ?? 0, unread: screenerRow.unread ?? 0 };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=server -- screener-counts.test.ts`
Expected: 3 passing.

Run full suite: `npm test --workspace=server`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add server/src/api.ts server/test/screener-counts.test.ts
git commit -m "feat(counts): add screener bucket to /api/mailboxes/:id/counts (unique senders within SLA)"
```

---

## Task 9: Tour-complete route + auth/me extension

**Files:**
- Create: `server/src/routes/tour.ts`
- Modify: `server/src/api.ts` (register the route)
- Modify: `server/src/routes/auth.ts` (extend `/api/auth/me` response)
- Create: `server/test/tour-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/tour-routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db } from '../src/db.js';

describe('tour routes', () => {
  it('GET /api/auth/me returns tour_completed_at: null for fresh user', async () => {
    const app = await startApi();
    try {
      const o = await seedOwner({ email: 'a@x.com' });
      const r = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: makeSessionCookie(o.userId) },
      });
      const body = r.json() as { user: { id: number; email: string; tour_completed_at: number | null } };
      expect(body.user.tour_completed_at).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('POST /api/users/me/tour-complete sets the timestamp; me reflects it', async () => {
    const app = await startApi();
    try {
      const o = await seedOwner({ email: 'a@x.com' });
      const cookie = makeSessionCookie(o.userId);
      const t0 = Date.now();
      const r = await app.inject({
        method: 'POST',
        url: '/api/users/me/tour-complete',
        headers: { cookie },
      });
      expect(r.statusCode).toBe(200);
      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      const body = me.json() as { user: { tour_completed_at: number } };
      expect(body.user.tour_completed_at).toBeGreaterThanOrEqual(t0);
    } finally {
      await app.close();
    }
  });

  it('POST /api/users/me/tour-complete is idempotent: second call leaves first timestamp intact OR refreshes (either is fine)', async () => {
    const app = await startApi();
    try {
      const o = await seedOwner({ email: 'a@x.com' });
      const cookie = makeSessionCookie(o.userId);
      await app.inject({ method: 'POST', url: '/api/users/me/tour-complete', headers: { cookie } });
      const first = (db.prepare('SELECT tour_completed_at FROM users WHERE id = ?').get(o.userId) as { tour_completed_at: number }).tour_completed_at;
      const r = await app.inject({ method: 'POST', url: '/api/users/me/tour-complete', headers: { cookie } });
      expect(r.statusCode).toBe(200);
      const second = (db.prepare('SELECT tour_completed_at FROM users WHERE id = ?').get(o.userId) as { tour_completed_at: number }).tour_completed_at;
      // Whichever semantics, must be set and not null
      expect(second).not.toBeNull();
      expect(second).toBeGreaterThanOrEqual(first);
    } finally {
      await app.close();
    }
  });

  it('POST /api/users/me/tour-complete returns 401 unauthenticated', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({ method: 'POST', url: '/api/users/me/tour-complete' });
      expect(r.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- tour-routes.test.ts`
Expected: 4 failing.

- [ ] **Step 3: Create `server/src/routes/tour.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';

export async function tourRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/users/me/tour-complete', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    db.prepare('UPDATE users SET tour_completed_at = ? WHERE id = ?').run(Date.now(), userId);
    return { ok: true };
  });
}
```

- [ ] **Step 4: Register the route in `api.ts`**

In `server/src/api.ts`, after the `screenerRoutes` registration (added in Task 3), add:

```ts
  await app.register((await import('./routes/tour.js')).tourRoutes);
```

- [ ] **Step 5: Extend `/api/auth/me` in `routes/auth.ts`**

In `server/src/routes/auth.ts`, locate the `/api/auth/me` handler (line 124). Replace the return:

```ts
    return { user: { id: u.id, email: u.email, totp_enabled: !!u.totp_enabled_at } };
```

with:

```ts
    const tour = db
      .prepare('SELECT tour_completed_at FROM users WHERE id = ?')
      .get(u.id) as { tour_completed_at: number | null } | undefined;
    return {
      user: {
        id: u.id,
        email: u.email,
        totp_enabled: !!u.totp_enabled_at,
        tour_completed_at: tour?.tour_completed_at ?? null,
      },
    };
```

If `db` is not yet imported in this file, add `import { db } from '../db.js';` at the top alongside other imports.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace=server -- tour-routes.test.ts`
Expected: 4 passing.

Run full suite: `npm test --workspace=server`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/tour.ts server/src/api.ts server/src/routes/auth.ts server/test/tour-routes.test.ts
git commit -m "feat(tour): POST /api/users/me/tour-complete + extend /api/auth/me with tour_completed_at"
```

---

## Task 10: Cross-tenant scoping tests for screener routes

**Files:**
- Create: `server/test/screener-account-scoping.test.ts`

These tests verify the existing `ownsMailbox` guard works on every new screener route. No code changes — just regression coverage.

- [ ] **Step 1: Write the test**

Create `server/test/screener-account-scoping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { createAccount } from '../src/accounts.js';
import { db } from '../src/db.js';
import { seedMailbox, injectQuarantined } from './helpers.js';

async function setupTwoAccounts() {
  const a1 = await seedOwner({ email: 'a@x.com' });
  const acct2 = createAccount('two');
  db.prepare(
    `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at) VALUES (?, 'x', ?, ?, ?)`,
  ).run('b@y.com', acct2.id, Date.now(), Date.now());
  const mb2 = seedMailbox('victim@example.com');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct2.id, mb2);
  await injectQuarantined({ to: 'victim@example.com', from: 'attacker@evil.io' });
  return { account1Cookie: makeSessionCookie(a1.userId), mb2Id: mb2 };
}

describe('screener routes — cross-tenant scoping', () => {
  it("GET /api/screener returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/screener?mailbox_id=${mb2Id}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("POST /api/screener/allow returns 404; no rule created", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mb2Id, sender_address: 'attacker@evil.io' },
      });
      expect(r.statusCode).toBe(404);
      const c = db.prepare('SELECT COUNT(*) AS c FROM whitelist_rules WHERE mailbox_id = ?').get(mb2Id) as { c: number };
      expect(c.c).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("POST /api/screener/allow-domain returns 404; no rule created", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow-domain',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mb2Id, domain: 'evil.io' },
      });
      expect(r.statusCode).toBe(404);
      const c = db.prepare('SELECT COUNT(*) AS c FROM whitelist_rules WHERE mailbox_id = ?').get(mb2Id) as { c: number };
      expect(c.c).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("POST /api/screener/reject returns 404; messages remain in quarantine", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const before = db.prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND folder = 'quarantine'",
      ).get(mb2Id) as { c: number };
      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/reject',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mb2Id, sender_address: 'attacker@evil.io' },
      });
      expect(r.statusCode).toBe(404);
      const after = db.prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND folder = 'quarantine'",
      ).get(mb2Id) as { c: number };
      expect(after.c).toBe(before.c);
      const muteCount = db.prepare('SELECT COUNT(*) AS c FROM screener_mutes WHERE mailbox_id = ?').get(mb2Id) as { c: number };
      expect(muteCount.c).toBe(0);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test --workspace=server -- screener-account-scoping.test.ts`
Expected: 4 passing — the existing `ownsMailbox` guard inside each screener route catches all these.

If any fail, fix the implementation in `server/src/routes/screener.ts` before proceeding.

- [ ] **Step 3: Commit**

```bash
git add server/test/screener-account-scoping.test.ts
git commit -m "test(screener): cross-tenant scoping coverage for all 4 screener routes"
```

---

## Task 11: Web types + API client

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`

- [ ] **Step 1: Extend `web/src/types.ts`**

Replace the existing `SidebarFolder` and `Counts` definitions with:

```ts
export type SidebarFolder = FolderName | 'drafts' | 'screener';

export type Counts = Record<FolderName, { total: number; unread: number }> & {
  drafts: { total: number; unread: number };
  screener: { total: number; unread: number };
};
```

Replace the existing `AuthMe` definition with:

```ts
export type AuthMe = { user: { id: number; email: string; totp_enabled: boolean; tour_completed_at: number | null } };
```

Append at end of file:

```ts
export type ScreenerSender = {
  address: string;
  name: string | null;
  message_count: number;
  latest_subject: string;
  latest_preview: string;
  latest_received_at: number;
  first_received_at: number;
  messages: MessageSummary[];
};

export type AllowResponse = {
  moved: number;
  rule_id: number;
  sender_address: string;
  domain: string;
  suggest_domain_expand: boolean;
};

export type AllowDomainResponse = { moved: number; rule_id: number };

export type RejectResponse = { trashed: number };
```

- [ ] **Step 2: Add API client methods in `web/src/api.ts`**

Open `web/src/api.ts`. Inside the `api` object literal (or wherever existing methods like `mailboxes`, `list`, `whitelist` are defined), add:

```ts
  async screenerList(mailboxId: number): Promise<ScreenerSender[]> {
    const r = await fetch(`${BASE}/api/screener?mailbox_id=${mailboxId}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`screener list ${r.status}`);
    const body = (await r.json()) as { senders: ScreenerSender[] };
    return body.senders;
  },

  async screenerAllow(mailboxId: number, senderAddress: string): Promise<AllowResponse> {
    const r = await fetch(`${BASE}/api/screener/allow`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mailbox_id: mailboxId, sender_address: senderAddress }),
    });
    if (!r.ok) throw new Error(`screener allow ${r.status}`);
    return r.json();
  },

  async screenerAllowDomain(mailboxId: number, domain: string): Promise<AllowDomainResponse> {
    const r = await fetch(`${BASE}/api/screener/allow-domain`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mailbox_id: mailboxId, domain }),
    });
    if (!r.ok) throw new Error(`screener allow-domain ${r.status}`);
    return r.json();
  },

  async screenerReject(mailboxId: number, senderAddress: string): Promise<RejectResponse> {
    const r = await fetch(`${BASE}/api/screener/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mailbox_id: mailboxId, sender_address: senderAddress }),
    });
    if (!r.ok) throw new Error(`screener reject ${r.status}`);
    return r.json();
  },

  async tourComplete(): Promise<void> {
    const r = await fetch(`${BASE}/api/users/me/tour-complete`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!r.ok) throw new Error(`tour complete ${r.status}`);
  },
```

Add the type imports at the top of `web/src/api.ts` if they aren't already present:

```ts
import type {
  ScreenerSender,
  AllowResponse,
  AllowDomainResponse,
  RejectResponse,
} from './types';
```

(Merge with the existing `import type { ... } from './types'` line.)

- [ ] **Step 3: Verify the build compiles**

Run: `cd web && npm run build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/types.ts web/src/api.ts
git commit -m "feat(web): types + API client for screener routes and tour completion"
```

---

## Task 12: Sidebar — Screener entry above Inbox

**Files:**
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Modify `Sidebar.tsx`**

In `web/src/components/Sidebar.tsx`, update the imports:

```ts
import {
  Inbox,
  Eye,
  ShieldAlert,
  Send,
  Trash2,
  ListChecks,
  Beaker,
  Flame,
  PenLine,
  Key,
  FileText,
  Tag,
} from 'lucide-react';
```

Update the `folders` array to include `screener` at the top:

```ts
const folders: { key: SidebarFolder; label: string; icon: any }[] = [
  { key: 'screener', label: 'Screener', icon: Eye },
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'quarantine', label: 'Quarantine', icon: ShieldAlert },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'drafts', label: 'Drafts', icon: FileText },
  { key: 'trash', label: 'Trash', icon: Trash2 },
];
```

The existing render code already reads `counts?.[f.key]` and renders the badge — no further changes needed; once `Counts.screener` exists (from Task 11) it will render automatically.

- [ ] **Step 2: Verify the build**

Run: `cd web && npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat(web): add Screener entry above Inbox in sidebar"
```

---

## Task 13: Screener.tsx component

**Files:**
- Create: `web/src/components/Screener.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/Screener.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { api } from '../api';
import type { AllowResponse, ScreenerSender } from '../types';

type Props = {
  mailboxId: number;
  refreshSignal: number;  // increment to force a refetch
  onChanged: () => void;
  onAllowResponse: (resp: AllowResponse) => void;
};

export default function Screener({ mailboxId, refreshSignal, onChanged, onAllowResponse }: Props) {
  const [senders, setSenders] = useState<ScreenerSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    api.screenerList(mailboxId)
      .then(setSenders)
      .catch(() => setSenders([]))
      .finally(() => setLoading(false));
  }, [mailboxId, refreshSignal]);

  const allow = async (s: ScreenerSender) => {
    if (pending.has(s.address)) return;
    setPending((p) => new Set(p).add(s.address));
    setSenders((rows) => rows.filter((r) => r.address !== s.address));
    try {
      const resp = await api.screenerAllow(mailboxId, s.address);
      onAllowResponse(resp);
      onChanged();
    } catch {
      // re-add row on failure
      setSenders((rows) => [s, ...rows]);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(s.address);
        return next;
      });
    }
  };

  const reject = async (s: ScreenerSender) => {
    if (pending.has(s.address)) return;
    setPending((p) => new Set(p).add(s.address));
    setSenders((rows) => rows.filter((r) => r.address !== s.address));
    try {
      await api.screenerReject(mailboxId, s.address);
      onChanged();
    } catch {
      setSenders((rows) => [s, ...rows]);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(s.address);
        return next;
      });
    }
  };

  const toggleExpand = (address: string) => {
    setExpanded((e) => {
      const next = new Set(e);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  };

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-zsmuted">Loading screener…</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zsbg">
      <header className="h-12 px-4 border-b border-zsborder flex items-center gap-3">
        <div className="font-medium">Screener</div>
        <div className="text-xs text-zsmuted">
          {senders.length === 0 ? 'All caught up.' : `${senders.length} sender${senders.length === 1 ? '' : 's'} waiting.`}
        </div>
      </header>

      {senders.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-zsmuted text-sm">
          Nothing to screen. New senders will show up here.
        </div>
      )}

      <ul className="flex-1 overflow-y-auto">
        {senders.map((s) => {
          const isExpanded = expanded.has(s.address);
          const isPending = pending.has(s.address);
          const initials = (s.name ?? s.address).slice(0, 2).toUpperCase();
          return (
            <li key={s.address} className={`border-b border-zsborder/60 ${isPending ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  className="p-1 text-zsmuted hover:text-zstext"
                  onClick={() => toggleExpand(s.address)}
                  title={isExpanded ? 'Collapse' : 'Expand messages'}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="w-9 h-9 rounded-full bg-zsaccent/20 text-zsaccent flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.name || s.address}</div>
                  <div className="text-xs text-zsmuted truncate">
                    {s.address} · {s.message_count} msg{s.message_count === 1 ? '' : 's'} · {formatDistanceToNowStrict(new Date(s.latest_received_at), { addSuffix: true })}
                  </div>
                  <div className="text-sm truncate mt-0.5">{s.latest_subject || '(no subject)'}</div>
                  {s.latest_preview && <div className="text-xs text-zsmuted truncate">{s.latest_preview}</div>}
                </div>
                <button
                  onClick={() => allow(s)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded bg-zsok/20 text-zsok hover:bg-zsok/30 inline-flex items-center gap-1 text-xs font-medium"
                >
                  <Check className="w-3.5 h-3.5" /> Yes
                </button>
                <button
                  onClick={() => reject(s)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded bg-zsdanger/15 text-zsdanger hover:bg-zsdanger/25 inline-flex items-center gap-1 text-xs font-medium"
                >
                  <X className="w-3.5 h-3.5" /> No
                </button>
              </div>
              {isExpanded && (
                <ul className="pl-16 pr-4 pb-3 space-y-1">
                  {s.messages.map((m) => (
                    <li key={m.id} className="text-xs text-zsmuted truncate">
                      {m.subject || '(no subject)'} · {formatDistanceToNowStrict(new Date(m.received_at), { addSuffix: true })}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd web && npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Screener.tsx
git commit -m "feat(web): Screener.tsx — per-sender Yes/No triage with optimistic updates"
```

---

## Task 14: DomainExpandToast.tsx component

**Files:**
- Create: `web/src/components/DomainExpandToast.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/DomainExpandToast.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../api';

type Props = {
  mailboxId: number;
  domain: string;
  onClose: () => void;
  onExpanded: (moved: number) => void;
};

const TOAST_TIMEOUT_MS = 5000;

export default function DomainExpandToast({ mailboxId, domain, onClose, onExpanded }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ moved: number } | null>(null);

  useEffect(() => {
    if (confirmed) return;
    const t = setTimeout(onClose, TOAST_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [confirmed, onClose]);

  const expand = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const resp = await api.screenerAllowDomain(mailboxId, domain);
      setConfirmed({ moved: resp.moved });
      onExpanded(resp.moved);
      setTimeout(onClose, 2500);
    } catch {
      onClose();
    }
  };

  if (confirmed) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-zsok text-zsbg rounded shadow-lg px-4 py-3 text-sm flex items-center gap-2">
        <Check className="w-4 h-4" />
        Moved {confirmed.moved} message{confirmed.moved === 1 ? '' : 's'} from @{domain}.
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-zspanel border border-zsborder rounded shadow-lg p-3 text-sm flex items-center gap-3">
      <div className="flex-1">
        <div className="font-medium">Trusted that sender.</div>
        <div className="text-xs text-zsmuted">Trust everyone @{domain}?</div>
      </div>
      <button
        onClick={expand}
        disabled={busy}
        className="px-3 py-1.5 rounded bg-zsaccent text-zsbg text-xs font-medium hover:opacity-90 whitespace-nowrap"
      >
        Trust @{domain}
      </button>
      <button onClick={onClose} className="px-2 text-xs text-zsmuted hover:text-zstext" title="Dismiss">
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd web && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/DomainExpandToast.tsx
git commit -m "feat(web): DomainExpandToast.tsx — 5s domain-trust prompt with confirm state"
```

---

## Task 15: App.tsx — Screener folder routing + toast portal

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add imports**

In `web/src/App.tsx`, alongside the existing component imports near the top:

```tsx
import Screener from './components/Screener';
import DomainExpandToast from './components/DomainExpandToast';
import type { AllowResponse } from './types';
```

- [ ] **Step 2: Add toast state**

Below the existing `useState` declarations in `App()`, add:

```tsx
  const [domainToast, setDomainToast] = useState<{ domain: string } | null>(null);
  const [screenerRefreshTick, setScreenerRefreshTick] = useState(0);
```

- [ ] **Step 3: Add the AllowResponse handler**

Above the `return` statement, add:

```tsx
  const handleScreenerAllowResponse = useCallback((resp: AllowResponse) => {
    if (resp.suggest_domain_expand) {
      setDomainToast({ domain: resp.domain });
    }
  }, []);
```

- [ ] **Step 4: Render the Screener for the screener folder**

In the JSX, find the block that renders `<MessageList />` + the right pane (around lines 397–456). Replace the conditional structure so that when `folder === 'screener'`, a `<Screener />` takes over the message list + reading pane area.

Locate this segment:

```tsx
        {folder === 'quarantine' && probationary && activeMailboxId != null ? (
          <ProbationaryWall ... />
        ) : (
          <>
            <MessageList ... />
            <div className="flex-1 min-w-0 bg-zsbg border-l border-zsborder">
              {rightPanel === 'reading' && (...)}
              {rightPanel === 'whitelist' && ...}
              {rightPanel === 'inject' && ...}
            </div>
          </>
        )}
```

Replace with:

```tsx
        {folder === 'screener' && activeMailboxId != null ? (
          <Screener
            mailboxId={activeMailboxId}
            refreshSignal={screenerRefreshTick}
            onChanged={() => {
              setScreenerRefreshTick((n) => n + 1);
              refresh();
            }}
            onAllowResponse={handleScreenerAllowResponse}
          />
        ) : folder === 'quarantine' && probationary && activeMailboxId != null ? (
          <ProbationaryWall
            messages={visible}
            mailboxId={activeMailboxId}
            onChanged={refresh}
            onExit={() => setProbationary(false)}
          />
        ) : (
          <>
            <MessageList
              messages={visible}
              folder={folder}
              selectedId={selectedId}
              searchQuery={searchQuery}
              searchActive={searchActive}
              searchInputRef={searchInputRef}
              selectedIds={selectedIds}
              filter={filter}
              onFilterChange={setFilter}
              probationaryAvailable={folder === 'quarantine'}
              onToggleProbationary={
                folder === 'quarantine' ? () => setProbationary(true) : undefined
              }
              onSelect={onSelect}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              onToggleSelect={(id) =>
                setSelectedIds((s) => {
                  const next = new Set(s);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onSelectAll={() => setSelectedIds(new Set(visibleIds))}
              onClearSelection={() => setSelectedIds(new Set())}
              onBulk={handleBulk}
            />

            <div className="flex-1 min-w-0 bg-zsbg border-l border-zsborder">
              {rightPanel === 'reading' && (
                <ReadingPane
                  messageId={folder === 'drafts' ? null : selectedId}
                  onChanged={refresh}
                  onReply={openReply}
                />
              )}
              {rightPanel === 'whitelist' && activeMailboxId != null && (
                <WhitelistPanel mailboxId={activeMailboxId} onClose={() => setRightPanel('reading')} />
              )}
              {rightPanel === 'inject' && activeMailbox && (
                <InjectorPanel
                  defaultTo={activeMailbox.address}
                  onClose={() => setRightPanel('reading')}
                  onSent={refresh}
                />
              )}
            </div>
          </>
        )}
```

- [ ] **Step 5: Mount the toast portal**

Just before the closing `</div>` of the outermost App `<div>` (around line 487), add:

```tsx
      {domainToast && activeMailboxId != null && (
        <DomainExpandToast
          mailboxId={activeMailboxId}
          domain={domainToast.domain}
          onClose={() => setDomainToast(null)}
          onExpanded={() => {
            setScreenerRefreshTick((n) => n + 1);
            refresh();
          }}
        />
      )}
```

- [ ] **Step 6: Subscribe to screener:changed in the SSE handler**

Find the SSE subscription `useEffect` (around lines 152–166):

```tsx
  useEffect(() => {
    if (activeMailboxId == null) return;
    const off = subscribeEvents((e) => {
      if (
        (e.type === 'message:new' ||
          e.type === 'message:updated' ||
          e.type === 'message:deleted' ||
          e.type === 'whitelist:changed') &&
        e.mailboxId === activeMailboxId
      ) {
        refresh();
      }
    });
    return off;
  }, [activeMailboxId, refresh]);
```

Replace with:

```tsx
  useEffect(() => {
    if (activeMailboxId == null) return;
    const off = subscribeEvents((e) => {
      if (
        (e.type === 'message:new' ||
          e.type === 'message:updated' ||
          e.type === 'message:deleted' ||
          e.type === 'whitelist:changed' ||
          e.type === 'screener:changed') &&
        e.mailboxId === activeMailboxId
      ) {
        refresh();
        if (e.type === 'screener:changed' || e.type === 'whitelist:changed' || e.type === 'message:new') {
          setScreenerRefreshTick((n) => n + 1);
        }
      }
    });
    return off;
  }, [activeMailboxId, refresh]);
```

- [ ] **Step 7: Add `screener:changed` to the SSE event union in the web client**

Open `web/src/api.ts` and find the `Event` type used by `subscribeEvents`. Update it to include the new variant. If the existing union is something like:

```ts
type Event =
  | { type: 'message:new'; mailboxId: number; ... }
  | { type: 'whitelist:changed'; mailboxId: number };
```

Add `| { type: 'screener:changed'; mailboxId: number }` at the end.

- [ ] **Step 8: Verify the build**

Run: `cd web && npm run build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add web/src/App.tsx web/src/api.ts
git commit -m "feat(web): wire Screener folder + DomainExpandToast portal + SSE screener:changed"
```

---

## Task 16: MailboxManager — Screener SLA input

**Files:**
- Modify: `web/src/components/MailboxManager.tsx`

- [ ] **Step 1: Inspect the current MailboxManager**

Read `web/src/components/MailboxManager.tsx` to understand its structure. The component should display rows for each mailbox with editable fields. Identify where `quarantine_ttl_hours` is rendered/edited — the new SLA field follows the same pattern.

- [ ] **Step 2: Add the SLA field**

Below the existing `quarantineTtlHours` field for each mailbox row, add a new input bound to `screener_sla_hours`. Use the same PATCH wiring already in place. Concretely, wherever the existing PATCH body is constructed (e.g., `{ quarantineTtlHours: ... }`), extend it to also accept `screenerSlaHours`.

Markup pattern (adapt to existing styling):

```tsx
<label className="flex items-center gap-2 text-sm">
  <span className="text-zsmuted">Screener SLA (hours)</span>
  <input
    type="number"
    min={1}
    max={720}
    value={mb.screener_sla_hours ?? 48}
    onChange={(e) => updateField(mb.id, 'screenerSlaHours', Number(e.target.value))}
    className="w-20 bg-zsbg border border-zsborder rounded px-2 py-1 text-sm"
  />
</label>
```

If the existing component uses an inline PATCH on blur, mirror that pattern. The PATCH body uses `screenerSlaHours` (camelCase, matching Task 7 schema).

- [ ] **Step 3: Add `screener_sla_hours` to the `Mailbox` type**

In `web/src/types.ts`, extend `Mailbox`:

```ts
export type Mailbox = {
  id: number;
  address: string;
  domain_id: number;
  display_name: string | null;
  quarantine_ttl_hours: number;
  screener_sla_hours: number;
  created_at: number;
  digest_enabled: number;
  digest_hour: number;
  digest_recipient_mode: 'external' | 'loopback';
  owner_email: string | null;
  last_digest_sent_at: number | null;
  digest_last_error: string | null;
  digest_consecutive_failures: number;
};
```

- [ ] **Step 4: Verify the build**

Run: `cd web && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/MailboxManager.tsx web/src/types.ts
git commit -m "feat(web): MailboxManager — Screener SLA hours input (1..720)"
```

---

## Task 17: WelcomeTour.tsx component

**Files:**
- Create: `web/src/components/WelcomeTour.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/WelcomeTour.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api';

type Step = {
  selector: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  { selector: '[data-tour="screener"]',  title: 'Daily 30-second triage',         body: 'New senders show up here. Tap Yes to trust, No to mute for 30 days.' },
  { selector: '[data-tour="quarantine"]', title: 'Nothing gets lost',              body: 'Anything not whitelisted lands here. Auto-expires after the TTL — no inbox debt.' },
  { selector: '[data-tour="whitelist"]',  title: 'You own the guest list',         body: 'One row = one rule. Address, domain, or regex.' },
  { selector: '[data-tour="help"]',       title: 'Keyboard shortcuts everywhere',  body: 'Press ? anytime. j/k to navigate, e to allow, # to trash.' },
];

type Props = { onComplete: () => void };

export default function WelcomeTour({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const target = document.querySelector(STEPS[step].selector) as HTMLElement | null;
    setRect(target ? target.getBoundingClientRect() : null);
    const onResize = () => {
      const t = document.querySelector(STEPS[step].selector) as HTMLElement | null;
      setRect(t ? t.getBoundingClientRect() : null);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [step]);

  const finish = async () => {
    try {
      await api.tourComplete();
    } catch {
      // ignore — best-effort persistence
    }
    onComplete();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Welcome tour">
      <Spotlight rect={rect} />
      <div
        className="fixed bg-zspanel border border-zsborder rounded-lg shadow-xl p-4 max-w-sm"
        style={cardStyle(rect)}
      >
        <div className="text-xs text-zsmuted uppercase tracking-wide mb-1">Step {step + 1} of {STEPS.length}</div>
        <div className="text-base font-semibold mb-1">{s.title}</div>
        <div className="text-sm text-zsmuted mb-4">{s.body}</div>
        <div className="flex items-center gap-2">
          <button onClick={finish} className="text-xs text-zsmuted hover:text-zstext">Skip tour</button>
          <div className="flex-1" />
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="px-3 py-1.5 text-xs rounded border border-zsborder hover:bg-zsborder/30">
              Back
            </button>
          )}
          {!isLast && (
            <button onClick={() => setStep(step + 1)} className="px-3 py-1.5 text-xs rounded bg-zsaccent text-zsbg font-medium hover:opacity-90">
              Next
            </button>
          )}
          {isLast && (
            <button onClick={finish} className="px-3 py-1.5 text-xs rounded bg-zsaccent text-zsbg font-medium hover:opacity-90">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Spotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) {
    return <div className="absolute inset-0 bg-black/60 pointer-events-none" />;
  }
  const pad = 6;
  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const clip = `polygon(
    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
    ${x}px ${y}px,
    ${x}px ${y + h}px,
    ${x + w}px ${y + h}px,
    ${x + w}px ${y}px,
    ${x}px ${y}px
  )`;
  return (
    <div
      className="absolute inset-0 bg-black/60 pointer-events-none"
      style={{ clipPath: clip, WebkitClipPath: clip }}
    />
  );
}

function cardStyle(rect: DOMRect | null): React.CSSProperties {
  if (!rect) {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }
  // Place card to the right of the target if there's room, else below.
  const padding = 16;
  const cardWidth = 380;
  const wantsRight = rect.right + cardWidth + padding < window.innerWidth;
  if (wantsRight) {
    return { left: rect.right + padding, top: Math.max(padding, rect.top) };
  }
  return { left: Math.max(padding, rect.left), top: rect.bottom + padding };
}
```

- [ ] **Step 2: Add `data-tour` attributes to Sidebar entries**

In `web/src/components/Sidebar.tsx`, add `data-tour` attributes so the spotlight can find the targets. Find the `folders.map` rendering of folder buttons. Add a `data-tour={f.key}` attribute to the rendered `<button>`:

```tsx
            <button
              key={f.key}
              data-tour={f.key}
              onClick={() => onFolder(f.key)}
              ...
```

For the Whitelist tool button, find the `<SidebarBtn icon={ListChecks} label="Whitelist" ... />` and modify the `SidebarBtn` component to accept and forward an optional `dataTour` prop:

```tsx
<SidebarBtn icon={ListChecks} label="Whitelist" onClick={onWhitelist} dataTour="whitelist" />
```

```tsx
function SidebarBtn({
  icon: Icon, label, onClick, danger, dataTour,
}: {
  icon: any; label: string; onClick: () => void; danger?: boolean; dataTour?: string;
}) {
  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      className={...}
    >
      ...
```

- [ ] **Step 3: Add `data-tour="help"` to App.tsx**

In `web/src/App.tsx`, find the help button in the header (the `<HelpCircle />` button at line ~360). Add `data-tour="help"`:

```tsx
        <button
          data-tour="help"
          onClick={() => setShowHelp(true)}
          ...
```

- [ ] **Step 4: Verify the build**

Run: `cd web && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/WelcomeTour.tsx web/src/components/Sidebar.tsx web/src/App.tsx
git commit -m "feat(web): WelcomeTour.tsx — 4-step spotlight overlay + data-tour anchors"
```

---

## Task 18: App.tsx — mount WelcomeTour on first auth

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add tour state**

In `App()`, alongside the existing `authed` state, add:

```tsx
  const [showTour, setShowTour] = useState(false);
```

- [ ] **Step 2: Replace the existing `authMe` effect**

Replace:

```tsx
  useEffect(() => {
    api.authMe()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);
```

with:

```tsx
  useEffect(() => {
    api.authMe()
      .then((me) => {
        setAuthed(true);
        if (me.user.tour_completed_at == null) {
          setShowTour(true);
        }
      })
      .catch(() => setAuthed(false));
  }, []);
```

- [ ] **Step 3: Update the `authMe` API client return type**

In `web/src/api.ts`, ensure `authMe()` is typed to return `AuthMe` (or `Promise<AuthMe>`). If it currently returns `void` or a less specific type, update both the function signature and any consumers.

```ts
  async authMe(): Promise<AuthMe> {
    const r = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' });
    if (!r.ok) throw new Error(`me ${r.status}`);
    return r.json();
  },
```

Add `AuthMe` to the imports at the top of `web/src/api.ts`:

```ts
import type { AuthMe, ... } from './types';
```

- [ ] **Step 4: Mount the tour**

Below the existing modal mounts at the bottom of the App return (HelpModal, TotpSetupModal, etc.), add:

```tsx
      {showTour && mailboxes.length > 0 && (
        <WelcomeTour onComplete={() => setShowTour(false)} />
      )}
```

Add the import at the top of `App.tsx`:

```tsx
import WelcomeTour from './components/WelcomeTour';
```

- [ ] **Step 5: Verify the build**

Run: `cd web && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/api.ts
git commit -m "feat(web): mount WelcomeTour on first authed login when tour_completed_at is null"
```

---

## Task 19: Manual smoke checklist

**Files:**
- Create: `docs/screener-smoke.md`

- [ ] **Step 1: Create the checklist**

Create `docs/screener-smoke.md`:

```markdown
# Screener + Welcome Tour — Manual Smoke Checklist

Run after a clean rebuild + fresh dev DB.

## Setup

1. Wipe smoke data: delete `smoke-data/zerospam.sqlite*`
2. Start server: `npm run dev --workspace=server`
3. Start web: `npm run dev --workspace=web`
4. Open http://localhost:5173

## A. Welcome tour

- [ ] Sign up a fresh user with a new email
- [ ] Verify the email link, log in
- [ ] On first dashboard load: Welcome tour overlay appears
- [ ] Step 1 spotlights the Screener entry; copy reads correctly
- [ ] Click Next: spotlight moves to Quarantine
- [ ] Click Next: spotlight moves to Whitelist
- [ ] Click Next: spotlight moves to the `?` help button; button label is "Done"
- [ ] Click Done; tour closes
- [ ] Reload the page: tour does NOT reappear
- [ ] In Settings, no easy way to relaunch yet (out of scope)

## B. Screener basics

- [ ] Open Test Injector; inject 3 messages from sarah@acme.com
- [ ] Inject 2 messages from newsletter@dailybrief.io
- [ ] Inject 1 message from jake@randomdomain.xyz
- [ ] Sidebar shows Screener with badge "3" (unique senders)
- [ ] Click Screener; list shows 3 rows, sorted with most-recent on top
- [ ] Each row shows display name (or address fallback), message count, time-ago, latest subject
- [ ] Expand sarah's row — 3 messages listed inline

## C. Allow flow

- [ ] Click Yes on sarah's row; row disappears
- [ ] Bottom-right toast appears: "Trust everyone @acme.com?"
- [ ] Wait 5s without clicking — toast disappears
- [ ] Switch to Inbox: 3 sarah messages are now in Inbox
- [ ] Switch to Whitelist: rule `sarah@acme.com` exists with note "screener:allow"

## D. Domain-expand toast

- [ ] Inject 2 more messages from otto@acme.com (different sender, same domain)
- [ ] Switch to Screener: otto's row appears
- [ ] Click Yes on otto's row; toast appears
- [ ] Click "Trust @acme.com" within 5s
- [ ] Toast morphs to "Moved N messages from @acme.com"
- [ ] Switch to Whitelist: domain rule `acme.com` exists with note "screener:allow-domain"

## E. Free-mail suppression

- [ ] Inject a message from pat@gmail.com
- [ ] Switch to Screener: pat appears
- [ ] Click Yes on pat; row disappears, message moves to Inbox
- [ ] No domain-expand toast appears (free-mail suppression)

## F. Reject + soft mute

- [ ] Inject 2 messages from spammer@bad.io
- [ ] Switch to Screener: spammer's row appears
- [ ] Click No on spammer; row fades, messages move to Trash
- [ ] Inject another spammer@bad.io message — does NOT show up in Screener (muted)
- [ ] Quarantine still receives the message (verify in Quarantine view)
- [ ] Repeat the No click on a fresh sender — confirms second-reject is idempotent

## G. SLA configuration

- [ ] Open Mailbox Manager: Screener SLA (hours) input visible, default 48
- [ ] Set SLA to 1
- [ ] Inject a message; confirm it appears in Screener
- [ ] Backdate the message via DB (`UPDATE messages SET received_at = received_at - 7200000 WHERE id = ?`)
- [ ] Refresh: sender drops out of Screener, still in Quarantine
- [ ] Set SLA back to 48

## H. Counts and SSE

- [ ] With 3 unique unscreened senders pending, Screener badge shows "3"
- [ ] Allow one — badge updates to "2" without page reload (SSE)
- [ ] Reject another — badge updates to "1"

## Pass criteria

All checkboxes complete with no console errors and no 500s in server logs.
```

- [ ] **Step 2: Commit**

```bash
git add docs/screener-smoke.md
git commit -m "docs(screener): manual smoke checklist for full Screener + tour flow"
```

---

## Self-review checklist (controller responsibility)

After Task 19, before merging:

- [ ] All server tests pass: `npm test --workspace=server` shows ~210+ passing
- [ ] No TypeScript errors: `npm run build --workspace=server` and `cd web && npm run build` clean
- [ ] Manual smoke from Task 19 fully completed
- [ ] No new files created outside the planned set
- [ ] No leftover console.log, debugger, or commented-out code
- [ ] Cross-tenant scoping coverage on every screener route (Task 10)
- [ ] Free-mail domain rejection on `/api/screener/allow-domain` (Task 5)
- [ ] Soft-mute UPSERT idempotency confirmed (Task 6)
- [ ] Tour persists across reload (Task 19 step A)
