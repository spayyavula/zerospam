# Quarantine Digest with One-Tap Sender Trust — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the digest scheduler, HMAC-signed action tokens, public confirm/act routes, and the per-mailbox settings UI exactly as specified in `docs/superpowers/specs/2026-04-29-quarantine-digest-design.md`.

**Architecture:** A new `digester.ts` module (mirroring `sweeper.ts`) ticks every minute, finds mailboxes due for a digest, assembles a content object, and sends via the existing `sender.sendMessage()` (or via `ingest()` for loopback). Each sender row in the digest contains an HMAC-signed link that opens a confirmation page; one click whitelists the sender and releases their quarantined messages. All implementation goes into the existing single-port Fastify server under `/public/digest/*`.

**Tech Stack:** TypeScript on Node ≥20, ESM modules, Fastify, `node:sqlite` (better-sqlite-style). Adding **vitest** as the unit/integration test framework (server workspace had none). Web is React + Vite + Tailwind.

---

## Reference Documents

- Spec: [docs/superpowers/specs/2026-04-29-quarantine-digest-design.md](../specs/2026-04-29-quarantine-digest-design.md)
- Codebase entry points the plan touches:
  - `server/src/db.ts` — schema + migrations
  - `server/src/config.ts` — env vars
  - `server/src/index.ts` — boot
  - `server/src/api.ts` — routes
  - `server/src/sender.ts` — outbound send
  - `server/src/ingest.ts` — inbound pipeline (loopback uses this)
  - `server/src/events.ts` — bus
  - `server/src/sweeper.ts` — pattern to mirror for the scheduler
  - `web/src/components/MailboxManager.tsx` — settings UI
  - `web/src/api.ts` — frontend API client

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `server/package.json` | Modify | Add `vitest` dev dep + `test` script |
| `server/vitest.config.ts` | Create | Vitest config; sets `DATA_DIR` and digest envs for tests |
| `server/test/setup.ts` | Create | beforeEach DB truncate; secret bootstrap |
| `server/test/helpers.ts` | Create | `seedDomain`, `seedMailbox`, `injectQuarantined`, `tickNow` |
| `server/src/digest-token.ts` | Create | Pure `sign`/`verify` HMAC token helpers |
| `server/src/digest-template.ts` | Create | Pure `renderHtml`/`renderText` digest body |
| `server/src/digester.ts` | Create | `assembleDigest`, `sendDigest`, `tick`, `startDigester` |
| `server/src/db.ts` | Modify | Add 7 new columns to `mailboxes` (idempotent ALTER) |
| `server/src/config.ts` | Modify | Add `PUBLIC_BASE_URL`, `DIGEST_SIGNING_SECRET` (with file fallback), `DIGEST_TICK_INTERVAL_SEC` |
| `server/src/api.ts` | Modify | Extend mailbox PATCH; add `/public/digest/allow` GET+POST |
| `server/src/index.ts` | Modify | Boot the digester after the API |
| `server/.gitignore` (root) | Modify | Add `server/test-data/` and `server/data/.digest-secret` |
| `web/src/api.ts` | Modify | Extend `patchMailbox` types |
| `web/src/types.ts` | Modify | Extend `Mailbox` type with digest fields |
| `web/src/components/MailboxManager.tsx` | Modify | Per-row digest settings expander |

## Test Infrastructure Notes

- **Why vitest:** server workspace has no test framework today. Vitest is small, ESM-native, TS-native (no transpiler config), and has `vi.useFakeTimers`, snapshot tests, and Fastify-friendly test ergonomics.
- **DB isolation:** `db.ts` is a module-level singleton; tests can't easily swap connections. Strategy: set `DATA_DIR=test-data` via `vitest.config.ts` so production data isn't touched, then `beforeEach` truncates all tables.
- **HTTP testing:** Fastify's built-in `app.inject({ method, url, payload })` returns a `LightMyRequest` response — no real socket — perfect for route tests.
- **Time control:** `vi.useFakeTimers()` for the scheduler; assemble/send tests use real time.

---

## Task 0: Test Infrastructure Setup

**Files:**
- Modify: `server/package.json`
- Create: `server/vitest.config.ts`
- Create: `server/test/setup.ts`
- Create: `server/test/helpers.ts`
- Create: `server/test/sanity.test.ts`
- Modify: `.gitignore`

- [ ] **Step 0.1: Install vitest in the server workspace**

Run:
```bash
npm install --workspace=server --save-dev vitest
```
Expected: `server/package.json` gains a `"vitest"` entry under `devDependencies`.

- [ ] **Step 0.2: Add the `test` script to `server/package.json`**

Replace the `scripts` block in `server/package.json` with:
```json
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "seed": "tsx src/seed.ts",
    "inject": "tsx src/inject.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 0.3: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    env: {
      DATA_DIR: 'test-data',
      PUBLIC_BASE_URL: 'http://localhost:8025',
      DIGEST_SIGNING_SECRET: 'test-secret-thirty-two-bytes-min-padpadpadpad',
      DIGEST_TICK_INTERVAL_SEC: '60',
    },
    maxWorkers: 1,
    isolate: false,
    sequence: { concurrent: false },
  },
});
```

(`maxWorkers: 1` + `isolate: false` + `concurrent: false` keep tests serialised against the shared SQLite singleton. This is the vitest-4 form of the v3 `pool: 'forks', singleFork: true` shorthand.)

- [ ] **Step 0.4: Create `server/test/setup.ts`**

```ts
import { beforeEach, afterAll } from 'vitest';
import { db } from '../src/db.js';
import { rmSync } from 'node:fs';
import { config } from '../src/config.js';

beforeEach(() => {
  db.exec(`
    DELETE FROM messages_fts;
    DELETE FROM messages;
    DELETE FROM attachments;
    DELETE FROM whitelist_rules;
    DELETE FROM aliases;
    DELETE FROM drafts;
    DELETE FROM mailboxes;
    DELETE FROM domains;
  `);
});

afterAll(() => {
  try {
    rmSync(config.dataDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
```

- [ ] **Step 0.5: Create `server/test/helpers.ts`**

```ts
import { db } from '../src/db.js';
import { ensureDkim } from '../src/dkim.js';
import { ingest } from '../src/ingest.js';

export function seedDomain(name: string): number {
  const r = db
    .prepare(`INSERT INTO domains (name, created_at) VALUES (?, ?) RETURNING id`)
    .get(name, Date.now()) as { id: number };
  ensureDkim(r.id);
  return r.id;
}

export type SeedMailboxOpts = {
  displayName?: string;
  quarantineTtlHours?: number;
  digestEnabled?: boolean;
  digestHour?: number;
  digestRecipientMode?: 'external' | 'loopback';
  ownerEmail?: string;
  lastDigestSentAt?: number | null;
};

export function seedMailbox(address: string, opts: SeedMailboxOpts = {}): number {
  const domainName = address.split('@')[1];
  let domain = db.prepare('SELECT id FROM domains WHERE name = ?').get(domainName) as
    | { id: number }
    | undefined;
  if (!domain) domain = { id: seedDomain(domainName) };
  const r = db
    .prepare(
      `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, created_at,
                              digest_enabled, digest_hour, digest_recipient_mode, owner_email,
                              last_digest_sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      address.toLowerCase(),
      domain.id,
      opts.displayName ?? null,
      opts.quarantineTtlHours ?? 168,
      Date.now(),
      opts.digestEnabled ? 1 : 0,
      opts.digestHour ?? 8,
      opts.digestRecipientMode ?? 'external',
      opts.ownerEmail ?? null,
      opts.lastDigestSentAt ?? null,
    ) as { id: number };
  return r.id;
}

export async function injectQuarantined(opts: {
  to: string;
  from: string;
  fromName?: string;
  subject?: string;
  text?: string;
}): Promise<string> {
  const headers = [
    `From: ${opts.fromName ? `"${opts.fromName}" <${opts.from}>` : opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject ?? '(no subject)'}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@test.local>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    opts.text ?? 'body',
  ];
  const raw = Buffer.from(headers.join('\r\n'));
  const r = await ingest(raw, opts.to);
  if (!r) throw new Error(`ingest returned null for ${opts.to}`);
  return r.messageId;
}
```

- [ ] **Step 0.6: Create `server/test/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { seedMailbox } from './helpers.js';
import { db } from '../src/db.js';

describe('sanity', () => {
  it('seeds a mailbox and reads it back', () => {
    const id = seedMailbox('alice@example.com');
    const row = db.prepare('SELECT address FROM mailboxes WHERE id = ?').get(id) as
      | { address: string }
      | undefined;
    expect(row?.address).toBe('alice@example.com');
  });
});
```

- [ ] **Step 0.7: Add test artefacts to `.gitignore`**

Append to the **root** `.gitignore`:
```
server/test-data/
server/data/.digest-secret
```

- [ ] **Step 0.8: Run the sanity test — expect FAIL**

Run:
```bash
npm test --workspace=server
```
Expected: FAIL — the schema referenced in `seedMailbox` (`digest_enabled`, `digest_hour`, etc.) doesn't exist yet because Task 3 hasn't run. The error will look like `SQLITE_ERROR: table mailboxes has no column named digest_enabled`. **This is the expected red.**

- [ ] **Step 0.9: Comment out the digest fields in `seedMailbox` to make the green pass**

Temporarily replace the INSERT in `seedMailbox` with a version that omits the digest columns:
```ts
  const r = db
    .prepare(
      `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, created_at)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      address.toLowerCase(),
      domain.id,
      opts.displayName ?? null,
      opts.quarantineTtlHours ?? 168,
      Date.now(),
    ) as { id: number };
  return r.id;
```
(We restore the full version in Task 3 once the columns exist.)

- [ ] **Step 0.10: Re-run; expect PASS**

```bash
npm test --workspace=server
```
Expected: 1 passed.

- [ ] **Step 0.11: Commit**

```bash
git add server/package.json server/vitest.config.ts server/test/ .gitignore package-lock.json
git commit -m "chore: add vitest + test scaffolding for server workspace"
```

---

## Task 1: `digest-token` — HMAC sign/verify (TDD)

**Files:**
- Create: `server/src/digest-token.ts`
- Create: `server/test/digest-token.test.ts`

- [ ] **Step 1.1: Write the failing test**

`server/test/digest-token.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sign, verify, type DigestTokenPayload } from '../src/digest-token.js';

