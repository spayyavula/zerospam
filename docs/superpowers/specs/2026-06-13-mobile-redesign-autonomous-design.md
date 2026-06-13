# ZeroSpam Mobile Redesign — Autonomous Overnight Build (Design)

**Date:** 2026-06-13
**Target:** `apps/zerospam_flutter/` (the Login → Inbox → Message-detail slice)
**Executor:** A Fabro workflow (`mobile-redesign`) run **unattended overnight** in the
local `zerospam-mobile-local` Docker sandbox, producing a **pull request**.

## Goal

Redesign the Flutter app to a **unified Material 3 + iOS-adaptive** standard, complete
the app shell, and add message-management features — built **autonomously** overnight,
gated so the morning PR is always coherent and green. Native Android/iOS builds are
produced by **Codemagic** from the resulting PR (the run itself does code + verification,
not native builds).

## Constraints & key facts

- **iOS cannot build on Windows/Docker** — handled by Codemagic (Mac infra). Signed iOS
  needs an Apple Developer account connected in Codemagic; otherwise `--no-codesign`.
- **The Fabro sandbox does not build native artifacts**, so it needs only Flutter for
  `analyze`/`test` (already in `zerospam-mobile:local`). No Android SDK required.
- **The backend already exposes every endpoint the features need** (verified): `POST
  /api/messages/:id/{read,star,move}`, `DELETE /api/messages/:id`, `POST
  /api/messages/bulk`, `POST /api/messages/:id/trust-sender`, `GET /api/search`,
  `GET /api/mailboxes/:id/counts`. Phase 4 therefore **documents existing routes** in the
  static OpenAPI doc and regenerates the client — it does **not** add backend logic.

## Approach A — layered & verification-gated

The run executes phases in a strict, safest-first order. Every phase ends with a
`flutter analyze && flutter test` **goal-gate** plus a fixup loop, so the branch is always
green up to the last completed phase. If budget/time runs out mid-feature, everything
already merged is shippable.

| Phase | Work | Gate |
|---|---|---|
| **P0 Preflight** | `flutter pub get`; baseline `analyze` + `test` (confirm green start) | green baseline |
| **P1 Design system** | `lib/theme/` (color, type, motion, `adaptive.dart`) | analyze + test |
| **P2 Redesign** | Login / Inbox / Message-detail to the system; loading/empty/error states; a11y | analyze + test |
| **P3 App shell** | `go_router` nav, `NavigationBar`, folder switching + count badges, Settings, sign-out (existing endpoints) | analyze + test |
| **P4 Feature loop** | For each of read/star/move/delete/search: extend OpenAPI doc → regenerate client → repository → UI | analyze + test, per feature |
| **P5 Finalize** | Write `codemagic.yaml`; full verify; open PR with a **progress report** | analyze + test |

## Components

### Design system (`apps/zerospam_flutter/lib/theme/`)
- `app_theme.dart` — M3 light+dark `ThemeData` from a ZeroSpam brand seed; component
  themes (cards, list tiles, app bars, inputs, buttons); shape/elevation tokens.
- `typography.dart` — M3 type scale.
- `motion.dart` — standard durations/curves; iOS page transitions.
- `adaptive.dart` — platform helpers: scroll physics, page route, switches, dialogs
  (Cupertino on iOS, Material on Android) behind one interface.
- Single source of truth; screens consume tokens, never hard-coded styles.

### Screens (redesigned)
- **Login** — branded layout, inline validation, loading/error states.
- **Inbox** — list with unread/star/attachment affordances, loading skeletons,
  empty + error(retry) states, pull-to-refresh, swipe actions (read/star/move/delete).
- **Message-detail** — typographic body, sender avatar, action toolbar.
- Accessibility everywhere: `Semantics`, ≥48dp targets, contrast, text scaling.

### App shell
- `go_router` nested navigation with a `NavigationBar`.
- Folder switching (inbox/quarantine/sent/trash) via the existing `listMessages` folder
  param; unread badges from `GET /api/mailboxes/:id/counts`.
- Settings screen (account, sign-out, about).

### Features (each: OpenAPI doc → regen client → repository → UI, independently gated)
- Mark read/unread, star/unstar, move (+ `trust-sender` for quarantine), delete, search.
- OpenAPI stays **documentation-only / static** (the established pattern); `build_runner`
  runs **inside** `lib/data/generated` (the known requirement).

### CI — `codemagic.yaml`
- `android-workflow`: analyze + test → build `.aab`/`.apk` → sign (Codemagic keystore) →
  publish artifacts.
- `ios-workflow`: Mac instance → analyze + test → build `.ipa` (Codemagic automatic
  signing; `--no-codesign` fallback) → publish artifacts.
- Pub + Gradle caching; triggered on the PR branch.

### Testing
- Repository unit tests; widget tests per screen + state.
- Golden tests **generated but non-gating** (cross-environment flakiness must not stall the
  unattended run).
- Hard gate everywhere: `flutter analyze` (zero issues) + `flutter test`.

## Autonomy guardrails (first unattended run)

- Isolated Docker sandbox; work lands on a **dedicated branch → PR only**. Never touches
  `master`; nothing auto-merges.
- **Token-budget cap** stops the run cleanly.
- **Auto-approve** (no human gates) so it runs overnight; every phase still gated by
  analyze+test with a fixup loop.
- PR body is a **progress report**: done / partial / not-reached.

## Out of scope

- New backend business logic (all endpoints already exist).
- Native build infra beyond `codemagic.yaml` (Codemagic account, Apple/Google credentials
  are one-time interactive setup the user does).
- A custom/bespoke brand identity (we target unified M3 + adaptive touches).

## Success criteria

- Morning PR: app builds (`flutter analyze` clean, `flutter test` green) with P1–P3
  complete and as many P4 features as budget allowed, each verified.
- `codemagic.yaml` present and valid for Android + iOS.
- PR progress report accurately states what was done, partial, and not reached.
