# In-App Screener + Welcome Tour — Design Spec

**Date:** 2026-05-01
**Status:** Approved for implementation planning
**Predecessor specs:** quarantine-digest, aggregator-inbox

## Goal

Bring HEY-style proactive sender triage into ZeroSpam by overlaying a per-sender Yes/No queue on top of the existing Quarantine, without losing ZeroSpam's "ignore = auto-delete" advantage. Pair it with a one-time welcome tour so new users understand the trust-on-send model from minute one.

## Non-goals

- DNS setup wizard (MX/SPF/DMARC) — separate spec
- Demo data seeding — separate spec
- Persistent setup checklist — separate spec
- First-allow coachmark — separate spec
- Contact import (CSV/vCard) — separate spec
- Health dashboard / sending reputation — separate spec
- Web-side automated test framework — out of scope
- Deny rules (persistent block-this-sender) — explicitly rejected in favor of soft mute

## Architecture

The Screener is a **derived view** over the existing Quarantine queue. No new state column on `messages`. A message is "in Screener" when:

```
folder = 'quarantine'
AND received_at + (mailbox.screener_sla_hours * 3600000) > now
AND from_address NOT IN (mailbox's whitelist)
AND from_address NOT IN (active screener_mutes)
```

When SLA elapses, the message simply stops being included in the Screener query — it remains in Quarantine and follows the existing TTL auto-delete. This means:
- Zero new lifecycle states
- Zero migration of existing messages
- Existing sweeper, ingest, and digest paths untouched
- Screener decisions (allow / reject) act on the underlying Quarantine messages directly

### Two-tier flow

```
unknown sender → Quarantine (existing TTL applies)
                     ↑
                Screener view = "show me one row per new sender, within SLA"
                     ↓
                Yes  → whitelist exact + move to Inbox
                No   → trash batch + 30-day mute
                ignore → falls out of Screener at SLA, stays in Quarantine until TTL
```

### Soft mute, not deny

A "No" decision creates a row in `screener_mutes(mailbox_id, sender_addr, expires_at = now + 30d)`. Messages from that sender continue to arrive in Quarantine in the background — they just stop surfacing in the Screener for 30 days. After expiry, the sender reappears if they're still emailing. This keeps the schema simple and avoids a permanent denylist.

## Data model

### New table

```sql
CREATE TABLE screener_mutes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id   INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  sender_addr  TEXT    NOT NULL,
  muted_at     INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  UNIQUE(mailbox_id, sender_addr)
);
CREATE INDEX idx_screener_mutes_lookup ON screener_mutes(mailbox_id, sender_addr, expires_at);
```

### Schema additions (idempotent ALTERs in `db.ts`)

```sql
ALTER TABLE mailboxes ADD COLUMN screener_sla_hours INTEGER NOT NULL DEFAULT 48;
ALTER TABLE users     ADD COLUMN tour_completed_at  INTEGER;
```

Bounds: `1 ≤ screener_sla_hours ≤ 720` (30 days). Validated on PATCH.

### Free-mail domain constant

A static list, defined once in `server/src/screener-domains.ts`:

```ts
export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com',
  'aol.com', 'aim.com', 'live.com', 'msn.com',
]);
```

Used to suppress the domain-expand toast on Yes and to reject `POST /api/screener/allow-domain` for these domains.

## Server routes

New file: `server/src/routes/screener.ts`. All routes use existing `requireAuth` + `ownsMailbox` helpers; cross-tenant requests return 404 (privacy-preserving, matches existing pattern).

### `GET /api/screener?mailbox_id=X`

Returns `ScreenerSender[]` — one entry per unique `from_address` matching the Screener filter, sorted by latest `received_at` desc.

```ts
type ScreenerSender = {
  address: string;
  name: string | null;       // most recent display name
  message_count: number;
  latest_subject: string;
  latest_preview: string;    // first 200 chars
  latest_received_at: number;
  first_received_at: number;
  messages: MessageSummary[];  // full list, ordered desc
};
```

### `POST /api/screener/allow`

Body: `{ mailbox_id: number, sender_address: string }`.

Single transaction:
1. INSERT INTO whitelist_rules (mailbox_id, kind='address', pattern=sender_address, note='screener:allow')
2. UPDATE messages SET folder='inbox', read = read WHERE mailbox_id=? AND from_address=? AND folder='quarantine'

Returns `{ moved: number, rule_id: number, sender_address: string, domain: string, suggest_domain_expand: boolean }`. The `domain` is the part after `@` in `sender_address`. `suggest_domain_expand` is `false` if the domain is in `FREE_MAIL_DOMAINS`, `true` otherwise. The server is the source of truth — the web client never reasons about domain classification on its own.