const SECRET = 'test-secret-thirty-two-bytes-min-padpadpadpad';

function payload(over: Partial<DigestTokenPayload> = {}): DigestTokenPayload {
  return {
    v: 1,
    mailboxId: 42,
    sender: 'sales@acme.com',
    action: 'allow-forever',
    exp: Date.now() + 86_400_000,
    ...over,
  };
}

describe('digest-token', () => {
  it('round-trips a valid payload', () => {
    const t = sign(payload(), SECRET);
    expect(verify(t, SECRET, Date.now())).toEqual(payload());
  });

  it('returns null for a tampered signature', () => {
    const t = sign(payload(), SECRET);
    const tampered = t.slice(0, -2) + (t.endsWith('A') ? 'B' : 'A');
    expect(verify(tampered, SECRET, Date.now())).toBeNull();
  });

  it('returns null for an expired token', () => {
    const t = sign(payload({ exp: Date.now() - 1000 }), SECRET);
    expect(verify(t, SECRET, Date.now())).toBeNull();
  });

  it('returns null for malformed input (no separator)', () => {
    expect(verify('not-a-token', SECRET, Date.now())).toBeNull();
  });

  it('returns null for non-base64url segments', () => {
    expect(verify('!!!!.????', SECRET, Date.now())).toBeNull();
  });

  it('returns null for non-JSON payload', () => {
    expect(verify('aGVsbG8.aGVsbG8', SECRET, Date.now())).toBeNull();
  });

  it('returns null for unknown version', () => {
    const t = sign(payload({ v: 2 as 1 }), SECRET);
    expect(verify(t, SECRET, Date.now())).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const t = sign(payload(), SECRET);
    expect(verify(t, 'other-secret-thirty-two-bytes-min-padpadpadpadx', Date.now())).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run; expect FAIL**

```bash
npm test --workspace=server
```
Expected: FAIL — `Cannot find module '../src/digest-token.js'`.

- [ ] **Step 1.3: Implement `server/src/digest-token.ts`**

```ts
// HMAC-signed token for digest action URLs.
// Format: <base64url(JSON payload)>.<base64url(HMAC-SHA256(secret, payload))>
// No JWT to avoid alg-confusion footguns.

import { createHmac, timingSafeEqual } from 'node:crypto';

export type DigestTokenPayload = {
  v: 1;
  mailboxId: number;
  sender: string;
  action: 'allow-forever';
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

export function sign(payload: DigestTokenPayload, secret: string): string {
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = mac(secret, payloadBuf);
  return `${b64urlEncode(payloadBuf)}.${b64urlEncode(sig)}`;
}

export function verify(token: string, secret: string, now: number): DigestTokenPayload | null {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  const payloadBuf = b64urlDecode(payloadPart);
  const sigBuf = b64urlDecode(sigPart);
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
    (parsed as DigestTokenPayload).v !== 1 ||
    typeof (parsed as DigestTokenPayload).mailboxId !== 'number' ||
    typeof (parsed as DigestTokenPayload).sender !== 'string' ||
    (parsed as DigestTokenPayload).action !== 'allow-forever' ||
    typeof (parsed as DigestTokenPayload).exp !== 'number'
  ) {
    return null;
  }

  const p = parsed as DigestTokenPayload;
  if (p.exp < now) return null;
  return p;
}
```

- [ ] **Step 1.4: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: 9 passed (1 sanity + 8 digest-token).

- [ ] **Step 1.5: Commit**

```bash
git add server/src/digest-token.ts server/test/digest-token.test.ts
git commit -m "feat(digest): HMAC-signed action token sign/verify"
```

---

## Task 2: `digest-template` — pure HTML/text rendering (TDD)

**Files:**
- Create: `server/src/digest-template.ts`
- Create: `server/test/digest-template.test.ts`

- [ ] **Step 2.1: Write the failing test**

`server/test/digest-template.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderHtml, renderText, type DigestContent } from '../src/digest-template.js';

const BASE = 'https://mail.example.com';

function content(over: Partial<DigestContent> = {}): DigestContent {
  return {
    mailboxId: 1,
    mailboxAddress: 'alice@example.com',
    rows: [
      {
        fromAddress: 'sales@acme.com',
        fromName: 'Acme Sales',
        messageCount: 3,
        latestSubject: 'Q2 promo',
        latestReceivedAt: Date.parse('2026-04-29T14:32:00Z'),
        allowToken: 'TOKEN-ACME',
      },
    ],
    totalSendersInQuarantine: 1,
    windowStart: 0,
    ...over,
  };
}

describe('digest-template', () => {
  it('html includes mailbox address and sender details', () => {
    const html = renderHtml(content(), BASE);
    expect(html).toContain('alice@example.com');
    expect(html).toContain('sales@acme.com');
    expect(html).toContain('Acme Sales');
    expect(html).toContain('3 message');
    expect(html).toContain('Q2 promo');
  });

  it('html action button is a styled anchor with the action URL', () => {
    const html = renderHtml(content(), BASE);
    expect(html).toContain(`href="${BASE}/public/digest/allow?t=TOKEN-ACME"`);
    expect(html.toLowerCase()).toContain('allow forever');
  });

  it('html escapes special characters in subject, name, address', () => {
    const html = renderHtml(
      content({
        rows: [
          {
            fromAddress: 'x"y<z>@evil.com',
            fromName: '<script>alert(1)</script>',
            messageCount: 1,
            latestSubject: 'A & B "C"',
            latestReceivedAt: Date.now(),
            allowToken: 'T',
          },
        ],
      }),
      BASE,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B &quot;C&quot;');
    expect(html).toContain('x&quot;y&lt;z&gt;@evil.com');
  });

  it('html shows "+N more" footer when total exceeds rows', () => {
    const html = renderHtml(content({ totalSendersInQuarantine: 35 }), BASE);
    expect(html).toContain('+34 more');
  });

  it('html omits "+N more" footer when total equals rows', () => {
    const html = renderHtml(content({ totalSendersInQuarantine: 1 }), BASE);
    expect(html).not.toMatch(/\+\d+ more/);
  });

  it('text alternative covers the same data', () => {
    const text = renderText(content(), BASE);
    expect(text).toContain('alice@example.com');
    expect(text).toContain('sales@acme.com');
    expect(text).toContain('3 message');
    expect(text).toContain('Q2 promo');
    expect(text).toContain(`${BASE}/public/digest/allow?t=TOKEN-ACME`);
  });

  it('text shows "+N more" footer when applicable', () => {
    const text = renderText(content({ totalSendersInQuarantine: 35 }), BASE);
    expect(text).toContain('+34 more');
  });
});
```

- [ ] **Step 2.2: Run; expect FAIL**

```bash
npm test --workspace=server
```
Expected: FAIL — `Cannot find module '../src/digest-template.js'`.

- [ ] **Step 2.3: Implement `server/src/digest-template.ts`**

```ts
// Pure HTML and plaintext rendering for the quarantine digest email.
// No I/O, no secrets, no template engine — string concatenation with explicit escaping.

export type DigestSenderRow = {
  fromAddress: string;
  fromName: string | null;
  messageCount: number;
  latestSubject: string | null;
  latestReceivedAt: number;
  allowToken: string;
};

export type DigestContent = {
  mailboxId: number;
  mailboxAddress: string;
  rows: DigestSenderRow[];
  totalSendersInQuarantine: number;
  windowStart: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(ms: number): string {
  return new Date(ms).toUTCString();
}

function actionUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/public/digest/allow?t=${encodeURIComponent(token)}`;
}

export function renderHtml(content: DigestContent, baseUrl: string): string {
  const overflow = content.totalSendersInQuarantine - content.rows.length;
  const overflowFooter =
    overflow > 0
      ? `<tr><td style="padding:12px 16px;color:#888;font-size:12px;">+${overflow} more senders in quarantine — review in webmail.</td></tr>`
      : '';

  const rows = content.rows
    .map((r) => {
      const label = r.fromName
        ? `${escapeHtml(r.fromName)} &lt;${escapeHtml(r.fromAddress)}&gt;`
        : escapeHtml(r.fromAddress);
      const subj = r.latestSubject ? escapeHtml(r.latestSubject) : '(no subject)';
      const url = escapeHtml(actionUrl(baseUrl, r.allowToken));
      return `
<tr>
  <td style="padding:14px 16px;border-bottom:1px solid #eee;">
    <div style="font-weight:600;color:#222;">${label}</div>
    <div style="font-size:13px;color:#555;margin-top:2px;">
      ${r.messageCount} message${r.messageCount === 1 ? '' : 's'} • latest: ${subj} • ${escapeHtml(fmtDate(r.latestReceivedAt))}
    </div>
    <div style="margin-top:10px;">
      <a href="${url}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">
        Allow forever
      </a>
    </div>
  </td>
</tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e5ea;">
      <tr>
        <td style="padding:18px 16px;border-bottom:1px solid #e5e5ea;">
          <div style="font-size:18px;font-weight:700;">ZeroSpam quarantine digest</div>
          <div style="font-size:13px;color:#666;margin-top:2px;">${escapeHtml(content.mailboxAddress)}</div>
          <div style="font-size:13px;color:#666;margin-top:8px;">
            ${content.rows.length} sender${content.rows.length === 1 ? '' : 's'} waiting for your decision.
          </div>
        </td>
      </tr>
      ${rows}
      ${overflowFooter}
      <tr>
        <td style="padding:14px 16px;background:#fafafa;font-size:12px;color:#888;">
          Click "Allow forever" to release a sender's queued messages and trust them going forward.
          Anything you don't act on will expire from quarantine automatically.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderText(content: DigestContent, baseUrl: string): string {
  const lines: string[] = [];
  lines.push(`ZeroSpam quarantine digest — ${content.mailboxAddress}`);
  lines.push(
    `${content.rows.length} sender${content.rows.length === 1 ? '' : 's'} waiting for your decision.`,
  );
  lines.push('');

  for (const r of content.rows) {
    const label = r.fromName ? `${r.fromName} <${r.fromAddress}>` : r.fromAddress;
    const subj = r.latestSubject ?? '(no subject)';
    lines.push(`* ${label}`);
    lines.push(
      `  ${r.messageCount} message${r.messageCount === 1 ? '' : 's'} | latest: ${subj} | ${fmtDate(r.latestReceivedAt)}`,
    );
    lines.push(`  Allow forever: ${actionUrl(baseUrl, r.allowToken)}`);
    lines.push('');
  }

  const overflow = content.totalSendersInQuarantine - content.rows.length;
  if (overflow > 0) {
    lines.push(`+${overflow} more senders in quarantine — review in webmail.`);
    lines.push('');
  }

  lines.push(
    'Click "Allow forever" to release a sender\'s queued messages and trust them going forward.',
  );
  lines.push("Anything you don't act on will expire from quarantine automatically.");

  return lines.join('\n');
}
```

- [ ] **Step 2.4: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: 16 passed (1 sanity + 8 digest-token + 7 digest-template).

- [ ] **Step 2.5: Commit**

```bash
git add server/src/digest-template.ts server/test/digest-template.test.ts
git commit -m "feat(digest): pure HTML and plaintext digest renderers"
```

---

## Task 3: DB migrations + config (with TDD where it makes sense)

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/src/config.ts`
- Modify: `server/test/helpers.ts` (restore the full INSERT)
- Create: `server/test/config-secret.test.ts`

- [ ] **Step 3.1: Write a failing test for the auto-generated digest secret**

`server/test/config-secret.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, loadDigestSigningSecret } from '../src/config.js';

describe('digest signing secret', () => {
  const secretPath = join(config.dataDir, '.digest-secret');

  beforeEach(() => {
    delete process.env.DIGEST_SIGNING_SECRET;
    if (existsSync(secretPath)) rmSync(secretPath);
  });

  it('returns env value when set', () => {
    process.env.DIGEST_SIGNING_SECRET = 'env-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    expect(loadDigestSigningSecret()).toBe('env-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  });

  it('generates and persists a secret on first call when env is unset', () => {
    expect(existsSync(secretPath)).toBe(false);
    const s1 = loadDigestSigningSecret();
    expect(s1).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s1.length).toBeGreaterThanOrEqual(32);
    expect(readFileSync(secretPath, 'utf8').trim()).toBe(s1);
  });

  it('reuses the persisted secret on a subsequent call', () => {
    const s1 = loadDigestSigningSecret();
    const s2 = loadDigestSigningSecret();
    expect(s2).toBe(s1);
  });
});
```

- [ ] **Step 3.2: Run; expect FAIL**

Expected: `loadDigestSigningSecret` is not exported from `config.ts`.

- [ ] **Step 3.3: Modify `server/src/config.ts` to add the new env vars and the secret loader**

Replace the file contents with:
```ts
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}: ${v}`);
  return n;
}

const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDataDir = resolve(SERVER_ROOT, 'data');

const sendMode = (process.env.SEND_MODE ?? 'loopback') as 'loopback' | 'relay';

export const config = {
  smtpPort: envInt('SMTP_PORT', 2525),
  apiPort: envInt('API_PORT', 8025),
  dataDir: process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : defaultDataDir,
  quarantineTtlHours: envInt('QUARANTINE_TTL_HOURS', 168),
  sweeperIntervalSec: envInt('SWEEPER_INTERVAL_SEC', 60),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  sendMode,
  relay: {
    host: process.env.RELAY_HOST ?? '',
    port: envInt('RELAY_PORT', 587),
    user: process.env.RELAY_USER ?? '',
    pass: process.env.RELAY_PASS ?? '',
    secure: (process.env.RELAY_SECURE ?? '').toLowerCase() === 'true',
  },
  dkim: {
    selector: process.env.DKIM_SELECTOR ?? 'zs1',
  },
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  digestTickIntervalSec: envInt('DIGEST_TICK_INTERVAL_SEC', 60),
} as const;

export type Config = typeof config;

// Lazy-loaded so tests can mutate process.env between calls.
export function loadDigestSigningSecret(): string {
  const fromEnv = process.env.DIGEST_SIGNING_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  mkdirSync(config.dataDir, { recursive: true });
  const path = join(config.dataDir, '.digest-secret');
  if (existsSync(path)) {
    const persisted = readFileSync(path, 'utf8').trim();
    if (persisted.length > 0) return persisted;
  }

  const secret = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  writeFileSync(path, secret, { mode: 0o600 });
  return secret;
}

export function assertPublicBaseUrlIfDigestEnabled(anyMailboxHasDigest: boolean): void {
  if (anyMailboxHasDigest && !config.publicBaseUrl) {
    throw new Error(
      'PUBLIC_BASE_URL is unset but at least one mailbox has digest_enabled=1. Set PUBLIC_BASE_URL in env.',
    );
  }
}
```

- [ ] **Step 3.4: Run; expect PASS for the secret tests, but FAIL for sanity (still uses old INSERT)**

```bash
npm test --workspace=server
```
Expected: secret tests pass; sanity still passes because the INSERT we put in helpers.ts only references the original columns. Total: 19 passed.

- [ ] **Step 3.5: Add the schema migrations to `server/src/db.ts`**

Just before the existing migration block (the line `const messageCols = colsOf('messages');` near line 144), insert these blocks. Then add the `mailboxes` migrations alongside the existing per-table migrations:

Find:
```ts
const messageCols = colsOf('messages');
```

And add **before** it:
```ts
const mailboxCols = colsOf('mailboxes');
if (!mailboxCols.has('digest_enabled')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 0');
}
if (!mailboxCols.has('digest_hour')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN digest_hour INTEGER NOT NULL DEFAULT 8');
}
if (!mailboxCols.has('digest_recipient_mode')) {
  db.exec("ALTER TABLE mailboxes ADD COLUMN digest_recipient_mode TEXT NOT NULL DEFAULT 'external'");
}
if (!mailboxCols.has('owner_email')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN owner_email TEXT');
}
if (!mailboxCols.has('last_digest_sent_at')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN last_digest_sent_at INTEGER');
}
if (!mailboxCols.has('digest_last_error')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN digest_last_error TEXT');
}
if (!mailboxCols.has('digest_consecutive_failures')) {
  db.exec(
    'ALTER TABLE mailboxes ADD COLUMN digest_consecutive_failures INTEGER NOT NULL DEFAULT 0',
  );
}
```

Also extend the `Mailbox` type at the bottom of the file:
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
};
```

- [ ] **Step 3.6: Restore the full INSERT in `server/test/helpers.ts`**

Replace the temporary `seedMailbox` INSERT with the original full one (the version that includes all the digest columns — exactly as written in step 0.5).

- [ ] **Step 3.7: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: all tests still pass; the schema migrations now exist.

- [ ] **Step 3.8: Add a migration sanity test**

Append to `server/test/sanity.test.ts`:
```ts
import { db } from '../src/db.js';

describe('schema', () => {
  it('mailboxes has all digest columns', () => {
    const cols = db.prepare('PRAGMA table_info(mailboxes)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    for (const c of [
      'digest_enabled',
      'digest_hour',
      'digest_recipient_mode',
      'owner_email',
      'last_digest_sent_at',
      'digest_last_error',
      'digest_consecutive_failures',
    ]) {
      expect(names.has(c), `missing column: ${c}`).toBe(true);
    }
  });
});
```

- [ ] **Step 3.9: Run; expect PASS**

Expected: total grows by 1.

- [ ] **Step 3.10: Commit**

```bash
git add server/src/config.ts server/src/db.ts server/test/helpers.ts server/test/config-secret.test.ts server/test/sanity.test.ts
git commit -m "feat(digest): mailbox schema migrations + signing-secret loader"
```

---

## Task 4: `digester.assembleDigest` — content assembly (TDD)

**Files:**
- Create: `server/src/digester.ts`
- Create: `server/test/digester-assemble.test.ts`

- [ ] **Step 4.1: Write the failing test**

`server/test/digester-assemble.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { assembleDigest } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

describe('assembleDigest', () => {
  it('returns null when nothing is quarantined since last digest', async () => {
    const mailboxId = seedMailbox('alice@example.com', { lastDigestSentAt: Date.now() - 1000 });
    expect(await assembleDigest(mailboxId)).toBeNull();
  });

  it('groups by sender, counts messages, sorts by latest, signs tokens', async () => {
    const mailboxId = seedMailbox('alice@example.com');
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'first' });
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'second' });
    await injectQuarantined({ to: 'alice@example.com', from: 'news@beta.io', subject: 'beta news' });

    const c = await assembleDigest(mailboxId);
    expect(c).not.toBeNull();
    expect(c!.rows).toHaveLength(2);
    const senders = c!.rows.map((r) => r.fromAddress).sort();
    expect(senders).toEqual(['news@beta.io', 'sales@acme.com']);
    const acme = c!.rows.find((r) => r.fromAddress === 'sales@acme.com')!;
    expect(acme.messageCount).toBe(2);
    expect(acme.allowToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(c!.totalSendersInQuarantine).toBe(2);
  });

  it('caps at 30 senders and reports total in totalSendersInQuarantine', async () => {
    const mailboxId = seedMailbox('alice@example.com');
    for (let i = 0; i < 35; i++) {
      await injectQuarantined({
        to: 'alice@example.com',
        from: `sender${i}@x.test`,
        subject: `s${i}`,
      });
    }
    const c = await assembleDigest(mailboxId);
    expect(c!.rows).toHaveLength(30);
    expect(c!.totalSendersInQuarantine).toBe(35);
  });

  it('on first send (last_digest_sent_at IS NULL) selects all currently quarantined', async () => {
    const mailboxId = seedMailbox('alice@example.com', { lastDigestSentAt: null });
    // backdate one quarantined message to before "now-2-days"
    await injectQuarantined({ to: 'alice@example.com', from: 'old@x.test' });
    db.prepare("UPDATE messages SET received_at = received_at - 86400000*7 WHERE from_address = ?")
      .run('old@x.test');
    await injectQuarantined({ to: 'alice@example.com', from: 'new@x.test' });

    const c = await assembleDigest(mailboxId);
    expect(c!.rows.map((r) => r.fromAddress).sort()).toEqual(['new@x.test', 'old@x.test']);
  });

  it('when last_digest_sent_at is set, only shows senders newer than it', async () => {
    const mailboxId = seedMailbox('alice@example.com');
    await injectQuarantined({ to: 'alice@example.com', from: 'old@x.test' });
    // mark as digested
    db.prepare('UPDATE mailboxes SET last_digest_sent_at = ? WHERE id = ?').run(Date.now() + 1, mailboxId);
    await new Promise((r) => setTimeout(r, 5));
    await injectQuarantined({ to: 'alice@example.com', from: 'new@x.test' });

    const c = await assembleDigest(mailboxId);
    expect(c).not.toBeNull();
    expect(c!.rows.map((r) => r.fromAddress)).toEqual(['new@x.test']);
  });

  it('returns null for unknown mailbox id', async () => {
    expect(await assembleDigest(99999)).toBeNull();
  });
});
```

- [ ] **Step 4.2: Run; expect FAIL**

Expected: `Cannot find module '../src/digester.js'`.

- [ ] **Step 4.3: Implement `server/src/digester.ts` — assembly only (we'll add scheduler/dispatch later)**

Create `server/src/digester.ts`:
```ts
// Digest scheduler, content assembly, and dispatch.
// Mirrors the shape of sweeper.ts: setInterval + per-row check-and-act.
//
// Public exports: assembleDigest, sendDigest, tick, startDigester.

