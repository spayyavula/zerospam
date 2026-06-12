# ZeroSpam Webmail — "Hey-style" Redesign (Ink & Signal)

**Date:** 2026-06-12
**Status:** Approved (design) — pending implementation plan
**Scope:** Frontend redesign of the ZeroSpam webmail (`web/`). Adopt Hey's highest-impact UX patterns in the existing "Reading Room / Ink & Signal" editorial brand. Reuse existing whitelist/screener APIs — minimal/no backend change.

---

## 1. Decisions (locked via visual brainstorm)

| Question | Choice |
|---|---|
| How far | **B** — editorial look **+ a few Hey moves** (Imbox rename, Screener front-and-center, sender grouping, single-column reading). *Not* the full pile IA. |
| Visual style | **C** — **Ink & Signal**: high-contrast magazine — heavy black rules, big serif headings, mono indices, yellow highlight blocks, paper background. |
| Screener interaction | **B** — **one-at-a-time focus** (decide one sender, auto-advance). |
| Themes | **A** — **keep both**: paper "light" default + dark "Ink" variant, via the existing theme toggle. |

## 2. Goal & non-goals

**Goal:** Make the webmail read like an opinionated editorial product where the Screener (whitelist-first gate) is the hero, in ZeroSpam's own Ink & Signal brand.

**Non-goals (explicitly out of scope):**
- The Feed (newsletters) / Paper Trail (receipts) piles
- Reply-Later / Set-Aside stacks
- Server-side sender grouping or any new mail classification
- Schema changes / new mail folders

## 3. Information architecture

- **Inbox → "Imbox"** — UI label only; the API folder stays `inbox`.
- **Quarantine → "The Screener"** — reframed as "people who want into your Imbox."
- **Navigation:** the left `Sidebar` becomes a **horizontal editorial top nav**: `Imbox · Screener · Sent`, with a yellow count badge on Screener. (Settings/secondary panels move under a menu/overflow as today.)
- Single mailbox focus unchanged; mailbox switcher stays where it is today.

## 4. Visual system (Ink & Signal)

Extend the existing tokens in `web/src/styles.css` (the "Reading Room v2" block already defines `--paper`, `--ink`, `--signal`, `--rule`, `--font-display/body/mono`).

- **Light (default, "paper"):** bg `#FBF8F1`, ink `#0A0A0A`, signal `#FFD52E`, rules `#E8E1D2` / strong `#1F1F1F`.
- **Dark ("Ink") variant (new):** bg `#0E0E0C`, text `#F3EFE4`, muted `#9A958A`, rules `#F3EFE4`; **signal-yellow stays `#FFD52E`** (ink-colored text on yellow). Wired to the existing `useTheme` / `ThemeToggle` + `data-theme` mechanism.
- **Type:** Source Serif display (headlines), sans body, JetBrains Mono labels/indices.
- **Motifs:** heavy black hairlines/rules, big serif headings, mono indices (`01`, `02`), yellow highlight blocks for counts / `NEW` / `TRUSTED`.
- The legacy `zs*` tokens remain for any not-yet-restyled surface, but the mail UI moves to the Ink & Signal tokens.

## 5. Components changed (`web/src/components/`)

| Component | Change |
|---|---|
| `Sidebar` | Becomes the horizontal editorial top nav (`Imbox · Screener · Sent` + yellow Screener count). |
| `MessageList` | Ink & Signal rows — mono index, serif sender name, yellow unread dot, heavy rules; **grouped by sender** (client-side, by `from_address`). |
| `ReadingPane` | Single-column focus read — serif headline, sans body (~46–65ch measure), meta line, `TRUSTED`/signal chips. |
| `Screener` | **One-at-a-time** flow: one pending sender + message preview front-and-center; **YES** (whitelist the sender via the existing trust path → waiting mail flows to the Imbox) / **NO** (advance; leave in quarantine to expire, optionally record a `screener_mutes` entry). Auto-advances to the next; shows progress (e.g. `1 / 3`). |
| `App` | Wire the renamed nav/labels and the top-nav layout; `folder` state values unchanged (`inbox`, `quarantine`, `sent`). |
| `brand/` kit | Reuse `HardRule`, `Hairline`, `MonoLabel`, `YellowDot`, `Wordmark`, `EditorialButton`, `EditorialInput`; add any missing primitives (e.g. a `SignalBadge` for counts, a `MonoIndex`). |

`LoginForm` / `Landing` / `Signup` already lean editorial — a light pass to align them with Ink & Signal, but they are not the focus.

## 6. Backend touchpoints (minimal / none)

- **"YES" (approve sender):** reuse the existing whitelist/trust path used by the message "trust sender" action and the digest allow-links.
- **"NO" (decline):** no new mail is whitelisted; the messages remain in quarantine and expire via TTL. Optionally insert a `screener_mutes` row (table already exists) to suppress repeat nags.
- **"Imbox"** is a display rename — no API change.
- No schema changes. If a convenience endpoint is wanted (e.g. "list pending senders grouped"), it can be added later; v1 groups client-side from existing quarantine messages.

## 7. Testing

- Update existing component tests for new labels/markup: `Sidebar.test`, `Screener.test`, `MessageList` rendering, `App.test`.
- New tests: Screener one-at-a-time advance (YES whitelists + advances; NO advances; empty state); MessageList sender grouping; theme variant renders (`data-theme` light/dark tokens present).
- Manual: run the app, walk Imbox → open a message → Screener (approve one, decline one) in both themes; screenshot.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Top-nav refactor touches `App` layout broadly | Keep `folder` state + data flow identical; change presentation only |
| Trade-dress (looking too much like Hey) | We chose **Ink & Signal**, ZeroSpam's own brand — not a literal Hey clone |
| Dark variant contrast on yellow | Yellow keeps ink-colored text in both themes; verify WCAG AA on labels |
| Client-side sender grouping cost on large lists | Group the already-paginated list; revisit a server endpoint only if needed |
