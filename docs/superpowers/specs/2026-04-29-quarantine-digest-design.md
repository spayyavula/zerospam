# Quarantine Digest with One-Tap Sender Trust — Design Spec

**Date:** 2026-04-29
**Status:** Draft — pending implementation
**Scope:** Feature 1 of 3 in the "user-appealing features" track. Features 2 (auto-allow guardrails) and 3 (trust-graph import) are explicitly deferred to separate spec → plan → build cycles.

---

## 1. Overview

A scheduled job composes a per-mailbox HTML digest of quarantined senders and emails it to the user's external inbox (or, optionally, into the mailbox itself via loopback). Each sender row contains an HMAC-signed link that opens a confirmation page; one click whitelists the sender and releases all of their currently-quarantined messages.

This is the keystone of the whitelist-first inbox UX: it converts the anxiety of "what's stuck in quarantine?" into a single per-day triage interaction the user can perform from inside whatever inbox they already live in.

## 2. Goals

- Daily digest of senders quarantined since the previous digest, sent to a user-chosen recipient.
- Single-click "Allow forever" per sender, with a CSRF-safe confirmation page.
- Idempotent action: duplicate clicks, or pre-fetcher-fired GETs, produce the same end state.
- No new auth model, no new background-job framework, no new mail-sending dependency.
- Cheap extension seams for future actions (allow-once, block-forever) without refactoring the v1 surface.

## 3. Non-Goals

- "Allow once" / "Block forever" / "Mute" actions (deferred to v2).
- Per-message tokens — current scope is per-sender only.
- Configurable cadence beyond daily — hourly/weekly deferred.
- Per-tenant key management or auth on the digest API.
- Replacing trust-on-send (already exists in `sender.ts`).
- Building a UI mockup tool. Settings panel follows existing webmail patterns.

## 4. Architecture

### 4.1 One-line summary

A new `digester.ts` module ticks every minute, finds mailboxes due for a digest at their configured local hour, assembles a content object, sends via the existing `sender.sendMessage()` (or via `ingest()` for loopback), and embeds HMAC-signed action URLs that point at new public Fastify routes mounted under `/public/digest/*`.

### 4.2 Components

| Module | Responsibility | Status |
|---|---|---|
| `server/src/digester.ts` | Scheduler tick, content assembly, dispatch | New |
| `server/src/digest-token.ts` | HMAC sign/verify (pure) | New |
| `server/src/digest-template.ts` | HTML & plaintext rendering (pure) | New |
| `server/src/api.ts` | Adds `/public/digest/*` routes; extends `PATCH /api/mailboxes/:id` | Modified |
| `server/src/db.ts` | New columns on `mailboxes` (idempotent ALTERs) | Modified |
| `server/src/config.ts` | New env vars: `PUBLIC_BASE_URL`, `DIGEST_SIGNING_SECRET`, `DIGEST_TICK_INTERVAL_SEC` | Modified |
| `server/src/index.ts` | Boots the digester alongside the sweeper | Modified |
| `web/` settings panel | Mailbox-level digest configuration UI | Modified |

### 4.3 Component diagram

```
┌─────────────────────────────┐
│  setInterval in digester.ts │
└──────────────┬──────────────┘
               │  every DIGEST_TICK_INTERVAL_SEC
               ▼
┌─────────────────────────────────────┐
│ Find mailboxes due for digest:      │
│   digest_enabled=1                  │
│   AND now > today's digest_hour     │
│   AND last_digest_sent_at < window  │
└──────────────┬──────────────────────┘
               │  for each
               ▼
┌─────────────────────────────────────┐
│ assembleDigest(mailboxId)           │
│  - SELECT messages quarantined      │
│    since last_digest_sent_at        │
│  - group by from_address            │
│  - cap 30, sort by latest received  │
│  - sign one allow-token per sender  │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       │ empty?         │ non-empty
       ▼                ▼
   skip,          renderHtml/renderText
   bump           ↓
   last_digest    sendDigest(content)
                    ↓
       ┌──────────┴─────────────┐
       │ mode='external'        │ mode='loopback'
       ▼                        ▼
   sender.sendMessage()    compose RFC822 + ingest()
                          (delivers to mailbox's
                           own inbox folder)
       │
       │   user opens email in (e.g.) Gmail
       │   clicks "Allow forever" link
       ▼
   GET /public/digest/allow?t=<token>  → confirm page
       │ user clicks Confirm
       ▼
   POST /public/digest/allow
       │ verify token, transactional:
       │   INSERT OR IGNORE whitelist rule
       │   UPDATE messages folder='inbox'
       ▼
   render success page; bus.publish events
```