Fires SSE `whitelist:changed` and `screener:changed` (payload: `{ mailboxId }`).

### `POST /api/screener/allow-domain`

Body: `{ mailbox_id: number, domain: string }`.

Rejects with 422 if `FREE_MAIL_DOMAINS.has(domain)`.

Single transaction:
1. INSERT INTO whitelist_rules (mailbox_id, kind='domain', pattern=domain, note='screener:allow-domain')
2. UPDATE messages SET folder='inbox' WHERE mailbox_id=? AND folder='quarantine' AND from_address LIKE '%@' || ?

Returns `{ moved: number, rule_id: number }`. Same SSE events as allow.

### `POST /api/screener/reject`

Body: `{ mailbox_id: number, sender_address: string }`.

Single transaction:
1. UPDATE messages SET folder='trash' WHERE mailbox_id=? AND from_address=? AND folder='quarantine'
2. INSERT OR REPLACE INTO screener_mutes (mailbox_id, sender_addr, muted_at=now, expires_at=now+30d)

Returns `{ trashed: number }`. Fires SSE `screener:changed`. Idempotent: a second reject within 30d simply refreshes the mute timestamp and trashes any new arrivals from that sender.

### `PATCH /api/mailboxes/:id` — extended

Existing route extended to accept `screener_sla_hours` in body. Validates `1 ≤ value ≤ 720`. Returns 422 on invalid.

### `POST /api/users/me/tour-complete`

No body. Sets `users.tour_completed_at = Date.now()` for the authenticated user. Idempotent.

### `GET /api/auth/me` — extended

Adds `tour_completed_at: number | null` to response so client decides whether to mount the tour.

### `/api/counts` — extended

Adds `screener: { unread, total }` where `total` = count of unique sender addresses matching the Screener filter; `unread` = same but with `messages.read = 0` for at least one of the sender's messages.

## Web components

### `web/src/components/Screener.tsx` (new)

Full-pane view rendered when `folder === 'screener'`.

- Top bar: count + "Done for now" CTA (no-op, just collapses sidebar nav back to Inbox)
- List rows: per-sender with avatar (initials, color hashed from address), display name, address, message count, latest subject preview, time-ago, **Yes** + **No** buttons
- Click row body → expands inline to show full message list (read-only, no individual actions)
- Yes click: optimistic UI removal + POST `/api/screener/allow` + show `<DomainExpandToast>` (suppressed for free-mail)
- No click: optimistic fade-out + POST `/api/screener/reject`

### `web/src/components/DomainExpandToast.tsx` (new)

Bottom-right toast, 5s auto-dismiss. Single action button: `[Trust everyone @{domain}]`. Click → POST `/api/screener/allow-domain` → second confirm toast `"Moved N messages from @{domain}"`.

The toast is mounted only when the allow response has `suggest_domain_expand: true` — the web client makes no free-mail-domain decision of its own; the server's response payload is the gate.

Mounted as portal in `App.tsx`. State managed via simple `useState<{ domain: string; visible: boolean } | null>` lifted to App. The `<Screener />` component calls a prop callback after a successful Yes click, passing `{ domain, suggest_domain_expand }` from the response.

### `web/src/components/Sidebar.tsx` (modify)

Add `screener` entry to `folders[]` array, positioned **above** `inbox`. Use `Eye` icon from lucide-react. Badge shows `counts.screener.unread` when > 0.

### `web/src/components/MailboxManager.tsx` (modify)

Add "Screener SLA (hours)" number input per mailbox row. Bound 1–720. Submits via existing PATCH route extended with `screener_sla_hours`.

### `web/src/components/WelcomeTour.tsx` (new)

Full-screen overlay shown when `authMe()` returns `tour_completed_at == null` AND user has at least one mailbox. Renders 4 steps:

| # | Spotlight target          | Headline                          | Copy |
|---|---------------------------|-----------------------------------|------|
| 1 | Sidebar `Screener` row    | Daily 30-second triage            | New senders show up here. Tap Yes to trust, No to mute. |
| 2 | Sidebar `Quarantine` row  | Nothing gets lost                 | Anything not whitelisted lands here. Auto-expires after the TTL — no inbox debt. |
| 3 | Sidebar `Whitelist` tool  | You own the guest list            | One row = one rule. Address, domain, or regex. |
| 4 | Header `?` button         | Keyboard shortcuts everywhere     | Press `?` anytime. j/k to navigate, e to allow, # to trash. |

