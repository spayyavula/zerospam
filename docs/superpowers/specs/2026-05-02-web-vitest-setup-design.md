# Web Vitest Setup — Design

**Date:** 2026-05-02
**Branch:** feat/quarantine-digest
**Status:** Approved (design)

## Goal

Add Vitest-based unit testing to the `web/` workspace and write tests for every web file modified or added on this branch (the screener + welcome-tour work). Server already runs Vitest; this brings web to parity so the screener/tour features have web-side tests alongside the existing `server/test/screener-routes.test.ts` and `server/test/tour-routes.test.ts`.

## Non-goals

- E2E / browser-driver tests (Playwright, Cypress) — out of scope.
- Retroactive tests for components untouched on this branch (`MessageList`, `ReadingPane`, `ComposePanel`, `LoginForm`, etc.).
- Coverage thresholds — added later once the suite is stable.
- Mobile (`apps/mobile`) test setup — separate decision.

## Scope (files covered)

Driven by `git diff main...HEAD --name-only -- web/` plus the new component files.

**Modified:**
- `web/package.json` — add devDeps + scripts.
- `web/src/App.tsx` — smoke test only (see Judgment Calls below).
- `web/src/api.ts` — unit tests for the fetch wrapper.
- `web/src/components/MailboxManager.tsx`
- `web/src/components/Sidebar.tsx`
- `web/src/styles.css` — no test (CSS-only).
- `web/src/types.ts` — no test (types are erased at runtime).

**New:**
- `web/src/components/Screener.tsx`
- `web/src/components/WelcomeTour.tsx`
- `web/src/components/DomainExpandToast.tsx`

## Toolchain

| Package | Why |
|---|---|
| `vitest` | Same runner as server — single mental model. |
| `@vitest/coverage-v8` | Coverage on demand, not enforced. |
| `jsdom` | Standard pairing with React Testing Library. happy-dom is faster but has known gaps in CSS APIs that trip Tiptap. |
| `@testing-library/react` | React 18 component testing. |
| `@testing-library/user-event` v14 | Realistic event simulation. |
| `@testing-library/jest-dom` | Matchers like `.toBeInTheDocument()`. |

No MSW. The web network surface is small and goes through `web/src/api.ts`; tests stub `globalThis.fetch` or `vi.mock('../api')` per test.

## File layout

```
web/
├── package.json              # devDeps + scripts: "test", "test:run", "coverage"
├── vitest.config.ts          # env=jsdom, setupFiles=['./src/test/setup.ts']
└── src/
    ├── test/
    │   └── setup.ts          # @testing-library/jest-dom, afterEach(cleanup)
    ├── __tests__/
    │   ├── App.test.tsx
    │   └── api.test.ts
    └── components/
        └── __tests__/
            ├── Screener.test.tsx
            ├── WelcomeTour.test.tsx
            ├── DomainExpandToast.test.tsx
            ├── Sidebar.test.tsx
            └── MailboxManager.test.tsx
```

`__tests__/` folder pattern (rather than flat-colocated `Foo.test.tsx`) keeps the components folder browseable.

## Test scope per file

### `api.test.ts`
- Each wrapper builds correct URL, method, and JSON body.
- 2xx → returns parsed JSON.
- Non-2xx → throws with informative error.
- Cookie / credentials behavior matches existing usage.

### `Screener.test.tsx`
- Empty state renders when no senders.
- Grouped sender list renders with counts and latest preview.
- "Allow" button calls `api.screenerAllow` with the correct sender.
- "Reject" button calls `api.screenerReject`.
- "Allow domain" button calls `api.screenerAllowDomain` for custom domains.
- Free-mail domain (e.g. `gmail.com`) disables / hides "allow domain".
- Loading and error states render appropriately.

### `WelcomeTour.test.tsx`
- Renders the first step on mount.
- "Next" advances steps; "Back" goes back.
- "Skip" closes immediately.
- Finishing the last step calls `api.tourComplete` and closes.

### `DomainExpandToast.test.tsx`
- Renders sender address and domain.
- "Expand to domain" button calls `api.screenerAllowDomain` with the right domain.
- Dismisses after success.
- Dismiss button hides the toast without calling api.

### `Sidebar.test.tsx`
- Renders folder list with counts.
- Clicking a folder calls the selection handler.
- Screener entry visibility ties to mailbox `screenerSlaHours > 0`.

### `MailboxManager.test.tsx`
- Renders existing mailboxes.
- Create flow: open form, fill fields, submit → calls api, refreshes list.
- Edit flow: change `screenerSlaHours`, save → calls patch.
- Delete confirmation flow.
- Validation: empty / invalid inputs surface errors before any api call.

### `App.test.tsx` — smoke only
- Renders without throwing in an unauthenticated state.
- No deep routing or flow assertions (those rot and duplicate component tests).

## Mocking strategy

Two patterns, picked per test:

1. **`vi.mock('../api')`** — default for component tests. Mocks the wrapper module so tests assert at the API-call boundary without caring about fetch internals.
2. **Global `fetch` stub** — used in `api.test.ts` to verify the wrapper actually constructs requests correctly.

Both reset in `afterEach`. The setup file calls `cleanup()` from RTL.

## Scripts

In `web/package.json`:
```json
"test": "vitest",
"test:run": "vitest run",
"coverage": "vitest run --coverage"
```

Build script unchanged (`tsc -b && vite build`).

## Project memory

Update the `test=` line in project memory to also run `npm test --workspace=web` so future automated checks include it.

## Judgment calls (locked-in decisions)

1. **App.tsx is smoke-only.** Integration assertions on App.tsx duplicate component tests and rot fast. Real flow tests belong in an E2E framework, which is out of scope.
2. **No coverage threshold.** Enforcing a percentage on PR #1 of test infra backfires. Defer.
3. **`__tests__/` folders, not flat colocated.** Keeps the `components/` folder visually clean.
4. **Mock at the api wrapper, not at fetch, for component tests.** Tests document intent in domain language.

## Risks / things to watch

- React 18 + Vitest + jsdom interactions can surface odd warnings (`act()`); the setup file should silence noisy ones only if they're not actionable.
- Tiptap-using components (`ComposePanel`, `RichTextEditor`) are NOT in scope here, so jsdom CSS gaps shouldn't bite. If we expand scope later, revisit happy-dom vs jsdom.
- `@testing-library/user-event` v14 requires `await user.click(...)`; tests must be async.

## Out-of-band follow-ups (not this PR)

- Coverage threshold once the suite stabilizes.
- E2E tests for the screener flow (Playwright or similar).
- Mobile workspace test setup.