### 4.4 Reuse principles

- `sender.sendMessage()` handles DKIM signing, "Sent" archival, and trust-on-send. Used as-is for `mode='external'`.
- `ingest()` handles RFC 822 parsing, FTS indexing, attachments, and routing. Used as-is for `mode='loopback'` with a synthesized message buffer (same path the test injector uses).
- Migration block in `db.ts` handles idempotent column adds.
- `bus.publish()` already drives SSE updates in webmail; reused for live updates when a digest action moves messages.

## 5. Data Model

### 5.1 Schema additions

All idempotent `ALTER TABLE` statements added to the migration block in `db.ts`:

```sql
ALTER TABLE mailboxes ADD COLUMN digest_enabled              INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mailboxes ADD COLUMN digest_hour                 INTEGER NOT NULL DEFAULT 8;
ALTER TABLE mailboxes ADD COLUMN digest_recipient_mode       TEXT    NOT NULL DEFAULT 'external';
ALTER TABLE mailboxes ADD COLUMN owner_email                 TEXT;
ALTER TABLE mailboxes ADD COLUMN last_digest_sent_at         INTEGER;
ALTER TABLE mailboxes ADD COLUMN digest_last_error           TEXT;
ALTER TABLE mailboxes ADD COLUMN digest_consecutive_failures INTEGER NOT NULL DEFAULT 0;
```

Application-level CHECK on `digest_recipient_mode` (must be `'external'` or `'loopback'`) is enforced in zod schemas and at insert/update time. Existing mailboxes are unaffected until digest is explicitly enabled. No new tables.

### 5.2 TypeScript types

```ts
type DigestSenderRow = {
  fromAddress: string;
  fromName: string | null;
  messageCount: number;
  latestSubject: string | null;
  latestReceivedAt: number;
  allowToken: string;            // signed; deliberately named for extensibility
};

type DigestContent = {
  mailboxId: number;
  mailboxAddress: string;
  rows: DigestSenderRow[];       // capped at 30
  totalSendersInQuarantine: number;
  windowStart: number;           // last_digest_sent_at, 0 if first send
};

type DigestTokenPayload = {
  v: 1;                          // version field for future evolution
  mailboxId: number;
  sender: string;                // lowercase email
  action: 'allow-forever';       // single value today; reserve for future
  exp: number;                   // unix ms
};
```

### 5.3 Configuration

| Env var | Default | Required when |
|---|---|---|
| `PUBLIC_BASE_URL` | _(none — required when any mailbox has `digest_enabled = 1`; boot fails fast in that case)_ | Always, when feature is in use |
| `DIGEST_SIGNING_SECRET` | auto-generated (32 random bytes, base64url-encoded) to `data/.digest-secret` on first boot | Always |
| `DIGEST_TICK_INTERVAL_SEC` | 60 | Always |

## 6. Scheduling

### 6.1 Tick loop

`digester.ts` runs `setInterval` every `DIGEST_TICK_INTERVAL_SEC`. Each tick:

```sql
SELECT id FROM mailboxes
 WHERE digest_enabled = 1
   AND <now() > today's digest_hour boundary in server-local time>
   AND ( last_digest_sent_at IS NULL
         OR last_digest_sent_at < <today's digest_hour boundary>);
```

For each due mailbox:

1. `assembleDigest(mailboxId)`.
2. Empty result (no senders since `last_digest_sent_at`): skip render+send, but still set `last_digest_sent_at = now()` so we don't re-check until tomorrow.
3. Non-empty: render, send, set `last_digest_sent_at = now()`, reset `digest_consecutive_failures = 0`, clear `digest_last_error`.
4. Send failure: log, store `digest_last_error`, increment `digest_consecutive_failures`. If failures ≥ 7, auto-disable (`digest_enabled = 0`) and log a warning.

### 6.2 Anti-double-send guard

In addition to the SQL conditions, the tick enforces `now() - last_digest_sent_at >= 12h` before sending. Skipped when `last_digest_sent_at IS NULL` (first send). Protects against same-day double-sends if the user changes `digest_hour` mid-day.

### 6.3 First-digest backlog handling

When `last_digest_sent_at IS NULL`, the assembly query selects all currently-quarantined messages (not just "since 0"). The 30-sender cap protects from a flood; the "+N more" footer makes the omission visible.

## 7. Email Composition

### 7.1 Pure rendering functions

`digest-template.ts` exports:

```ts
function renderHtml(content: DigestContent, baseUrl: string): string;
function renderText(content: DigestContent, baseUrl: string): string;
```

Constraints:

- Inline CSS only. Table-based layout for client compatibility.
- HTML-escape sender names, addresses, subjects.
- `multipart/alternative` mandatory: every digest carries both text and HTML.
- No images, no tracking pixels, no external resources. Consistent with the product's anti-tracker stance.
- Each "Allow forever" button is a styled `<a href="{baseUrl}/public/digest/allow?t={token}">`.

### 7.2 Subject and From

- Subject: `ZeroSpam quarantine digest — {N} senders waiting`.
- From envelope: `ZeroSpam Digest <digest-system@{mailbox-domain}>`. Signed with the mailbox's existing DKIM keys via `sender.sendMessage()`.

### 7.3 Trust-on-send interaction

`sender.sendMessage()` auto-whitelists every recipient on the sending mailbox. For digest emails:

- External mode: whitelists `owner_email` on the mailbox — desired.
- Loopback mode: whitelists the mailbox's own address — harmless.
- The synthetic envelope-from `digest-system@<domain>` will additionally appear as a recipient when sent — also harmless.

No carve-out is needed in v1.

### 7.4 Loopback bootstrap

When a mailbox transitions to `digest_enabled = 1 AND digest_recipient_mode = 'loopback'`, idempotently insert a whitelist rule `(mailboxId, kind='address', pattern='digest-system@<domain>', note='self:digest')`. Without this, the digest itself would land in quarantine. Inserting only on the loopback transition (not on every mailbox creation) avoids stale rules on mailboxes that never opt into loopback.

## 8. Public Action Routes

### 8.1 Token format

`digest-token.ts`:

```ts
sign(payload: DigestTokenPayload, secret: string): string;
verify(token: string, secret: string, now: number): DigestTokenPayload | null;
```

Wire format: `<base64url(JSON payload)>.<base64url(HMAC-SHA256(secret, payload))>`. The MAC is the full 32-byte SHA-256 output; no truncation.

`verify()` rejects:

- Missing `.` separator
- Non-base64url segments
- JSON parse failure
- Signature mismatch (constant-time comparison)
- `payload.v !== 1`
- `payload.exp < now`

JWT is deliberately avoided to sidestep `alg` confusion footguns.

### 8.2 Routes

Mounted on the existing Fastify app under `/public/digest/`. No CORS gate, no auth, no rate limit in v1 (per-IP limiter is a flagged follow-up if abuse appears).

#### `GET /public/digest/allow?t=<token>` — confirm page

1. `verify(t)`. On failure, render generic "expired or invalid" page (HTTP 200, opaque to attackers).
2. Look up mailbox by `payload.mailboxId`. If gone, same generic page.
3. Count quarantined messages from `payload.sender` for this mailbox right now.
4. Render server-side HTML page styled to match the digest email's brand (so the user doesn't feel they've landed on a phishing page), with mobile-friendly viewport meta: sender, count, list of effects ("add whitelist rule", "release N messages", "future messages skip quarantine"), a Confirm `<form method="POST" action="/public/digest/allow">` with the token in a hidden input, and a Cancel link.