import { db } from './db.js';
import type { Mailbox } from './db.js';
import { sign as signToken, type DigestTokenPayload } from './digest-token.js';
import {
  type DigestContent,
  type DigestSenderRow,
} from './digest-template.js';
import { config, loadDigestSigningSecret } from './config.js';

const MAX_SENDERS_PER_DIGEST = 30;

const findMailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ?');

export async function assembleDigest(mailboxId: number): Promise<DigestContent | null> {
  const mb = findMailbox.get(mailboxId) as Mailbox | undefined;
  if (!mb) return null;

  const cutoff = mb.last_digest_sent_at ?? 0;
  const tokenExp = Date.now() + mb.quarantine_ttl_hours * 3600 * 1000;
  const secret = loadDigestSigningSecret();

  type Row = {
    from_address: string;
    from_name: string | null;
    message_count: number;
    latest_subject: string | null;
    latest_received_at: number;
  };

  const rows = db
    .prepare(
      `SELECT
         from_address,
         MAX(from_name) AS from_name,
         COUNT(*) AS message_count,
         (SELECT subject FROM messages m2
            WHERE m2.mailbox_id = ? AND m2.folder = 'quarantine'
              AND m2.from_address = m.from_address AND m2.received_at > ?
            ORDER BY received_at DESC LIMIT 1) AS latest_subject,
         MAX(received_at) AS latest_received_at
       FROM messages m
       WHERE mailbox_id = ?
         AND folder = 'quarantine'
         AND received_at > ?
       GROUP BY from_address
       ORDER BY MAX(received_at) DESC`,
    )
    .all(mailboxId, cutoff, mailboxId, cutoff) as Row[];

  if (rows.length === 0) return null;

  const limited = rows.slice(0, MAX_SENDERS_PER_DIGEST);
  const senderRows: DigestSenderRow[] = limited.map((r) => {
    const payload: DigestTokenPayload = {
      v: 1,
      mailboxId,
      sender: r.from_address.toLowerCase(),
      action: 'allow-forever',
      exp: tokenExp,
    };
    return {
      fromAddress: r.from_address,
      fromName: r.from_name,
      messageCount: r.message_count,
      latestSubject: r.latest_subject,
      latestReceivedAt: r.latest_received_at,
      allowToken: signToken(payload, secret),
    };
  });

  return {
    mailboxId,
    mailboxAddress: mb.address,
    rows: senderRows,
    totalSendersInQuarantine: rows.length,
    windowStart: cutoff,
  };
}
```

- [ ] **Step 4.4: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: all 6 new tests pass + everything else green.

- [ ] **Step 4.5: Commit**

```bash
git add server/src/digester.ts server/test/digester-assemble.test.ts
git commit -m "feat(digest): assembleDigest with grouping, cap, and signed tokens"
```

---

## Task 5: `digester.sendDigest` — external mode

**Files:**
- Modify: `server/src/digester.ts`
- Create: `server/test/digester-send-external.test.ts`

- [ ] **Step 5.1: Write the failing test**

`server/test/digester-send-external.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sendDigest, assembleDigest } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

