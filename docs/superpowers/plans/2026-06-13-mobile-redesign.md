# ZeroSpam Mobile Redesign — Implementation Plan

> **For agentic workers:** This plan is executed **autonomously** by the Fabro
> `mobile-redesign` workflow, phase by phase. Each phase ends with a hard gate:
> `cd apps/zerospam_flutter && flutter analyze && flutter test` — both must pass
> before committing and advancing. On gate failure, fix and re-run (do not skip).
> Work safest-first; if you run low on budget, STOP after the current phase's gate
> is green rather than starting a new phase half-way. Commit after every green gate.

**Goal:** Redesign the Flutter app to a unified Material 3 + iOS-adaptive standard,
complete the app shell, and add message-management features — verified at every step.

**Architecture:** A `lib/theme/` design system is the single source of truth; screens
consume tokens only. Navigation moves to `go_router`. New features document **existing**
backend routes in the static OpenAPI doc, regenerate the dart-dio client, wrap them in
repositories, and surface them in the UI. CI is a `codemagic.yaml` building Android + iOS.

**Tech Stack:** Flutter (Riverpod, Dio, built_value/dart-dio), `go_router`, `intl`,
`flutter_test` (+ golden), Fabro (orchestration), Codemagic (native builds).

**Design spec:** `docs/superpowers/specs/2026-06-13-mobile-redesign-autonomous-design.md`

---

## Hard rules (read before every phase)

- **Gate command (the "gate"):** `cd apps/zerospam_flutter && flutter pub get && flutter analyze && flutter test`. Zero analyzer issues; all tests pass.
- **Codegen, when the OpenAPI doc changes:** regenerate via the mobile extension, then run `build_runner` **inside the generated package** (this is required — the generated package is named `openapi` and its `.g.dart` parts use `package:openapi/...` self-imports):
  ```bash
  cd apps/zerospam_flutter/lib/data/generated && dart pub get && dart run build_runner build --delete-conflicting-outputs
  ```
  Keep the generated package's `environment.sdk` floor equal to the app's (`^3.12.x`).
- **OpenAPI stays documentation-only / static** (the existing `@fastify/swagger` static-mode pattern). Document the **real** backend route — read the handler first; never invent request/response shapes.
- **Never edit generated files** under `lib/data/generated/` by hand.
- **One feature at a time** in Phase 4; commit each on a green gate.

---

## File Structure

**Design system (create):** `apps/zerospam_flutter/lib/theme/{app_theme,color_schemes,typography,motion,adaptive}.dart`
**Screens (rewrite):** `lib/features/{auth,inbox,message}/presentation/*.dart`
**Shell (create):** `lib/app_router.dart`, `lib/features/shell/presentation/shell_screen.dart`, `lib/features/settings/presentation/settings_screen.dart`
**Features (modify):** `server/src/openapi/spec.ts` (+ regen `lib/data/generated/**`), `lib/data/repositories/*.dart`, feature notifiers/screens
**CI (create):** `codemagic.yaml` (repo root)
**Tests:** `apps/zerospam_flutter/test/{unit,widget,golden}/**`

---

## PHASE 0 — Preflight

### Task 0: Confirm a green baseline
- [ ] **Step 1: Install + baseline gate**
  ```bash
  cd apps/zerospam_flutter && flutter pub get && flutter analyze && flutter test
  ```
  Expected: analyze clean; existing tests pass. If red on a fresh clone, fix the generated client first (`cd lib/data/generated && dart pub get && dart run build_runner build --delete-conflicting-outputs`) before proceeding.
- [ ] **Step 2: Add dependencies**
  ```bash
  cd apps/zerospam_flutter && flutter pub add go_router intl
  ```
- [ ] **Step 3: Gate + commit** (`feat(mobile): add go_router + intl`).

---

## PHASE 1 — Design system (`lib/theme/`)

### Task 1: Establish the design system
**Files:** create `lib/theme/{color_schemes,typography,motion,adaptive,app_theme}.dart`