#### `POST /public/digest/allow` — performs action

Form-urlencoded body `t=<token>`.

1. Verify token (same as GET).
2. Look up mailbox.
3. In one transaction:
   - `INSERT OR IGNORE` whitelist rule `(mailboxId, kind='address', pattern=sender, note='digest:allow-forever', created_at=now)`.
   - `UPDATE messages SET folder='inbox', expires_at=NULL WHERE mailbox_id=? AND folder='quarantine' AND from_address=?`. Capture affected count.
4. After commit: `bus.publish('whitelist:changed', mailboxId)` and one `message:updated` per affected message.
5. Render success page: "{sender} is now trusted. {N} message(s) moved to your inbox." plus a link to webmail.

### 8.3 Idempotency model

- Operations are naturally idempotent: insert ignores duplicates; update on already-inbox messages is a no-op.
- Reused tokens within TTL: success page renders with affected count of 0.
- Pre-fetcher GET: rendering only; never mutates state.
- Forwarded digest: tokens scoped to mailboxId+sender, TTL-bound. Risk accepted for v1.

### 8.4 Reserved namespace

All future digest-related public routes live under `/public/digest/*`. Future actions ("allow-once", "block", "mute"), "unsubscribe", and "view-in-browser" get sibling paths. No generic dispatcher in v1 — each action gets a route.

## 9. API Changes

### 9.1 `PATCH /api/mailboxes/:id` — extended

Schema gains optional fields:

```ts
{
  digestEnabled?: boolean;
  digestHour?: number;             // 0..23
  digestRecipientMode?: 'external' | 'loopback';
  ownerEmail?: string | null;      // email string when present
}
```

Server-side validation: if the patch results in `digest_enabled = 1 AND digest_recipient_mode = 'external'`, then `owner_email` must be a non-null valid email. Reject with HTTP 400 otherwise.

### 9.2 Deferred for v1

- `POST /api/mailboxes/:id/digest/preview`
- `POST /api/mailboxes/:id/digest/send-now`

Both are easy to add later because `digester.assembleDigest()` and `digester.sendDigest()` are exported public functions of the module.

## 10. UI Changes (web/)

The existing webmail mailbox-settings panel (wherever `displayName` and `quarantineTtlHours` are edited) gains a "Quarantine digest" section:

- Checkbox: "Email me a daily digest of quarantined senders"
- Hour-of-day select (0–23, displayed as `HH:00`)
- Recipient-mode radio: "An external inbox" / "This mailbox itself (loopback)"
- Email input (visible and required only when external mode is selected)

Implementation follows whatever React/Tailwind conventions already exist in `web/`. No new dependency.

## 11. Edge Cases

| Scenario | Behavior |
|---|---|
| Mailbox deleted mid-tick | `assembleDigest` returns null; tick skips. |
| `owner_email` invalid (typo, account dead) | `sender.sendMessage` throws; record `digest_last_error`, increment failure count, retry tomorrow. After 7 consecutive failures, auto-disable digest. |
| `PUBLIC_BASE_URL` unset but a mailbox has digest enabled | Boot fails fast with a clear error. |
| `DIGEST_SIGNING_SECRET` missing | Auto-generate to `data/.digest-secret` on first boot. Log creation. |
| User toggles `digest_enabled = false` mid-flight | In-flight send completes; no future sends. |
| Same digest forwarded; recipient clicks link | Token is mailbox+sender-scoped, TTL-bound, idempotent. Risk accepted for v1. |
| Quarantine messages swept by TTL between assembly and click | Confirm page shows "0 quarantined message(s)", but POST still adds the trust rule going forward. |
| Reverse proxy strips POST body | 400 with "Missing token". |
| User clicks the same link twice | Idempotent: success page renders with affected count = 0 second time. |
| Server clock jumps backward | Tokens issued in the "future" still verify until they actually expire; no false invalidation. |
| `digest_hour` changed after today's digest already sent | 12h anti-double-send guard prevents same-day re-send. |
| Server downtime through `digest_hour` | On boot, tick fires within `DIGEST_TICK_INTERVAL_SEC`, detects overdue, sends slightly-late digest. |

