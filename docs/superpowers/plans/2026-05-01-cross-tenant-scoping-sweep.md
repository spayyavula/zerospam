# Plan A.5 — Cross-Tenant Scoping Sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Close the cross-tenant authorization gap on the ~25 routes flagged by the Plan A security review. Every route taking a mailbox/message/draft/alias/attachment ID must verify ownership against `req.account.id` before reading or mutating the underlying row.

**Architecture:** Reuse the established `ownsMailbox(accountId, mailboxId)` helper from `server/src/api.ts`. For routes addressing rows by indirect ID (message, attachment, draft, alias, whitelist rule), add a JOIN-through-mailbox SELECT that returns null when the row's `mailbox_id` doesn't belong to the caller's account. Tests live in `server/test/account-scoping.test.ts` (extend existing) and a new `server/test/account-scoping-mutations.test.ts` for write paths.

**Tech Stack:** TypeScript, Fastify, better-sqlite3, vitest.

**Pattern (canonical):**
```ts
const accountId = req.account?.id;
if (!accountId) return reply.code(401).send({ error: 'unauthorized' });

// Direct mailbox-id route:
if (!ownsMailbox(accountId, mailboxId)) return reply.code(404).send({ error: 'not found' });

// Indirect (message-id, draft-id, attachment-id, alias-id, whitelist-id):
const row = db.prepare(`
  SELECT m.* FROM <table> m
  JOIN mailboxes b ON b.id = m.mailbox_id
  WHERE m.id = ? AND b.account_id = ?
`).get(id, accountId);
if (!row) return reply.code(404).send({ error: 'not found' });
```

**Threat priority:** destructive cross-tenant > impersonation > read-leak > metadata-leak > existence oracle.

---

## Task 1: Destructive mailbox routes (C1, C3)

**Routes:** `PATCH /api/mailboxes/:id`, `DELETE /api/mailboxes/:id`, `POST /api/quarantine/:mailboxId/purge`

**Tests** (extend `server/test/account-scoping.test.ts`):
- Account-A cookie cannot PATCH account-B's mailbox → 404; row unchanged.
- Account-A cookie cannot DELETE account-B's mailbox → 404; row + raw files preserved.
- Account-A cookie cannot purge account-B's quarantine → 404; quarantined messages still present.

**Implementation:** Add `ownsMailbox` guard at the top of each handler. For PATCH, also strip `account_id` from any body fields if Zod accepts it.

**Commit:** `feat(security): scope PATCH/DELETE mailbox + purge by account_id`

---

## Task 2: Impersonation routes (C2)

**Routes:** `POST /api/send`, `POST /api/drafts/:id/send`

**Tests:**
- Account-A cookie cannot POST /api/send with account-B's mailboxId → 404; no message in account-B's sent folder; sendMessage spy not called.
- Account-A cookie cannot send account-B's draft → 404.

**Implementation:**
- `/api/send`: parse body, then `ownsMailbox(accountId, body.mailboxId)` before `sendMessage`.
- `/api/drafts/:id/send`: JOIN-through-mailbox SELECT; reject 404 if not owned.

**Commit:** `feat(security): scope send + draft-send by account_id`

---

## Task 3: Message routes (H1)

**Routes:** `GET /api/messages/:id`, `GET /api/messages/:id/trackers`, `GET /api/messages/:id/attachments`, `GET /api/attachments/:id/download`, `POST /api/messages/:id/read`, `POST /api/messages/:id/star`, `POST /api/messages/:id/move`, `DELETE /api/messages/:id`, `POST /api/messages/bulk`, `POST /api/messages/:id/trust-sender`, `GET /api/messages/:id/reply`

**Tests:** parametrized — for each endpoint, account-A cannot access account-B's message-id → 404. For `attachments/:id/download` use integer-id enumeration to prove the harder case. For `bulk`, mix owned + unowned IDs and assert only owned are mutated.

**Helper:** Add a private `ownsMessage(accountId, messageId)` helper that does the JOIN-through-mailbox lookup. Returns the row or null. Most handlers can use the row directly.

**Commit:** `feat(security): scope all message-id routes by account_id`

---

## Task 4: Search (H2) + whitelist mutations (H5)