- [ ] **Step 1: Color schemes** — `color_schemes.dart`: derive M3 light + dark `ColorScheme` from a ZeroSpam brand **seed** (`const brandSeed = Color(0xFF1B6B5C);` — a secure teal-green; refine tone but keep WCAG AA contrast). Export `lightScheme`, `darkScheme`.
- [ ] **Step 2: Typography** — `typography.dart`: an M3 `TextTheme` (display→label) with consistent sizing/weights; expose `appTextTheme(ColorScheme)`.
- [ ] **Step 3: Motion** — `motion.dart`: `Durations`/`Curves` tokens (e.g. `fast=150ms`, `standard=250ms`, emphasized curve) used by all transitions.
- [ ] **Step 4: Adaptive helpers** — `adaptive.dart`: `bool get isCupertino => !kIsWeb && (Platform.isIOS || Platform.isMacOS);` plus helpers `adaptiveScrollPhysics()`, `adaptivePageTransition()`, `adaptiveSwitch(...)`, `adaptiveDialog(...)` returning Cupertino widgets on iOS, Material otherwise, behind one interface.
- [ ] **Step 5: App theme** — `app_theme.dart`: `ThemeData lightTheme()` / `darkTheme()` wiring scheme + typography + component themes (Card, ListTile, AppBar, FilledButton, InputDecoration, NavigationBar) with shape/elevation tokens. `useMaterial3: true`.
- [ ] **Step 6: Wire into `app.dart`** — `MaterialApp` uses `theme: lightTheme(), darkTheme: darkTheme(), themeMode: ThemeMode.system`.
- [ ] **Step 7: Gate + commit** (`feat(mobile): Material 3 design system + adaptive helpers`).

**Acceptance:** app builds with the new theme; no screen hard-codes colors/text styles (they read from `Theme.of(context)`).

---

## PHASE 2 — Redesign the three screens

### Task 2: Login screen
**Files:** rewrite `lib/features/auth/presentation/login_screen.dart`; keep `Key('email'|'password'|'totp'|'submit'|'error')` so existing widget test passes.
- [ ] Branded header (logo/wordmark), M3 inputs with inline validation, loading state on submit, error surface, TOTP field when needed. A11y: labels, ≥48dp targets, contrast.
- [ ] **Gate + commit** (`feat(mobile): redesign login screen`).

### Task 3: Inbox screen
**Files:** rewrite `lib/features/inbox/presentation/inbox_list_screen.dart`
- [ ] List items: unread dot, star, sender avatar (initials), subject/preview, relative time via `intl`. Loading **skeletons**, empty state, error state with retry, pull-to-refresh. Keep `Key('inbox-error')`.
- [ ] **Gate + commit** (`feat(mobile): redesign inbox with states + pull-to-refresh`).

### Task 4: Message-detail screen
**Files:** rewrite `lib/features/message/presentation/message_detail_screen.dart`; keep `Key('detail-error')`.
- [ ] Header (subject, sender avatar + address, time), readable typographic body, action toolbar (placeholders wired in Phase 4). Loading/error states.
- [ ] **Gate + commit** (`feat(mobile): redesign message detail`).

### Task 5: Golden tests (non-gating)
**Files:** `test/golden/{login,inbox,message_detail}_golden_test.dart`
- [ ] Pump each screen in light+dark with seeded state; `await expectLater(find.byType(...), matchesGoldenFile(...))`. Generate once: `flutter test --update-goldens`. **If goldens flake, mark the group `skip: true` — do not let goldens block the gate.**
- [ ] **Gate + commit** (`test(mobile): golden coverage for redesigned screens`).

---

## PHASE 3 — App shell

### Task 6: Router + navigation shell
**Files:** create `lib/app_router.dart`, `lib/features/shell/presentation/shell_screen.dart`; update `app.dart`/`main.dart` to use `MaterialApp.router`.
- [ ] `go_router` with auth redirect (signed-out → `/login`), a `StatefulShellRoute` hosting `NavigationBar` with destinations Inbox / Quarantine / Sent / Trash; routes `/messages/:id` for detail; `/settings`.
- [ ] Folder switching reuses the existing `listMessages(folder:)`; show unread badges from `getMailboxCounts` (added in Phase 4 if not present — until then, omit badges).
- [ ] Keep auth widget test green (it pumps `LoginScreen` directly).
- [ ] **Gate + commit** (`feat(mobile): go_router shell + folder navigation`).

### Task 7: Settings + sign-out
**Files:** create `lib/features/settings/presentation/settings_screen.dart`
- [ ] Account row (email from `getMe`), theme note, About, **Sign out** (calls `authNotifier.signOut()` → router redirects to `/login`).
- [ ] **Gate + commit** (`feat(mobile): settings screen + sign-out`).

---

## PHASE 4 — Feature loop (one feature per iteration; each fully gated)

For **each** feature below, in order, do all of: (a) read the backend handler to get the
exact method/path/request/response; (b) add the documented operation + schemas to
`server/src/openapi/spec.ts`; (c) regenerate: re-fetch the spec (run the server or update
the cached `contracts/openapi.json` to match) and run codegen, then **build_runner inside
`lib/data/generated`**; (d) add a repository method; (e) wire the UI action; (f) add a
repository unit test; (g) **gate + commit**.