describe('sendDigest external mode', () => {
  it('sends a digest message to owner_email and records it in Sent', async () => {
    const mailboxId = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'alice-personal@gmail.com',
    });
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 's' });

    const content = await assembleDigest(mailboxId);
    expect(content).not.toBeNull();
    const r = await sendDigest(mailboxId, content!);
    expect(r.delivered).toBe(true);

    const sent = db
      .prepare("SELECT subject, to_addresses FROM messages WHERE mailbox_id = ? AND folder = 'sent'")
      .all(mailboxId) as { subject: string; to_addresses: string }[];
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/quarantine digest/i);
    expect(JSON.parse(sent[0].to_addresses)).toEqual(['alice-personal@gmail.com']);
  });

  it('throws if external mode lacks owner_email', async () => {
    const mailboxId = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: undefined,
    });
    await injectQuarantined({ to: 'alice@example.com', from: 'a@b.com' });
    const content = await assembleDigest(mailboxId);
    await expect(sendDigest(mailboxId, content!)).rejects.toThrow(/owner_email/);
  });
});
```

- [ ] **Step 5.2: Run; expect FAIL**

Expected: `sendDigest` is not exported from digester.

- [ ] **Step 5.3: Add `sendDigest` (external branch only) to `server/src/digester.ts`**

Append to `server/src/digester.ts`:
```ts
import { sendMessage } from './sender.js';
import { renderHtml, renderText } from './digest-template.js';

export type SendDigestResult = {
  delivered: boolean;
  recipientMode: 'external' | 'loopback';
};

export async function sendDigest(
  mailboxId: number,
  content: DigestContent,
): Promise<SendDigestResult> {
  const mb = findMailbox.get(mailboxId) as Mailbox | undefined;
  if (!mb) throw new Error(`mailbox ${mailboxId} not found`);
  if (!config.publicBaseUrl) {
    throw new Error('PUBLIC_BASE_URL is unset; cannot build digest action URLs');
  }

  const subject = `ZeroSpam quarantine digest — ${content.rows.length} sender${content.rows.length === 1 ? '' : 's'} waiting`;
  const html = renderHtml(content, config.publicBaseUrl);
  const text = renderText(content, config.publicBaseUrl);

  if (mb.digest_recipient_mode === 'external') {
    if (!mb.owner_email) {
      throw new Error(`mailbox ${mailboxId} has external digest mode but no owner_email`);
    }
    await sendMessage({
      mailboxId,
      to: [mb.owner_email],
      subject,
      text,
      html,
    });
    return { delivered: true, recipientMode: 'external' };
  }

  // loopback path is added in Task 6
  throw new Error(`unknown digest_recipient_mode: ${mb.digest_recipient_mode}`);
}
```

You also need the `import { type DigestContent } ...` in the existing import block — extend the `digest-template.js` import to include `DigestContent`:
```ts
import {
  type DigestContent,
  type DigestSenderRow,
  renderHtml,
  renderText,
} from './digest-template.js';
```
(And remove the duplicate `import { renderHtml, renderText }` line that was added above.)

- [ ] **Step 5.4: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: 2 new tests pass.

If `sendMessage` fails because the mailbox's domain has no DKIM keys, the test helper's `seedDomain` already calls `ensureDkim` — confirm by re-reading helpers.ts. If a real test still fails on DKIM, add `ensureDkim(domainId)` after `seedDomain` (it's idempotent).

- [ ] **Step 5.5: Commit**

```bash
git add server/src/digester.ts server/test/digester-send-external.test.ts
git commit -m "feat(digest): sendDigest external mode via sender.sendMessage"
```

---

## Task 6: `digester.sendDigest` — loopback mode

**Files:**
- Modify: `server/src/digester.ts`
- Create: `server/test/digester-send-loopback.test.ts`

- [ ] **Step 6.1: Write the failing test**

`server/test/digester-send-loopback.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sendDigest, assembleDigest, ensureDigestSelfWhitelist } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

describe('sendDigest loopback mode', () => {
  it('inserts self-whitelist rule on enable', () => {
    const mailboxId = seedMailbox('alice@example.com', { digestRecipientMode: 'loopback' });
    ensureDigestSelfWhitelist(mailboxId);
    const rule = db
      .prepare(
        "SELECT pattern FROM whitelist_rules WHERE mailbox_id = ? AND note = 'self:digest'",
      )
      .get(mailboxId) as { pattern: string } | undefined;
    expect(rule?.pattern).toBe('digest-system@example.com');
  });

  it('is idempotent — calling twice does not duplicate the rule', () => {
    const mailboxId = seedMailbox('alice@example.com', { digestRecipientMode: 'loopback' });
    ensureDigestSelfWhitelist(mailboxId);
    ensureDigestSelfWhitelist(mailboxId);
    const rows = db
      .prepare(
        "SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND note = 'self:digest'",
      )
      .all(mailboxId);
    expect(rows).toHaveLength(1);
  });

  it('delivers loopback digest to the mailbox inbox', async () => {
    const mailboxId = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'loopback',
    });
    ensureDigestSelfWhitelist(mailboxId);
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 's' });

    const content = await assembleDigest(mailboxId);
    const r = await sendDigest(mailboxId, content!);
    expect(r.delivered).toBe(true);
    expect(r.recipientMode).toBe('loopback');

    const inboxDigest = db
      .prepare(
        "SELECT subject FROM messages WHERE mailbox_id = ? AND folder = 'inbox' AND from_address = ?",
      )
      .get(mailboxId, 'digest-system@example.com') as { subject: string } | undefined;
    expect(inboxDigest?.subject).toMatch(/quarantine digest/i);
  });
});
```

- [ ] **Step 6.2: Run; expect FAIL**

Expected: `ensureDigestSelfWhitelist` not exported.

- [ ] **Step 6.3: Add the loopback branch + helper to `server/src/digester.ts`**

Append the helper:
```ts
const ruleExists = db.prepare(
  'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
);
const insertRule = db.prepare(
  'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
);