Implementation:
- Semi-opaque dark overlay with CSS `clip-path` cutout exposing target `getBoundingClientRect()`
- Floating card with arrow pointer next to cutout
- Buttons: `[Skip tour]` (any step), `[Back]` (step 2+), `[Next]` (step 1–3), `[Done]` (step 4)
- Esc key, Skip, and Done all POST `/api/users/me/tour-complete`
- If a target element is missing (tiny viewport), card centers without spotlight
- Tour does not block underlying interaction; clicking outside the card advances Next

### `web/src/App.tsx` (modify)

- Extend `SidebarFolder` type: `'inbox' | 'screener' | 'quarantine' | ...`
- Render `<Screener />` instead of `<MessageList />` + `<ReadingPane />` when `folder === 'screener'`
- After auth success, if `tour_completed_at == null`, mount `<WelcomeTour />`
- Mount `<DomainExpandToast />` as portal

### `web/src/types.ts` (modify)

```ts
export type SidebarFolder = 'inbox' | 'screener' | 'quarantine' | 'sent' | 'drafts' | 'trash';
export type Counts = { ...existing, screener: { unread: number; total: number } };
export type ScreenerSender = { ... };  // see server section
export type AuthMe = { ...existing, tour_completed_at: number | null };
```

## Testing

### Server (vitest, target ~210 total passing tests)

**`server/test/screener-routes.test.ts`** (new)
- GET returns per-sender groups, sorted desc, only within SLA, only quarantine, only non-whitelisted, only non-muted
- GET excludes muted sender; re-includes after `expires_at` passes (mock `Date.now` or direct DB update)
- POST allow whitelists exact address, moves matching messages to inbox, returns count
- POST allow-domain rejects each free-mail domain (parametrized) with 422
- POST allow-domain accepts custom domain, moves all `*@domain` messages
- POST reject trashes batch, creates mute, second call within 30d is idempotent (refreshes mute)
- SLA respected: setting `screener_sla_hours=24` drops 25-hour-old messages out of GET response

**`server/test/screener-account-scoping.test.ts`** (new)
- Account-A user cannot GET screener for account-B mailbox → 404
- Account-A user cannot allow / allow-domain / reject in account-B mailbox → 404

**`server/test/mailboxes-sla.test.ts`** (new — small)
- PATCH with `screener_sla_hours=0` → 422
- PATCH with `screener_sla_hours=721` → 422
- PATCH with `screener_sla_hours=24` → 200, persists, surfaces in subsequent GET /api/mailboxes

**`server/test/tour-routes.test.ts`** (new)
- POST `/api/users/me/tour-complete` sets timestamp, idempotent
- GET `/api/auth/me` returns `tour_completed_at`
- Unauthenticated POST → 401

### Web (manual smoke)

`docs/screener-smoke.md` checklist:
1. Fresh signup → tour appears → step through all 4 → reload → no tour
2. Inject 5 quarantined messages from 3 different senders → Screener shows 3 rows
3. Click Yes on Sarah → row removes, messages in Inbox, toast visible, dismiss toast
4. Click Yes on second sender → toast offers domain expand → click → all `@domain` messages move
5. Click No on third sender → row fades, mute row created, messages in Trash
6. Set SLA to 1h in Mailbox Manager → wait/manipulate → senders fall out of Screener into Quarantine

## Migration & rollout

- ALTER TABLE statements idempotent via existing `colsOf(table)` helper pattern
- New `screener_mutes` table created via existing CREATE TABLE IF NOT EXISTS path
- Existing messages: no migration needed (Screener is derived)
- Existing users: `tour_completed_at` defaults to NULL, so all current users will see the tour once on next login. Acceptable — they get the introduction. Power users can dismiss in 2 clicks.
- Default `screener_sla_hours = 48` applies to all existing mailboxes via DEFAULT clause

## Risk register

| Risk | Mitigation |
|------|------------|
| Spotlight cutout fails on responsive layouts | Fallback: center card without spotlight |
| Toast fires after row already moved | Toast logic is independent of row state — uses sender address from response payload |
| `screener_mutes` grows without bound | Rows are tiny (~80 bytes); janitor not needed in v1. Add a sweep if it crosses 10K rows. |
| User sets SLA to 1h then misses senders | Existing Quarantine still holds them — Screener is best-effort triage. Documented in copy. |
| Existing `account-scoping.test.ts` patterns drift | New scoping test file follows same `setupTwoAccounts()` helper; reviewer enforces |
| Free-mail domain list goes stale | Constant in source; PR-reviewable. No external feed dependency. |