Backend routes to document (read each handler in `server/src/api.ts` for exact shapes):

| Feature | Route | Notes |
|---|---|---|
| Mark read/unread | `POST /api/messages/:id/read` | toggles/sets read |
| Star/unstar | `POST /api/messages/:id/star` | toggles starred |
| Move folder | `POST /api/messages/:id/move` | body `{ folder }` |
| Delete | `DELETE /api/messages/:id` | |
| Trust sender | `POST /api/messages/:id/trust-sender` | quarantine action |
| Search | `GET /api/search?q=&folder=&limit=` | FTS |
| Folder counts | `GET /api/mailboxes/:id/counts` | for nav badges |

### Task 8: Mark read/unread (template for the loop)
- [ ] Document `POST /api/messages/{id}/read` in `spec.ts` (operationId `markRead`, security bearer, response from handler). Regenerate client + build_runner-in-package.
- [ ] `MessageRepository.markRead(String id)` wrapping `MobileApi.markRead`; map errors via `AppError.fromDio`.
- [ ] UI: tapping/swiping a message in Inbox calls it with optimistic update; detail marks read on open.
- [ ] Unit test `markRead` (success + 401→unauthorized). **Gate + commit** (`feat(mobile): mark-read`).

### Tasks 9–13: Star, Move, Delete, Search, Counts-badges
- [ ] Repeat the Task 8 template for star (`POST /star`, swipe/icon toggle), move (`POST /move` with folder picker / swipe), delete (`DELETE`, swipe + confirm via `adaptiveDialog`), search (`GET /api/search`, a search field on Inbox with a `searchNotifier`), and folder counts (`GET /api/mailboxes/{id}/counts`, wire unread badges into the nav). One feature per commit, each behind a green gate. Trust-sender is an optional quarantine action if budget remains.

---

## PHASE 5 — Finalize

### Task 14: Codemagic CI
**Files:** create `codemagic.yaml` (repo root)
- [ ] Two workflows:
  ```yaml
  workflows:
    android-workflow:
      name: ZeroSpam Android
      instance_type: linux_x2
      environment: { flutter: stable, groups: [android_signing] }
      scripts:
        - cd apps/zerospam_flutter && flutter pub get
        - cd apps/zerospam_flutter && flutter analyze
        - cd apps/zerospam_flutter && flutter test
        - cd apps/zerospam_flutter && flutter build appbundle --release
        - cd apps/zerospam_flutter && flutter build apk --release
      artifacts: [ apps/zerospam_flutter/build/**/outputs/**/*.aab, apps/zerospam_flutter/build/**/outputs/**/*.apk ]
    ios-workflow:
      name: ZeroSpam iOS
      instance_type: mac_mini_m2
      environment: { flutter: stable, groups: [ios_signing] }
      scripts:
        - cd apps/zerospam_flutter && flutter pub get
        - cd apps/zerospam_flutter && flutter analyze
        - cd apps/zerospam_flutter && flutter test
        - cd apps/zerospam_flutter && flutter build ipa --release || flutter build ios --release --no-codesign
      artifacts: [ apps/zerospam_flutter/build/ios/ipa/*.ipa ]
  ```
  Add a comment block noting that the `android_signing` / `ios_signing` env groups + Apple/Google credentials are configured **in the Codemagic UI** (not committed).
- [ ] Validate YAML parses. **Commit** (`ci(mobile): Codemagic Android + iOS workflows`).

### Task 15: Final verification + PR
- [ ] Run the full gate once more; ensure clean tree.
- [ ] Open a PR titled "feat(mobile): Material 3 redesign + features + Codemagic CI" whose body is a **progress report**: a checklist of P1–P5 marking done / partial / not-reached, plus the verify evidence (analyze clean, test counts).

---

## Self-Review

- **Spec coverage:** design system (P1), 3 screens + states + a11y (P2), shell/nav/settings/sign-out (P3), features documenting existing endpoints (P4), Codemagic CI + testing (P5/Task 14, golden Task 5) — all mapped.
- **Determinism pinned:** gate command, build_runner-in-package, SDK-floor rule, static OpenAPI pattern, keep-existing-test-keys, one-feature-per-commit.
- **Creative latitude bounded:** UI tasks specify requirements + acceptance + preserved test keys rather than exact widget trees (the agent composes those), which is appropriate for an autonomous redesign.
- **Safety:** every phase gated; stop-after-green-gate on low budget; PR-only, never touches master.