function digestSystemAddress(mailboxAddress: string): string {
  const domain = mailboxAddress.split('@')[1];
  return `digest-system@${domain}`;
}

export function ensureDigestSelfWhitelist(mailboxId: number): void {
  const mb = findMailbox.get(mailboxId) as Mailbox | undefined;
  if (!mb) return;
  const pattern = digestSystemAddress(mb.address);
  const existing = ruleExists.get(mailboxId, 'address', pattern);
  if (!existing) {
    insertRule.run(mailboxId, 'address', pattern, 'self:digest', Date.now());
  }
}
```

Then replace the `sendDigest` implementation's loopback branch (currently throws) with the actual loopback logic. Replace the body of the `if (mb.digest_recipient_mode === 'external') {...}` and the throw below it with:

```ts
  if (mb.digest_recipient_mode === 'external') {
    if (!mb.owner_email) {
      throw new Error(`mailbox ${mailboxId} has external digest mode but no owner_email`);
    }
    await sendMessage({
      mailboxId,
      to: [mb.owner_email],
      subject,
      text,
      html,
    });
    return { delivered: true, recipientMode: 'external' };
  }

  // Loopback: synthesize a multipart RFC 822 buffer and run it through ingest()
  // exactly like the test injector does. The digest-system@<domain> sender is
  // pre-whitelisted via ensureDigestSelfWhitelist, so the digest itself does
  // not land in quarantine.
  const fromAddr = digestSystemAddress(mb.address);
  const boundary = `bndry-${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ZeroSpam Digest <${fromAddr}>`,
    `To: ${mb.address}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${mb.address.split('@')[1]}>`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    text,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
    `--${boundary}--`,
  ];
  const raw = Buffer.from(headers.join('\r\n'));
  await ingest(raw, mb.address);
  return { delivered: true, recipientMode: 'loopback' };
```

Add the `ingest` import at the top of digester.ts:
```ts
import { ingest } from './ingest.js';
```

- [ ] **Step 6.4: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 6.5: Commit**

```bash
git add server/src/digester.ts server/test/digester-send-loopback.test.ts
git commit -m "feat(digest): sendDigest loopback mode + self-whitelist bootstrap"
```

---

## Task 7: `digester.tick` — scheduling, due-mailbox query, failure tracking

**Files:**
- Modify: `server/src/digester.ts`
- Create: `server/test/digester-tick.test.ts`

- [ ] **Step 7.1: Write the failing test**

`server/test/digester-tick.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { tick } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

function setHourBack(mailboxId: number, hour: number) {
  db.prepare('UPDATE mailboxes SET digest_hour = ? WHERE id = ?').run(hour, mailboxId);
}

function setLastDigest(mailboxId: number, ts: number | null) {
  db.prepare('UPDATE mailboxes SET last_digest_sent_at = ? WHERE id = ?').run(ts, mailboxId);
}

describe('digester.tick', () => {
  it('skips disabled mailboxes', async () => {
    const id = seedMailbox('alice@example.com', { digestEnabled: false });
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });
    const r = await tick(new Date('2026-04-29T20:00:00Z'));
    expect(r.sentForMailboxes).toHaveLength(0);
    expect(r.skippedEmpty).toHaveLength(0);
  });

  it('skips mailboxes whose digest_hour has not yet arrived today', async () => {
    const id = seedMailbox('alice@example.com', { digestEnabled: true });
    setHourBack(id, 23);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });
    const r = await tick(new Date('2026-04-29T05:00:00Z')); // before 23:00
    expect(r.sentForMailboxes).toEqual([]);
  });

  it('sends a digest when due and there is content', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    setHourBack(id, 8);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z')); // past 08:00
    expect(r.sentForMailboxes).toEqual([id]);

    const mb = db.prepare('SELECT last_digest_sent_at, digest_consecutive_failures FROM mailboxes WHERE id = ?').get(id) as
      | { last_digest_sent_at: number; digest_consecutive_failures: number }
      | undefined;
    expect(mb?.last_digest_sent_at).toBeGreaterThan(0);
    expect(mb?.digest_consecutive_failures).toBe(0);
  });

  it('updates last_digest_sent_at even when digest is empty', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    setHourBack(id, 8);
    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.skippedEmpty).toEqual([id]);
    const mb = db.prepare('SELECT last_digest_sent_at FROM mailboxes WHERE id = ?').get(id) as
      | { last_digest_sent_at: number }
      | undefined;
    expect(mb?.last_digest_sent_at).toBeGreaterThan(0);
  });

  it('skips when already sent today after the boundary', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    setHourBack(id, 8);
    setLastDigest(id, Date.parse('2026-04-29T08:30:00Z')); // already sent today
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.sentForMailboxes).toEqual([]);
  });

  it('enforces 12h anti-double-send guard when digest_hour is changed mid-day', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    // User already sent at 08:30 today, then bumped digest_hour to 16.
    // last < today's new 16:00 boundary, AND now is past 16:00,
    // BUT now-last is only ~8h, so the 12h guard should block.
    setHourBack(id, 16);
    setLastDigest(id, Date.parse('2026-04-29T08:30:00Z'));
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T16:30:00Z'));
    expect(r.sentForMailboxes).toEqual([]);
  });

  it('records error and increments failures on send error', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      // missing ownerEmail → sendDigest throws
    });
    setHourBack(id, 8);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.errored).toEqual([id]);
    const mb = db
      .prepare('SELECT digest_consecutive_failures, digest_last_error, digest_enabled FROM mailboxes WHERE id = ?')
      .get(id) as
      | { digest_consecutive_failures: number; digest_last_error: string; digest_enabled: number }
      | undefined;
    expect(mb?.digest_consecutive_failures).toBe(1);
    expect(mb?.digest_last_error).toMatch(/owner_email/);
    expect(mb?.digest_enabled).toBe(1);
  });

  it('auto-disables after 7 consecutive failures', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
    });
    setHourBack(id, 8);
    db.prepare('UPDATE mailboxes SET digest_consecutive_failures = 6 WHERE id = ?').run(id);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.errored).toEqual([id]);
    expect(r.autoDisabled).toEqual([id]);
    const mb = db.prepare('SELECT digest_enabled FROM mailboxes WHERE id = ?').get(id) as
      | { digest_enabled: number }
      | undefined;
    expect(mb?.digest_enabled).toBe(0);
  });
});
```

- [ ] **Step 7.2: Run; expect FAIL**

Expected: `tick` not exported.

- [ ] **Step 7.3: Add `tick` to `server/src/digester.ts`**

Append:
```ts
const TWELVE_HOURS_MS = 12 * 3600 * 1000;
const FAILURE_THRESHOLD = 7;