**Routes:** `GET /api/search`, `POST /api/whitelist`, `DELETE /api/whitelist/:id`, `POST /api/messages/bulk` action `trust-sender`

**Tests:**
- Cross-account search returns 404.
- Cross-account whitelist insert/delete returns 404.

**Implementation:**
- Search: `ownsMailbox` after parsing `mailboxId`.
- POST /api/whitelist: validate `r.mailboxId` ownership.
- DELETE /api/whitelist/:id: JOIN-through-mailbox.
- bulk trust-sender: enforce already-scoped message check.

**Commit:** `feat(security): scope search + whitelist mutations by account_id`

---

## Task 5: Drafts (H3)

**Routes:** `GET /api/drafts`, `GET /api/drafts/:id`, `POST /api/drafts`, `PATCH /api/drafts/:id`, `DELETE /api/drafts/:id`

**Tests:** account-A cannot list, read, mutate, or delete account-B's drafts.

**Implementation:** JOIN-through-mailbox for SELECT/UPDATE/DELETE; for POST, `ownsMailbox(accountId, body.mailboxId)`.

**Commit:** `feat(security): scope draft routes by account_id`

---

## Task 6: Aliases (H4)

**Routes:** `GET /api/aliases`, `POST /api/aliases`, `POST /api/aliases/:id/abuse`, `POST /api/aliases/:id/restore`, `DELETE /api/aliases/:id`

**Tests:** cross-account alias CRUD returns 404. Bonus: cross-domain alias creation rejected (account-A cannot create alias under account-B's domain).

**Implementation:** JOIN-through-mailbox; for POST, also validate domain ownership.

**Commit:** `feat(security): scope alias routes by account_id + domain`

---

## Task 7: Login email-not-verified existence oracle (H6)

**Routes:** `POST /api/auth/login`

**Issue:** Returning `403 email not verified` discloses email existence. Two acceptable fixes — pick the one matching ZeroSpam's UX preference:

**Option A (less leakage, requires email):** Return `401` for email-not-verified, send a verification-resend email transparently if address matches a known unverified user. Aligns with login's existing "unknown-email returns generic 401" pattern.

**Option B (keep current UX, document):** Leave 403, but log the trade-off in a code comment and the threat model.

Default to **Option A** unless user pushes back.

**Tests:** existing login tests still green; new test: unverified login returns 401 (not 403); verification-resend email sent to known address.

**Commit:** `refactor(security): generic 401 for unverified login + verification-resend email`

---

## Task 8: Hardening (M1, M4, M5)

**Files:**
- `server/src/db.ts` — assert `PRAGMA foreign_keys` returns 1 after enabling
- `server/src/config.ts` — remove `'a'.repeat(64)` SESSION_SECRET fallback; on first non-prod boot, generate + persist a random secret to `dataDir/.session-secret` (mirror `loadDigestSigningSecret` pattern)
- `server/src/routes/signup.ts` — apply `config.rateLimitAuthPerMin` to `/auth/verify`

**Tests:**
- New: db.ts assertion fires if `PRAGMA foreign_keys = OFF` (mock or skip — at least a code path test).
- New: session secret persists across boot and is non-default.
- New: `/auth/verify` rate-limited (60+ requests in 1 minute returns 429).

**Commit:** `feat(security): assert FK enforcement, persist dev session secret, rate-limit verify`

---

## Final Verification

- [ ] `npm test --workspace=server` — all green (target: 158 → ~190 with new scoping tests)
- [ ] `npm run build` — server + web both clean
- [ ] Re-run security review (or critic on full diff) — confirm Critical and High items resolved
- [ ] Update `docs/superpowers/specs/2026-05-01-aggregator-inbox-design.md` threat-model section to note the post-A.5 invariants

---

## Out of scope for A.5 (defer to Plan B or later)

- M2 (SQL string interpolation in db.ts seed) — latent, not exploitable today
- M3 (verification email stored in user's own sent folder) — structural; needs dedicated `noreply@` mailbox
- L2 (attachment filename header escaping) — defense in depth
- L3 (image proxy SSRF private-IP guard) — pre-existing, not introduced by Plan A
- L4 (`POST /api/inject` dev-only gating) — pre-existing
- C4 (digest-allow token replay) — design decision, not a code defect