## 12. Testing

### 12.1 Unit (no I/O)

- `digest-token.ts`:
  - sign/verify round-trip
  - tampered signature rejected
  - expired token rejected
  - malformed input rejected
  - `v != 1` rejected
- `digest-template.ts`:
  - snapshot test for HTML and plaintext output
  - HTML special-character escaping in subjects, names, addresses
  - "+N more" footer renders when total senders > 30

### 12.2 Integration (against `tsx`/inject pattern)

- Inject 5 quarantined messages from 3 senders into a mailbox, manually invoke a digester tick, assert: a sent message exists, contains all 3 senders, has 3 valid action tokens.
- POST a valid token to `/public/digest/allow`: whitelist rule added, all sender's quarantined messages moved to inbox, SSE events fired.
- POST same token again: idempotent — no duplicate rule, 0 messages moved, success page still renders.
- POST tampered / expired / wrong-version token: generic 200 expired page, no DB changes.
- Empty digest path: tick skips send, `last_digest_sent_at` still updated.
- Backlog first send: cap at 30, footer shows "+N more".

### 12.3 Manual smoke

- Loopback mode end-to-end (mailbox sends digest to itself; verify it lands in inbox folder, not quarantine).
- Render 30+-sender digest to verify cap and footer.
- Confirm page on mobile viewport.
- 7-failure auto-disable path.

## 13. Extensibility Decisions

### 13.1 Baked into v1 (cheap seams)

- Token payload has `v: 1` version field. Verifier rejects unknown versions cleanly so future format changes have a known breakage point.
- Token payload has `action: 'allow-forever'` field even though only one value exists. Future actions add new payload values + new sibling routes without touching v1's verifier.
- `DigestSenderRow.allowToken` is named explicitly (not `actionToken`). Forces future code to add new named fields rather than overloading one.
- `/public/digest/*` namespace is reserved and documented for future digest-related public routes.
- `digester.assembleDigest()` and `digester.sendDigest()` are exported from the module so future API endpoints can call them without refactor.

### 13.2 Explicitly deferred (would be premature abstraction)

- Plugin / strategy pattern for action types — only one action exists; abstraction has no anchor.
- Cadence enum (hourly / weekly) — only daily exists; ALTER TABLE later is ~3 lines.
- Action-descriptor array on rows — adds row-builder complexity for zero current benefit.
- Template-theming hooks beyond the existing pure-function module boundary.
- Recipient-mode strategy registry — two `if` branches is not a registry.

### 13.3 Principle

Add cheap extension *seams* (version fields, namespaces, named-not-overloaded fields) but no abstract machinery.

## 14. Implementation File-by-File Sketch

| File | LOC estimate | Risk |
|---|---|---|
| `server/src/digest-token.ts` | ~80 | Low (pure, well-tested) |
| `server/src/digest-template.ts` | ~150 | Low (pure, snapshot-tested) |
| `server/src/digester.ts` | ~250 | Medium (timing + error handling) |
| `server/src/api.ts` additions | ~120 | Medium (HTML rendering inline; CSP-conscious) |
| `server/src/db.ts` migration block | ~20 | Low (idempotent ALTERs) |
| `server/src/config.ts` | ~30 | Low |
| `server/src/index.ts` | ~3 | Low |
| `web/` settings panel | ~150 | Low (follow existing patterns) |

Estimated total: **~800 LOC**. Single PR is feasible but the implementation plan should split into milestones: token + template → migration + assembly → routes → scheduler boot → UI → tests.

## 15. Open Questions (none blocking)

None at design-approval time. Future iterations may revisit:

- Whether to add a per-IP rate limiter on `/public/digest/*` if abuse appears.
- Whether `/preview` and `/send-now` API endpoints should be added.
- When/whether to harden the admin `/api/*` to localhost-only via middleware (independent task; not part of this spec).