function todayHourBoundaryMs(now: Date, hour: number): number {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export type TickResult = {
  sentForMailboxes: number[];
  skippedEmpty: number[];
  errored: number[];
  autoDisabled: number[];
};

export async function tick(now: Date = new Date()): Promise<TickResult> {
  const result: TickResult = {
    sentForMailboxes: [],
    skippedEmpty: [],
    errored: [],
    autoDisabled: [],
  };

  const mailboxes = db
    .prepare('SELECT * FROM mailboxes WHERE digest_enabled = 1')
    .all() as Mailbox[];

  for (const mb of mailboxes) {
    const todayBoundary = todayHourBoundaryMs(now, mb.digest_hour);
    if (now.getTime() < todayBoundary) continue;

    if (
      mb.last_digest_sent_at !== null &&
      mb.last_digest_sent_at >= todayBoundary
    ) {
      continue; // already sent today after the boundary
    }

    if (
      mb.last_digest_sent_at !== null &&
      now.getTime() - mb.last_digest_sent_at < TWELVE_HOURS_MS
    ) {
      continue; // 12h anti-double-send guard
    }

    try {
      const content = await assembleDigest(mb.id);
      if (content === null) {
        db.prepare(
          'UPDATE mailboxes SET last_digest_sent_at = ?, digest_consecutive_failures = 0, digest_last_error = NULL WHERE id = ?',
        ).run(now.getTime(), mb.id);
        result.skippedEmpty.push(mb.id);
        continue;
      }
      await sendDigest(mb.id, content);
      db.prepare(
        'UPDATE mailboxes SET last_digest_sent_at = ?, digest_consecutive_failures = 0, digest_last_error = NULL WHERE id = ?',
      ).run(now.getTime(), mb.id);
      result.sentForMailboxes.push(mb.id);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const newFailures = mb.digest_consecutive_failures + 1;
      const willDisable = newFailures >= FAILURE_THRESHOLD;
      db.prepare(
        `UPDATE mailboxes
            SET digest_consecutive_failures = ?,
                digest_last_error = ?,
                digest_enabled = CASE WHEN ? THEN 0 ELSE digest_enabled END
          WHERE id = ?`,
      ).run(newFailures, msg.slice(0, 500), willDisable ? 1 : 0, mb.id);
      result.errored.push(mb.id);
      if (willDisable) result.autoDisabled.push(mb.id);
    }
  }

  return result;
}
```

- [ ] **Step 7.4: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 7.5: Commit**

```bash
git add server/src/digester.ts server/test/digester-tick.test.ts
git commit -m "feat(digest): scheduler tick with 12h guard and 7-failure auto-disable"
```

---

## Task 8: Boot wiring — `startDigester` + `index.ts`

**Files:**
- Modify: `server/src/digester.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 8.1: Add `startDigester` to `server/src/digester.ts`**

Append:
```ts
import { assertPublicBaseUrlIfDigestEnabled } from './config.js';

export function startDigester(): () => void {
  const anyEnabled = (db
    .prepare('SELECT COUNT(*) AS c FROM mailboxes WHERE digest_enabled = 1')
    .get() as { c: number }).c > 0;
  assertPublicBaseUrlIfDigestEnabled(anyEnabled);

  const run = async () => {
    try {
      await tick();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[digester] tick failure', e);
    }
  };
  // initial run on boot so a missed digest_hour gets caught up
  void run();
  const interval = setInterval(run, config.digestTickIntervalSec * 1000);
  // eslint-disable-next-line no-console
  console.log(`[digester] running every ${config.digestTickIntervalSec}s`);
  return () => clearInterval(interval);
}
```

- [ ] **Step 8.2: Wire it into `server/src/index.ts`**

Replace the contents:
```ts
import { startSmtp } from './smtp.js';
import { startApi } from './api.js';
import { startSweeper } from './sweeper.js';
import { startDigester } from './digester.js';

async function main() {
  startSmtp();
  await startApi();
  startSweeper();
  startDigester();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
```

- [ ] **Step 8.3: Smoke-build the server**

Run:
```bash
npm run build --workspace=server
```
Expected: clean build, no TS errors.

- [ ] **Step 8.4: Run all tests one more time**

```bash
npm test --workspace=server
```
Expected: all green.

- [ ] **Step 8.5: Commit**

```bash
git add server/src/digester.ts server/src/index.ts
git commit -m "feat(digest): boot digester alongside sweeper"
```

---

## Task 9: Extend `PATCH /api/mailboxes/:id`

**Files:**
- Modify: `server/src/api.ts`
- Create: `server/test/api-patch-mailbox.test.ts`

- [ ] **Step 9.1: Write the failing test**

`server/test/api-patch-mailbox.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox } from './helpers.js';

describe('PATCH /api/mailboxes/:id digest fields', () => {
  it('accepts digestEnabled + digestHour + recipient mode', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        payload: {
          digestEnabled: true,
          digestHour: 7,
          digestRecipientMode: 'external',
          ownerEmail: 'alice-personal@gmail.com',
        },
      });
      expect(r.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('rejects external digest enable without owner_email', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        payload: { digestEnabled: true, digestRecipientMode: 'external' },
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().error).toMatch(/owner_email/i);
    } finally {
      await app.close();
    }
  });

  it('seeds the digest-self whitelist when switching to loopback enabled', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        payload: { digestEnabled: true, digestRecipientMode: 'loopback' },
      });
      expect(r.statusCode).toBe(200);
      const list = await app.inject({ method: 'GET', url: `/api/whitelist?mailboxId=${id}` });
      const rules = list.json() as Array<{ pattern: string; note: string }>;
      expect(rules.some((x) => x.note === 'self:digest' && x.pattern === 'digest-system@example.com'))
        .toBe(true);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 9.2: Run; expect FAIL**

(`startApi` listens on a port; if Fastify complains, use `app.listen({ port: 0 })`. The current implementation calls `await app.listen({ port: config.apiPort, host: '0.0.0.0' })` which can collide between tests. **Workaround:** set `API_PORT=0` for tests by adding `API_PORT: '0'` to the `env` block in `vitest.config.ts`. This binds to a random free port. Add it now.)

- [ ] **Step 9.3: Update `vitest.config.ts` env block**

Edit `server/vitest.config.ts`, replacing the `env` block:
```ts
    env: {
      DATA_DIR: 'test-data',
      PUBLIC_BASE_URL: 'http://localhost:8025',
      DIGEST_SIGNING_SECRET: 'test-secret-thirty-two-bytes-min-padpadpadpad',
      DIGEST_TICK_INTERVAL_SEC: '60',
      API_PORT: '0',
    },
```

- [ ] **Step 9.4: Extend the schemas + handler in `server/src/api.ts`**

Find the existing `patchMailboxSchema` and the `app.patch('/api/mailboxes/:id', ...)` block. Replace them with:

```ts
  const patchMailboxSchema = z.object({
    displayName: z.string().nullable().optional(),
    quarantineTtlHours: z.coerce.number().int().min(1).max(8760).optional(),
    digestEnabled: z.boolean().optional(),
    digestHour: z.coerce.number().int().min(0).max(23).optional(),
    digestRecipientMode: z.enum(['external', 'loopback']).optional(),
    ownerEmail: z.string().email().nullable().optional(),
  });

  app.patch('/api/mailboxes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = patchMailboxSchema.parse(req.body);

    // Validate cross-field constraints based on the post-merge state.
    const current = db
      .prepare('SELECT digest_enabled, digest_recipient_mode, owner_email FROM mailboxes WHERE id = ?')
      .get(Number(id)) as
      | { digest_enabled: number; digest_recipient_mode: 'external' | 'loopback'; owner_email: string | null }
      | undefined;
    if (!current) return reply.code(404).send({ error: 'mailbox not found' });

    const nextEnabled = body.digestEnabled ?? Boolean(current.digest_enabled);
    const nextMode = body.digestRecipientMode ?? current.digest_recipient_mode;
    const nextOwner = body.ownerEmail !== undefined ? body.ownerEmail : current.owner_email;

    if (nextEnabled && nextMode === 'external' && !nextOwner) {
      return reply.code(400).send({ error: 'owner_email is required when external digest is enabled' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(body.displayName);
    }
    if (body.quarantineTtlHours !== undefined) {
      fields.push('quarantine_ttl_hours = ?');
      values.push(body.quarantineTtlHours);
    }
    if (body.digestEnabled !== undefined) {
      fields.push('digest_enabled = ?');
      values.push(body.digestEnabled ? 1 : 0);
    }
    if (body.digestHour !== undefined) {
      fields.push('digest_hour = ?');
      values.push(body.digestHour);
    }
    if (body.digestRecipientMode !== undefined) {
      fields.push('digest_recipient_mode = ?');
      values.push(body.digestRecipientMode);
    }
    if (body.ownerEmail !== undefined) {
      fields.push('owner_email = ?');
      values.push(body.ownerEmail);
    }
    if (!fields.length) return { ok: true };
    values.push(Number(id));
    db.prepare(`UPDATE mailboxes SET ${fields.join(', ')} WHERE id = ?`).run(...(values as any[]));

    if (nextEnabled && nextMode === 'loopback') {
      const { ensureDigestSelfWhitelist } = await import('./digester.js');
      ensureDigestSelfWhitelist(Number(id));
    }
    return { ok: true };
  });
```

- [ ] **Step 9.5: Run; expect PASS**

```bash
npm test --workspace=server
```
Expected: 3 new tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add server/src/api.ts server/vitest.config.ts server/test/api-patch-mailbox.test.ts
git commit -m "feat(digest): extend PATCH /api/mailboxes with digest config + validation"
```

---

## Task 10: `GET /public/digest/allow` — confirm page

**Files:**
- Modify: `server/src/api.ts`
- Create: `server/src/digest-pages.ts` (HTML render helpers)
- Create: `server/test/digest-routes-get.test.ts`

- [ ] **Step 10.1: Write the failing test**

`server/test/digest-routes-get.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { sign } from '../src/digest-token.js';
import { loadDigestSigningSecret } from '../src/config.js';

describe('GET /public/digest/allow', () => {
  it('renders confirm page for a valid token', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 's' });
      const t = sign(
        { v: 1, mailboxId: id, sender: 'sales@acme.com', action: 'allow-forever', exp: Date.now() + 86400000 },
        loadDigestSigningSecret(),
      );
      const r = await app.inject({ method: 'GET', url: `/public/digest/allow?t=${encodeURIComponent(t)}` });
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toMatch(/text\/html/);
      expect(r.body).toContain('sales@acme.com');
      expect(r.body.toLowerCase()).toContain('confirm');
      expect(r.body).toContain('1 quarantined message');
      expect(r.body).toContain(`<input type="hidden" name="t" value="${t}"`);
    } finally {
      await app.close();
    }
  });

  it('renders the generic expired page for a tampered token', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({ method: 'GET', url: `/public/digest/allow?t=BOGUS` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('expired or invalid');
      expect(r.body.toLowerCase()).not.toContain('confirm');
    } finally {
      await app.close();
    }
  });

  it('renders the generic expired page for a missing mailbox', async () => {
    const app = await startApi();
    try {
      const t = sign(
        { v: 1, mailboxId: 99999, sender: 's@x', action: 'allow-forever', exp: Date.now() + 60000 },
        loadDigestSigningSecret(),
      );
      const r = await app.inject({ method: 'GET', url: `/public/digest/allow?t=${encodeURIComponent(t)}` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('expired or invalid');
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 10.2: Run; expect FAIL**

Expected: 404 from the route or module-not-found.

- [ ] **Step 10.3: Create `server/src/digest-pages.ts`**

```ts
// Server-rendered HTML pages for the public digest action flow.
// Style is deliberately close to the digest email so the confirm page
// doesn't read as a phishing landing.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SHELL_HEAD = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZeroSpam</title>
<style>
  body { margin:0; background:#f5f5f7; font-family:-apple-system,Segoe UI,Roboto,sans-serif; color:#222; }
  .card { max-width:520px; margin:48px auto; background:#fff; border:1px solid #e5e5ea; border-radius:10px; padding:24px; }
  h1 { font-size:20px; margin:0 0 12px; }
  p { font-size:14px; line-height:1.5; color:#444; }
  ul { padding-left:20px; }
  .muted { color:#777; font-size:12px; }
  .actions { margin-top:20px; display:flex; gap:8px; }
  .btn { display:inline-block; padding:10px 16px; border-radius:6px; text-decoration:none; font-weight:600; font-size:14px; border:0; cursor:pointer; }
  .btn-primary { background:#2563eb; color:#fff; }
  .btn-secondary { background:#fff; color:#444; border:1px solid #ccc; }
  .sender { font-weight:600; font-size:16px; word-break:break-all; }
</style>
</head><body>`;
const SHELL_FOOT = `</body></html>`;

export function renderConfirmPage(args: {
  token: string;
  sender: string;
  quarantinedCount: number;
}): string {
  const sender = escapeHtml(args.sender);
  const count = args.quarantinedCount;
  return `${SHELL_HEAD}
<div class="card">
  <h1>Trust this sender forever?</h1>
  <p class="sender">${sender}</p>
  <p>Currently <strong>${count}</strong> quarantined message${count === 1 ? '' : 's'} from this sender.</p>
  <p>Confirming will:</p>
  <ul>
    <li>Add a whitelist rule for <code>${sender}</code></li>
    <li>Move all currently-quarantined messages from this sender to your inbox</li>
    <li>Let future messages from this sender skip quarantine</li>
  </ul>
  <form method="POST" action="/public/digest/allow" class="actions">
    <input type="hidden" name="t" value="${escapeHtml(args.token)}">
    <button class="btn btn-primary" type="submit">Confirm</button>
    <a href="about:blank" class="btn btn-secondary">Cancel</a>
  </form>
</div>
${SHELL_FOOT}`;
}

export function renderSuccessPage(args: {
  sender: string;
  movedCount: number;
  alreadyTrusted: boolean;
  webmailUrl?: string;
}): string {
  const sender = escapeHtml(args.sender);
  const head = args.alreadyTrusted ? 'Already trusted.' : 'Sender trusted.';
  const link = args.webmailUrl
    ? `<a class="btn btn-primary" href="${escapeHtml(args.webmailUrl)}">Open webmail</a>`
    : '';
  return `${SHELL_HEAD}
<div class="card">
  <h1>${head}</h1>
  <p class="sender">${sender}</p>
  <p>${args.movedCount} message${args.movedCount === 1 ? '' : 's'} moved to your inbox.</p>
  <p class="muted">Future messages from this sender will skip quarantine. Mistake? Open webmail to remove the rule.</p>
  <div class="actions">${link}</div>
</div>
${SHELL_FOOT}`;
}

export function renderExpiredPage(): string {
  return `${SHELL_HEAD}
<div class="card">
  <h1>This link has expired or is invalid.</h1>
  <p>Open your webmail and act on the sender from there. Quarantined messages still expire on their own schedule.</p>
</div>
${SHELL_FOOT}`;
}
```

- [ ] **Step 10.4: Add the GET route to `server/src/api.ts`**

Find the section comment `// ---- SSE ----` and insert just **before** it:
```ts
  // ---- public digest action routes ----
  // No auth, no CORS, no rate limit (v1). Reverse proxy can lock down /api/* if needed.
  app.get('/public/digest/allow', async (req, reply) => {
    const { renderConfirmPage, renderExpiredPage } = await import('./digest-pages.js');
    const { verify } = await import('./digest-token.js');
    const { loadDigestSigningSecret } = await import('./config.js');
    const t = (req.query as { t?: string }).t ?? '';
    const payload = verify(t, loadDigestSigningSecret(), Date.now());
    if (!payload) {
      reply.type('text/html');
      return renderExpiredPage();
    }
    const mb = db
      .prepare('SELECT id FROM mailboxes WHERE id = ?')
      .get(payload.mailboxId) as { id: number } | undefined;
    if (!mb) {
      reply.type('text/html');
      return renderExpiredPage();
    }
    const count = (db
      .prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND folder = 'quarantine' AND from_address = ?",
      )
      .get(payload.mailboxId, payload.sender.toLowerCase()) as { c: number }).c;
    reply.type('text/html');
    return renderConfirmPage({ token: t, sender: payload.sender, quarantinedCount: count });
  });
```

- [ ] **Step 10.5: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 10.6: Commit**

```bash
git add server/src/digest-pages.ts server/src/api.ts server/test/digest-routes-get.test.ts
git commit -m "feat(digest): GET /public/digest/allow confirm page"
```

---

## Task 11: `POST /public/digest/allow` — perform action

**Files:**
- Modify: `server/src/api.ts`
- Create: `server/test/digest-routes-post.test.ts`

- [ ] **Step 11.1: Register the form-body parser**

Fastify needs an explicit parser for `application/x-www-form-urlencoded`. Add this in `server/src/api.ts` immediately after `await app.register(cors, { origin: true });`:

```ts
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body: string, done) => {
      try {
        const params = new URLSearchParams(body);
        const out: Record<string, string> = {};
        for (const [k, v] of params) out[k] = v;
        done(null, out);
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );
```

- [ ] **Step 11.2: Write the failing test**

`server/test/digest-routes-post.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { sign } from '../src/digest-token.js';
import { loadDigestSigningSecret } from '../src/config.js';
import { db } from '../src/db.js';

async function postForm(app: Awaited<ReturnType<typeof startApi>>, t: string) {
  return app.inject({
    method: 'POST',
    url: '/public/digest/allow',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: `t=${encodeURIComponent(t)}`,
  });
}

describe('POST /public/digest/allow', () => {
  it('whitelists the sender and moves their quarantined messages to inbox', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      const m1 = await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'a' });
      const m2 = await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'b' });
      const t = sign(
        { v: 1, mailboxId: id, sender: 'sales@acme.com', action: 'allow-forever', exp: Date.now() + 86400000 },
        loadDigestSigningSecret(),
      );

      const r = await postForm(app, t);
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('trusted');
      expect(r.body).toContain('2 message');

      const folders = db
        .prepare('SELECT id, folder FROM messages WHERE id IN (?, ?)')
        .all(m1, m2) as { id: string; folder: string }[];
      expect(folders.every((x) => x.folder === 'inbox')).toBe(true);

      const rule = db
        .prepare(
          "SELECT pattern, note FROM whitelist_rules WHERE mailbox_id = ? AND kind = 'address' AND pattern = ?",
        )
        .get(id, 'sales@acme.com') as { pattern: string; note: string } | undefined;
      expect(rule?.note).toBe('digest:allow-forever');
    } finally {
      await app.close();
    }
  });

  it('is idempotent: clicking twice does not duplicate the rule and reports 0 moved', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'a' });
      const t = sign(
        { v: 1, mailboxId: id, sender: 'sales@acme.com', action: 'allow-forever', exp: Date.now() + 86400000 },
        loadDigestSigningSecret(),
      );
      await postForm(app, t);
      const r2 = await postForm(app, t);
      expect(r2.statusCode).toBe(200);
      expect(r2.body.toLowerCase()).toContain('already trusted');
      expect(r2.body).toContain('0 message');

      const rules = db
        .prepare(
          "SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = 'address' AND pattern = ?",
        )
        .all(id, 'sales@acme.com');
      expect(rules).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('renders expired page for invalid token, makes no DB changes', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await postForm(app, 'not-a-real-token');
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('expired or invalid');
      const rules = db.prepare('SELECT id FROM whitelist_rules WHERE mailbox_id = ?').all(id);
      expect(rules).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('returns 400 if body is missing the token', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({
        method: 'POST',
        url: '/public/digest/allow',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: '',
      });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 11.3: Run; expect FAIL**

- [ ] **Step 11.4: Add the POST route to `server/src/api.ts`**

Immediately after the GET route added in Task 10, add:
```ts
  app.post('/public/digest/allow', async (req, reply) => {
    const { renderSuccessPage, renderExpiredPage } = await import('./digest-pages.js');
    const { verify } = await import('./digest-token.js');
    const { loadDigestSigningSecret } = await import('./config.js');

    const body = (req.body ?? {}) as { t?: string };
    const t = body.t ?? '';
    if (!t) return reply.code(400).send({ error: 'missing token' });

    const payload = verify(t, loadDigestSigningSecret(), Date.now());
    if (!payload) {
      reply.type('text/html');
      return renderExpiredPage();
    }
    const mb = db
      .prepare('SELECT id FROM mailboxes WHERE id = ?')
      .get(payload.mailboxId) as { id: number } | undefined;
    if (!mb) {
      reply.type('text/html');
      return renderExpiredPage();
    }

    const sender = payload.sender.toLowerCase();
    const ruleExists = db
      .prepare(
        'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
      )
      .get(payload.mailboxId, 'address', sender) as { id: number } | undefined;
    let alreadyTrusted = Boolean(ruleExists);

    let movedIds: string[] = [];
    runInTx(() => {
      if (!ruleExists) {
        db.prepare(
          'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
        ).run(payload.mailboxId, 'address', sender, 'digest:allow-forever', Date.now());
      }
      const toMove = db
        .prepare(
          "SELECT id FROM messages WHERE mailbox_id = ? AND folder = 'quarantine' AND from_address = ?",
        )
        .all(payload.mailboxId, sender) as { id: string }[];
      movedIds = toMove.map((x) => x.id);
      if (movedIds.length) {
        db.prepare(
          `UPDATE messages SET folder = 'inbox', expires_at = NULL
            WHERE mailbox_id = ? AND folder = 'quarantine' AND from_address = ?`,
        ).run(payload.mailboxId, sender);
      }
    });

    if (!alreadyTrusted) {
      bus.publish({ type: 'whitelist:changed', mailboxId: payload.mailboxId });
    }
    for (const mid of movedIds) {
      bus.publish({ type: 'message:updated', mailboxId: payload.mailboxId, messageId: mid });
    }

    reply.type('text/html');
    return renderSuccessPage({
      sender: payload.sender,
      movedCount: movedIds.length,
      alreadyTrusted,
      webmailUrl: config.publicBaseUrl,
    });
  });
```

- [ ] **Step 11.5: Run; expect PASS**

```bash
npm test --workspace=server
```

- [ ] **Step 11.6: Commit**

```bash
git add server/src/api.ts server/test/digest-routes-post.test.ts
git commit -m "feat(digest): POST /public/digest/allow performs idempotent trust action"
```

---

## Task 12: Web UI — per-mailbox digest settings

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`
- Modify: `web/src/components/MailboxManager.tsx`

- [ ] **Step 12.1: Extend the `Mailbox` type in `web/src/types.ts`**

Open `web/src/types.ts`, find the `Mailbox` type (or wherever it's defined; if not in types.ts, search `interface Mailbox` or `type Mailbox`). Add the new fields:

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
};
```
(If the existing type didn't include some of the older fields, leave them as-is — the new properties just need to be added.)

- [ ] **Step 12.2: Extend `patchMailbox` in `web/src/api.ts`**

Find the `patchMailbox` definition and replace with:
```ts
  patchMailbox: (
    id: number,
    b: {
      displayName?: string | null;
      quarantineTtlHours?: number;
      digestEnabled?: boolean;
      digestHour?: number;
      digestRecipientMode?: 'external' | 'loopback';
      ownerEmail?: string | null;
    },
  ) => j<{ ok: true }>(`/api/mailboxes/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
```

- [ ] **Step 12.3: Add a digest settings expander to `MailboxManager.tsx`**

Replace the file contents of `web/src/components/MailboxManager.tsx` with:
```tsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Mailbox } from '../types';
import { X, Plus, Trash2, ChevronDown, ChevronUp, Mail } from 'lucide-react';

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

export default function MailboxManager({ onClose, onChanged }: Props) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [address, setAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ttl, setTtl] = useState(168);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = () => api.mailboxes().then(setMailboxes);
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setError(null);
    if (!address.trim()) return;
    try {
      await api.createMailbox({
        address: address.trim().toLowerCase(),
        displayName: displayName.trim() || undefined,
        quarantineTtlHours: ttl,
      });
      setAddress('');
      setDisplayName('');
      setTtl(168);
      load();
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? 'failed');
    }
  };

  const updateTtl = async (m: Mailbox, hours: number) => {
    if (hours === m.quarantine_ttl_hours) return;
    await api.patchMailbox(m.id, { quarantineTtlHours: hours });
    load();
  };

  const remove = async (m: Mailbox) => {
    if (!confirm(`Delete mailbox ${m.address} and ALL its mail?`)) return;
    await api.deleteMailbox(m.id);
    load();
    onChanged();
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveDigest = async (
    m: Mailbox,
    fields: {
      digestEnabled?: boolean;
      digestHour?: number;
      digestRecipientMode?: 'external' | 'loopback';
      ownerEmail?: string | null;
    },
  ) => {
    try {
      await api.patchMailbox(m.id, fields);
      load();
    } catch (e: any) {
      alert(e?.message ?? 'save failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center">
          <div className="font-medium">Mailboxes</div>
          <div className="text-xs text-zsmuted ml-3">
            Each mailbox accepts mail at its full address. Quarantine TTL controls when non-whitelisted mail expires.
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-zsborder grid grid-cols-12 gap-2">
          <input
            className="col-span-5 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
            placeholder="alice@yourdomain.co"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="col-span-3 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
            placeholder="display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <div className="col-span-3 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={8760}
              className="flex-1 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value) || 168)}
            />
            <span className="text-xs text-zsmuted">h TTL</span>
          </div>
          <button
            onClick={create}
            className="col-span-1 bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 inline-flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
          {error && <div className="col-span-12 text-xs text-zsdanger">{error}</div>}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {mailboxes.map((m) => {
            const isOpen = expanded.has(m.id);
            return (
              <li key={m.id} className="border-b border-zsborder/60">
                <div className="px-4 py-2 flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(m.id)}
                    className="p-1 rounded hover:bg-zsborder/40"
                    title="Digest settings"
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.address}</div>
                    <div className="text-xs text-zsmuted">{m.display_name ?? '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.digest_enabled === 1 && (
                      <span className="text-xs text-zsaccent inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> digest @ {String(m.digest_hour).padStart(2, '0')}:00
                      </span>
                    )}
                    <input
                      type="number"
                      defaultValue={m.quarantine_ttl_hours}
                      min={1}
                      max={8760}
                      onBlur={(e) => updateTtl(m, Number(e.target.value) || m.quarantine_ttl_hours)}
                      className="w-20 bg-zsbg border border-zsborder rounded px-2 py-1 text-sm text-right"
                    />
                    <span className="text-xs text-zsmuted">h</span>
                  </div>
                  <button
                    onClick={() => remove(m)}
                    className="p-1.5 rounded hover:bg-zsdanger/20 text-zsdanger"
                    title="Delete mailbox + all mail"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {isOpen && <DigestSettings mailbox={m} onSave={(f) => saveDigest(m, f)} />}
              </li>
            );
          })}
          {mailboxes.length === 0 && <li className="p-6 text-sm text-zsmuted">No mailboxes yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function DigestSettings({
  mailbox,
  onSave,
}: {
  mailbox: Mailbox;
  onSave: (fields: {
    digestEnabled?: boolean;
    digestHour?: number;
    digestRecipientMode?: 'external' | 'loopback';
    ownerEmail?: string | null;
  }) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(mailbox.digest_enabled === 1);
  const [hour, setHour] = useState(mailbox.digest_hour);
  const [mode, setMode] = useState<'external' | 'loopback'>(mailbox.digest_recipient_mode);
  const [ownerEmail, setOwnerEmail] = useState(mailbox.owner_email ?? '');

  const save = async () => {
    await onSave({
      digestEnabled: enabled,
      digestHour: hour,
      digestRecipientMode: mode,
      ownerEmail: mode === 'external' ? ownerEmail.trim() || null : ownerEmail.trim() || null,
    });
  };

  return (
    <div className="px-4 pb-4 pt-1 bg-zsbg/30 border-t border-zsborder/40 grid grid-cols-12 gap-3 text-sm">
      <label className="col-span-12 inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Email me a daily digest of quarantined senders</span>
      </label>

      <label className="col-span-6 flex items-center gap-2">
        <span className="text-xs text-zsmuted">Time of day:</span>
        <select
          className="bg-zsbg border border-zsborder rounded px-2 py-1 text-sm"
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          disabled={!enabled}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>
              {String(i).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>

      <fieldset className="col-span-12 grid grid-cols-12 gap-2">
        <legend className="col-span-12 text-xs text-zsmuted">Send digest to:</legend>
        <label className="col-span-12 inline-flex items-center gap-2">
          <input
            type="radio"
            name={`mode-${mailbox.id}`}
            checked={mode === 'external'}
            onChange={() => setMode('external')}
            disabled={!enabled}
          />
          <span>An external inbox</span>
          <input
            type="email"
            className="flex-1 bg-zsbg border border-zsborder rounded px-2 py-1 text-sm"
            placeholder="alice@gmail.com"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            disabled={!enabled || mode !== 'external'}
          />
        </label>
        <label className="col-span-12 inline-flex items-center gap-2">
          <input
            type="radio"
            name={`mode-${mailbox.id}`}
            checked={mode === 'loopback'}
            onChange={() => setMode('loopback')}
            disabled={!enabled}
          />
          <span>This mailbox itself (loopback — appears in your ZeroSpam inbox)</span>
        </label>
      </fieldset>

      <div className="col-span-12 flex items-center justify-between">
        {mailbox.digest_last_error ? (
          <span className="text-xs text-zsdanger truncate" title={mailbox.digest_last_error}>
            last error: {mailbox.digest_last_error}
          </span>
        ) : (
          <span className="text-xs text-zsmuted">
            {mailbox.last_digest_sent_at
              ? `last sent: ${new Date(mailbox.last_digest_sent_at).toLocaleString()}`
              : 'no digest sent yet'}
          </span>
        )}
        <button
          onClick={save}
          className="bg-zsaccent text-zsbg rounded px-3 py-1 text-sm font-medium hover:opacity-90"
        >
          Save digest settings
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 12.4: Verify the web build**

Run:
```bash
npm run build --workspace=web
```
Expected: clean Vite build, no TS errors.

- [ ] **Step 12.5: Smoke-test manually**

Run the dev stack:
```bash
npm run dev
```
Then in a browser at the webmail URL:
1. Open Mailboxes panel.
2. Click the chevron to expand a mailbox.
3. Toggle "Email me a daily digest", set hour, pick external + an email, click "Save digest settings".
4. Refresh — settings should persist.
5. Switch a different mailbox to loopback mode + save — verify in webmail's whitelist panel that a `digest-system@<domain>` rule appears.

- [ ] **Step 12.6: Commit**

```bash
git add web/src/types.ts web/src/api.ts web/src/components/MailboxManager.tsx
git commit -m "feat(digest): per-mailbox digest settings expander in MailboxManager"
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
Expected: server and web both build cleanly.

- [ ] **Step F.3: End-to-end manual smoke**

With both servers running (`npm run dev`):
1. Create a mailbox `bob@yourdomain.test` via the UI.
2. Inject 3 quarantined messages from 2 different senders via the test injector.
3. Set the digest settings: enabled, recipient = loopback, hour = current hour - 1 (so it's already past).
4. Save. Within ~60s, the digester tick should send a digest to bob's own inbox folder.
5. Open the digest in webmail (it's now visible like a normal inbox message). Click the "Allow forever" link for one sender.
6. The browser opens the confirm page on `/public/digest/allow`. Click Confirm.
7. Verify: success page shows N messages moved; whitelist panel shows the new rule; messages from that sender now in inbox.

- [ ] **Step F.4: Final commit (if anything trailing)**

If anything was tweaked during the smoke test:
```bash
git add <files>
git commit -m "chore: smoke-test fixes"
```

---

## Self-Review Notes

The plan was checked against each section of the spec:

| Spec section | Covered by |
|---|---|
| §4 Architecture | Tasks 4–11 |
| §5.1 Schema | Task 3 |
| §5.2 Types | Tasks 1, 2 (DigestTokenPayload, DigestContent, DigestSenderRow) |
| §5.3 Configuration | Task 3 |
| §6.1 Tick loop | Task 7 |
| §6.2 12h guard | Task 7 |
| §6.3 First-digest backlog | Task 4 |
| §7 Email composition | Task 2 |
| §7.4 Loopback bootstrap | Tasks 6 + 9 (on enable transition) |
| §8 Public action routes | Tasks 10, 11 |
| §9 API changes | Task 9 |
| §10 UI changes | Task 12 |
| §11 Edge cases | Tests in Tasks 4, 7, 9, 10, 11 |
| §12 Testing | Tasks 0–11 (vitest infra + per-feature tests) |
| §13 Extensibility | Tasks 1, 4 (token version field, named allowToken, action field, namespace prefix) |

No placeholders, no "TBD"s, every step has actual code.
