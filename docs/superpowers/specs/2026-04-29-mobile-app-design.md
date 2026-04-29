# ZeroSpam Mobile App — Design Spec

**Date:** 2026-04-29
**Status:** Brainstorm complete; ready for implementation plan
**Author:** generated via brainstorming session
**Related:** [`2026-04-29-quarantine-digest-design.md`](./2026-04-29-quarantine-digest-design.md), [`2026-04-29-quarantine-digest-implementation.md`](../plans/2026-04-29-quarantine-digest-implementation.md)

## TL;DR

A React Native + Expo mobile companion to the ZeroSpam webmail, delivering full webmail parity on iOS and Android. Lives in this repo as a third workspace (`mobile/`) alongside `server/` and `web/`, with a new `shared/` workspace exposing TypeScript types and `zod` schemas to all consumers.

The app talks to the existing Fastify API on the public host `api.zero-spam.email` over TLS. The webmail gains a single-owner password login (with optional TOTP); the mobile app is added by scanning a one-time QR code from the webmail's "Devices" settings. The phone never types the owner's password.

Push notifications are granular (per-mailbox × per-folder toggles). v1 is always-online — no on-device SQLite cache; React Query handles in-memory caching and AsyncStorage handles small persisted state (compose drafts, last-selected mailbox, push-prefs snapshot).

## Locked decisions

| Topic | Decision | Rationale |
|---|---|---|
| Scope | **Full webmail parity** | User wants every webmail screen on mobile. |
| Connectivity | **Public API on `zero-spam.email` from day one** | User owns the domain and plans to host the server publicly. |
| Auth model | **Owner password + optional TOTP (web); QR pairing (mobile)** | Phone never types the password; revocable per device. |
| Push | **Granular per-mailbox × per-folder toggles** | User gets to silence noisy folders without losing real-time on important ones. |
| Navigation | **Bottom tabs + drawer (hybrid)** | Four primary verbs always reachable; drawer holds mailboxes + admin screens. |
| Offline behavior | **Always-online; React Query in-memory cache; no SQLite** | Public API makes "off-LAN" a corner case; SQLite cache wasn't worth the complexity. |
| Persistence on device | **AsyncStorage** (compose draft, last mailbox, push-prefs snapshot) + **SecureStore** (bearer token) | Small-state only; no schema-migration burden. |
| Repo layout | **npm workspaces — add `mobile/` and `shared/`** | Atomic commits; types stay in sync; one repo to clone. |
| Mobile stack | **Expo SDK 54+, TypeScript, managed workflow** | Matches user's stated "I will be using Expo Go" intent. |
| iOS push caveat | **EAS Development Build required for iOS** | Expo Go on iOS dropped remote push in SDK 53. Android push works in Expo Go. |

## 1. Architecture & topology

### Production deployment

```
                   Public internet
                         │
                         ▼
        ┌───────────────────────────────────┐
        │  zero-spam.email (single VPS)     │
        │  ─────────────────────────────    │
        │  Caddy / nginx (TLS, ACME)        │
        │   ├─ api.zero-spam.email  ─►  Fastify :8025  (webmail UI + JSON API)
        │   └─ mail.zero-spam.email ─►  smtp-server :25 / :587   (existing SMTP)
        │                                                                 │
        │  shared SQLite (zerospam.sqlite, WAL) + maildir/                │
        │  outbound DKIM-signed mail                                      │
        └─────────────────────────────────────────────────────────────────┘
                         ▲                        ▲
                         │ HTTPS + bearer         │ HTTPS + cookie session
                         │                        │
                  ┌──────┴──────┐          ┌──────┴─────────┐
                  │   Mobile    │          │     Web        │
                  │  (Expo)     │          │  Vite + React  │
                  └─────────────┘          └────────────────┘
```

### DNS records (`zero-spam.email`)

| Type | Name | Value |
|---|---|---|
| `A` | `mail.zero-spam.email` | `<VPS IPv4>` |
| `A` | `api.zero-spam.email` | `<VPS IPv4>` (or same host, single A) |
| `MX` | `zero-spam.email` | `10 mail.zero-spam.email.` |
| `TXT` | `zero-spam.email` | `v=spf1 mx -all` |
| `TXT` | `zs1._domainkey.zero-spam.email` | (from `/api/domains/:id/dns`) |
| `TXT` | `_dmarc.zero-spam.email` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@zero-spam.email` |
| `PTR` | reverse DNS for VPS IP | `mail.zero-spam.email` |

### Hardening that comes with going public

- **TLS everywhere.** Caddy or nginx + ACME. HSTS preload. No plain HTTP.
- **Rate limiting** on `/api/auth/*` and `/api/mobile/pair` (Fastify rate-limit plugin; per-IP, fail-closed).
- **Brute-force protection** on login (lockout after N failures per account or per IP, exponential backoff).
- **CORS** locked to `https://zero-spam.email` and `https://api.zero-spam.email`. Mobile uses bearer tokens, no CORS preflight matters there.
- **Audit log** table — login successes/failures, device pair, device revoke, password change, TOTP setup. Surfaced in webmail settings.
- **Bind 0.0.0.0** for Fastify; the existing `localhost`-only assumption goes away. SMTP already binds publicly per the deployment recipe.

## 2. Auth & device pairing

Single owner. Bootstrapped via `npm run seed:owner` (interactive CLI prompts; never hardcoded).

### Web (browser) — cookie session

- `POST /api/auth/login` with `{ email, password }` → if TOTP is enabled and missing, returns `200 { needs_totp: true }`; otherwise sets a session cookie (`zs_sid`, HttpOnly, Secure, SameSite=Lax) scoped to `api.zero-spam.email`.
- `POST /api/auth/logout` clears the session.
- TOTP setup/confirm/disable lives at `POST/DELETE /api/auth/totp{,/setup,/confirm}`.

### Mobile — pairing only

The phone never types the password.

1. Owner signs in to webmail on a laptop.
2. Settings → **Devices** → **Add device** → server creates a `pairing_codes` row (random 16 bytes, SHA-256 stored, expires in 5 min, single-use).
3. Webmail renders the code as a QR plus a fallback digit string.
4. Phone scans the QR → `POST /api/mobile/pair { code, device_name, platform, app_version }` → server consumes the row, mints a long-lived bearer token (32-byte random), inserts a `devices` row.
5. Phone stores the token in `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences-backed Keystore on Android). All future calls send `Authorization: Bearer <token>`.
6. Owner revokes any device from the **Devices** settings screen (sets `devices.revoked_at`; the auth middleware rejects revoked tokens immediately).

### Auth middleware

A single Fastify `requireAuth` pre-handler. Accepts **either** the session cookie or a bearer token:

- Session: HMAC-validate the cookie, look up `sessions`, ensure not expired.
- Bearer: SHA-256-hash, look up `devices`, ensure `revoked_at IS NULL`.

On success, sets `req.user` and `req.device | req.session`. On failure, returns 401 (mobile clients interpret 401 as "device revoked" → wipe + return to Pair screen).

## 3. Server data model — additions

```sql
-- single owner
CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,           -- argon2id
  totp_secret     TEXT,                    -- nullable; null = TOTP disabled
  totp_enabled_at INTEGER,
  created_at      INTEGER NOT NULL
);

-- browser sessions for the webmail
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,             -- random 32-byte hex; cookie value is HMAC of this
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);

-- short-lived pairing codes (5 min TTL)
CREATE TABLE pairing_codes (
  code_hash   TEXT PRIMARY KEY,             -- sha256 of the QR code; raw code never stored
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER                       -- nullable; single-use
);

-- paired mobile devices
CREATE TABLE devices (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  name              TEXT NOT NULL,          -- "Sreekanth's iPhone"
  token_hash        TEXT NOT NULL UNIQUE,   -- sha256 of the bearer; raw never stored
  expo_push_token   TEXT,                   -- nullable; updated by client
  platform          TEXT,                   -- 'ios' | 'android'
  app_version       TEXT,
  created_at        INTEGER NOT NULL,
  last_seen_at      INTEGER NOT NULL,
  revoked_at        INTEGER                 -- nullable; non-null = blocked
);

-- per-device, per-mailbox, per-folder push toggles
CREATE TABLE device_push_prefs (
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  mailbox_id  INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  folder      TEXT NOT NULL,                -- 'inbox' | 'quarantine' | 'digest'
  enabled     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (device_id, mailbox_id, folder)
);

-- security audit log
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  event      TEXT NOT NULL,                 -- 'login.ok' | 'login.fail' | 'device.pair' | 'device.revoke' | ...
  detail     TEXT,                          -- JSON
  ip         TEXT,
  user_agent TEXT,
  at         INTEGER NOT NULL
);
```

## 4. API surface

### New endpoints

**Auth (cookie-based, web only):**
- `POST /api/auth/login` — `{ email, password, totp? }` → 200 with cookie, 200 `{ needs_totp: true }`, or 401.
- `POST /api/auth/logout`
- `POST /api/auth/password` — change password (requires current password).
- `POST /api/auth/totp/setup` → `{ secret, otpauth_url }` for QR display.
- `POST /api/auth/totp/confirm` — `{ code }`.
- `DELETE /api/auth/totp` — disable (requires password).

**Devices (cookie-based, web only):**
- `POST /api/devices/pair-init` → `{ code, expires_at }` (the QR payload).
- `GET  /api/devices` → list of paired devices.
- `DELETE /api/devices/:id` → revoke.

**Pairing & device-self (bearer-only, mobile):**
- `POST /api/mobile/pair` — `{ code, device_name, platform, app_version }` → `{ token, user, mailboxes }`.
- `PUT  /api/mobile/devices/me/push-token` — `{ expo_push_token }`.
- `GET  /api/mobile/devices/me/push-prefs` → list of `(mailbox_id, folder, enabled)`.
- `PUT  /api/mobile/devices/me/push-prefs` — upsert.
- `DELETE /api/mobile/devices/me` — self-revoke (used by mobile "Sign out").

### Existing endpoints — gated

All current `/api/*` routes (`messages`, `quarantine`, `mailboxes`, `domains`, `whitelist`, `send`, `search`, `attachments`, the SSE stream, etc.) gain `requireAuth`. Request/response shapes are unchanged. Mobile uses identical shapes — that's what makes "full webmail parity" cheap.

### Push notification flow

```
new message lands  ──►  ingest pipeline  ──►  emits event { mailbox_id, folder, message_id }
                                                     │
                                  ┌──────────────────┴──────────────────┐
                                  ▼                                     ▼
                            SSE broadcast                     server/src/push.ts
                            (existing)                                  │
                                                                        ▼
                                                  SELECT devices joined to device_push_prefs
                                                  WHERE mailbox_id = ? AND folder = ? AND enabled = 1
                                                  AND devices.revoked_at IS NULL
                                                  AND devices.expo_push_token IS NOT NULL
                                                                        │
                                                                        ▼
                                                  POST https://exp.host/--/api/v2/push/send
                                                  (batched, retry-with-backoff, prune invalid tokens)
```

**Push payload:**
```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "boss@trusted.com",
  "body": "Sprint review notes",
  "data": {
    "type": "new-message",
    "mailbox_id": 1,
    "folder": "inbox",
    "message_id": 4242
  },
  "categoryId": "zs_message",
  "priority": "default"
}
```

Tap-handling on the phone uses `data.type` + `message_id` to deep-link into the right screen via the React Navigation linking config.

`folder = 'digest'` in `device_push_prefs` lets the existing Phase 3 quarantine-digest job piggyback on the same fan-out — when the digest is generated for a mailbox, devices subscribed to `(mailbox_id, 'digest')` get a push with `data.type = 'digest'` and a deep-link target on the phone (Quarantine list filtered to "since last digest"). No new server pipeline; the digest job calls the same push helper.

## 5. Mobile app architecture

### Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 54+, TypeScript, managed workflow |
| Navigation | `@react-navigation/native` v7 + `bottom-tabs` + `drawer` + `native-stack` |
| Server state | TanStack Query (`@tanstack/react-query`) v5 |
| UI state | Zustand |
| Persisted state | `@react-native-async-storage/async-storage` (compose draft, last-selected mailbox, push-prefs snapshot) |
| Secure storage | `expo-secure-store` (bearer token) |
| Push | `expo-notifications` |
| HTML rendering | `react-native-webview` with hardening (Section 6) |
| QR scan | `expo-camera` |
| Forms | `react-hook-form` + `zod` (shared with server) |
| Networking | small `apiClient` wrapper around `fetch` (~30 lines) |
| Theming | NativeWind (Tailwind for RN) |
| Linting / formatting | ESLint + Prettier, mirrored from `web/` |

### Navigation skeleton

```
RootNavigator (Stack)
├── Pair (modal, shown when no token)
└── Main (Drawer)
    ├── Tabs (Bottom Tab)
    │   ├── Inbox (Stack: list → message)
    │   ├── Quarantine (Stack: list → message)
    │   ├── Compose (Stack: form → recipient picker)
    │   └── Search (Stack: query → results → message)
    └── Drawer items (push as Stack screens):
        ├── Mailboxes
        ├── Devices
        ├── Push prefs
        ├── Whitelist
        ├── DKIM / DNS
        └── Sign out
```

### Project layout

```
mobile/
├── app.json                # Expo config — slug, scheme zerospam://, owner
├── eas.json                # EAS Build config (dev, preview, production profiles)
├── package.json            # @zerospam/mobile workspace
├── tsconfig.json
├── babel.config.js
├── metro.config.js         # workspace + nativewind setup
├── App.tsx                 # ThemeProvider + QueryClientProvider + RootNav
├── src/
│   ├── api/
│   │   ├── client.ts       # fetch wrapper, bearer injection
│   │   ├── auth.ts         # pair, revoke, refresh push token
│   │   ├── messages.ts
│   │   ├── quarantine.ts
│   │   ├── compose.ts
│   │   ├── search.ts
│   │   ├── mailboxes.ts
│   │   ├── domains.ts
│   │   ├── whitelist.ts
│   │   └── events.ts       # SSE subscription
│   ├── storage/
│   │   ├── secure.ts       # bearer token (SecureStore)
│   │   ├── prefs.ts        # AsyncStorage helpers
│   │   └── draft.ts        # compose draft persistence
│   ├── hooks/
│   │   ├── useMessages.ts
│   │   ├── useQuarantine.ts
│   │   ├── useSearch.ts
│   │   ├── useMailboxes.ts
│   │   ├── usePushPrefs.ts
│   │   └── useNetwork.ts
│   ├── nav/
│   │   ├── RootNavigator.tsx
│   │   ├── TabNavigator.tsx
│   │   ├── DrawerNavigator.tsx
│   │   └── linking.ts      # zerospam://message/123
│   ├── screens/
│   │   ├── pairing/PairScreen.tsx
│   │   ├── inbox/InboxScreen.tsx
│   │   ├── inbox/MessageScreen.tsx
│   │   ├── quarantine/QuarantineScreen.tsx
│   │   ├── compose/ComposeScreen.tsx
│   │   ├── search/SearchScreen.tsx
│   │   ├── settings/SettingsScreen.tsx
│   │   ├── settings/MailboxesScreen.tsx
│   │   ├── settings/DevicesScreen.tsx
│   │   ├── settings/PushPrefsScreen.tsx
│   │   ├── settings/WhitelistScreen.tsx
│   │   ├── settings/DkimDnsScreen.tsx
│   │   └── settings/SignOutScreen.tsx
│   ├── components/
│   │   ├── MessageRow.tsx
│   │   ├── ReadingPane.tsx       # webview wrapper
│   │   ├── AuthChip.tsx          # SPF/DKIM/DMARC chips
│   │   ├── BulkActionBar.tsx
│   │   ├── EmptyState.tsx
│   │   └── …
│   ├── push/
│   │   ├── register.ts
│   │   ├── handlers.ts
│   │   └── prefs.ts
│   ├── stores/
│   │   ├── selection.ts
│   │   ├── compose.ts
│   │   └── ui.ts
│   ├── theme/                    # NativeWind config + design tokens
│   └── lib/
│       ├── auth.ts               # token storage helpers
│       ├── format.ts
│       └── deeplink.ts
└── assets/
```

### Screen inventory (mapped to webmail)

| Screen | Webmail equivalent | Notes |
|---|---|---|
| **Pair** | "Pair a device" QR modal | Camera scan → `POST /api/mobile/pair`. First-launch entry. |
| **Inbox** | message list (Inbox folder) | Pull-to-refresh, swipe-actions (trash / trust / star), bulk-select via long-press. |
| **Message** | reading pane | Webview reader, action bar (reply / star / trust / move / delete), auth chips, sender-mismatch banner. |
| **Quarantine** | message list (Quarantine folder) | Same row component as Inbox; swipe-trust elevates to inbox + adds whitelist rule. TTL countdown badge per row. |
| **Compose** | three-pane modal | Form with from/to/cc/subject/body, attachment picker (`expo-document-picker`). Drafts persist via Zustand + AsyncStorage. |
| **Search** | `/` search bar | Input + virtualized result list. Shares row component. |
| **Mailboxes** (drawer) | mailbox manager modal | List + add/edit/delete. Per-mailbox TTL editor. |
| **Devices** (settings) | Devices list (new for web too) | List of paired devices; revoke button. |
| **Push prefs** (settings) | new for web too | Matrix of (mailbox × folder) toggles. |
| **Whitelist** (settings) | per-mailbox whitelist editor | Add/remove rules; rule type (address/domain/regex). |
| **DKIM/DNS** (settings) | DKIM/DNS panel | Read-only; copy-to-clipboard. |
| **Sign out** | (n/a) | Calls `DELETE /api/mobile/devices/me`, wipes secure store + AsyncStorage, returns to Pair. |

### Data flow & sync

**Cold start:**
1. Read bearer from SecureStore. Missing → Pair screen.
2. Fire `GET /api/mailboxes` to validate the token. 401 → wipe + Pair. 200 → continue to Main.
3. Each screen mounts → React Query fetches its data → renders.

**Foreground sync:** open SSE subscription to `/api/events?bearer=...`. Each event invalidates the affected React Query keys → refetch.

**Background:** SSE closed. Push notifications carry enough metadata to be informative without a fetch. Tap → app opens, deep-links to the message screen, which fetches fresh data.

**Mutations:**
- Online: optimistic update via React Query → API call → rollback on error.
- Offline (no internet): write actions are disabled in the UI (button shows "no connection"); the React Query in-memory cache lets the user re-read messages they already opened in this session.

### Persistence on device

| What | Where | Why |
|---|---|---|
| Bearer token | `expo-secure-store` | Sensitive; needs hardware-backed storage. |
| Compose draft | AsyncStorage | Cheap; survives crashes. |
| Last-selected mailbox / unread filter | AsyncStorage | UX; restore prior state on launch. |
| Push-prefs snapshot | AsyncStorage | Lets the prefs screen render instantly while the live fetch resolves. |

No SQLite. No on-device message cache.

### Failure cases

| Case | Behavior |
|---|---|
| Token revoked server-side | Any request returns 401 → wipe SecureStore + AsyncStorage → navigate to Pair. |
| Pairing code expired/consumed | Server returns 410 → toast on phone, return to Pair. |
| Push token rejected by Expo | Server marks `expo_push_token = NULL`; client re-registers next launch. |
| Owner deletes a mailbox | SSE broadcasts; mobile invalidates cached lists. |
| Network down | Read screens show stale-state banner; write actions disabled. |
| First-launch, no camera permission | Pair screen shows "Enter code manually" fallback (the digit string from the QR). |
| App version newer/older than API | `X-API-Version` header drives a soft warning (minor) or "App update required" screen (major). |

## 6. HTML rendering — security

Match the webmail's iframe-`sandbox=""` model on RN:

```tsx
<WebView
  originWhitelist={[]}                       // block all navigation
  source={{ html: wrappedBody, baseUrl: undefined }}
  javaScriptEnabled={false}                  // no scripts
  domStorageEnabled={false}
  thirdPartyCookiesEnabled={false}
  setSupportMultipleWindows={false}
  allowsLinkPreview={false}
  onShouldStartLoadWithRequest={() => false} // block ALL navigations
  injectedJavaScriptBeforeContentLoaded=""   // never run
/>
```

Plus an injected CSP via `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: 'none'; style-src 'unsafe-inline';">` at the top of the wrapped HTML — same default-deny image policy as the web. "Show remote images" toggle replaces `'none'` with `https:` and re-renders.

Links are intercepted by `onShouldStartLoadWithRequest` returning `false`; the message screen renders a styled link list above the body for any `<a href>` it finds, and the user explicitly taps to open in the system browser (with a confirm modal showing the destination domain).

## 7. Workspace layout & shared types

```
zerospam-email/
├── package.json                # workspaces: server, web, mobile, shared
├── package-lock.json
├── tsconfig.base.json          # shared compiler options + path aliases
├── server/                     # existing
├── web/                        # existing
├── shared/                     # NEW
│   ├── package.json            # @zerospam/shared, type:"module", main:"src/index.ts"
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # barrel
│       ├── types/
│       │   ├── message.ts
│       │   ├── mailbox.ts
│       │   ├── folder.ts
│       │   ├── whitelist.ts
│       │   ├── device.ts
│       │   ├── pairing.ts
│       │   ├── push.ts
│       │   └── auth.ts
│       └── schemas/            # zod schemas; server validates with these, mobile re-uses
│           ├── login.ts
│           ├── pair.ts
│           ├── compose.ts
│           ├── push-prefs.ts
│           └── ...
└── mobile/                     # NEW (Section 5)
```

`shared/` is **types + zod schemas only**. No runtime dependencies, no DB code, no fetch wrappers. Cheap to import from anywhere; no cycles.

### TS path aliases (`tsconfig.base.json`)

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@zerospam/shared":   ["shared/src"],
      "@zerospam/shared/*": ["shared/src/*"]
    }
  }
}
```

Server, web, and mobile each `extends` this base. Metro's `metro.config.js` resolves the aliases via `resolver.alias`.

### Root `package.json` script changes

```jsonc
{
  "scripts": {
    "dev":         "concurrently -n server,web,mobile -c blue,green,magenta \"npm:dev:server\" \"npm:dev:web\" \"npm:dev:mobile\"",
    "dev:server":  "npm run dev --workspace=server",
    "dev:web":     "npm run dev --workspace=web",
    "dev:mobile":  "npm run dev --workspace=mobile",
    "build":       "npm run build --workspace=shared && npm run build --workspace=web && npm run build --workspace=server",
    "test":        "npm test --workspaces --if-present",
    "typecheck":   "tsc -b server web mobile shared",
    "seed":        "tsx server/src/seed.ts",
    "seed:owner":  "tsx server/src/seed-owner.ts",
    "inject":      "tsx server/src/inject.ts"
  }
}
```

## 8. Dev / build / release flow

### Dev

| What | Command |
|---|---|
| Run server + web + mobile together | `npm run dev` |
| Just the API | `npm run dev:server` |
| Mobile against staging API | `EXPO_PUBLIC_API_BASE=https://api.zero-spam.email npm run dev:mobile` |
| Mobile against local server (phone on same Wi-Fi) | `EXPO_PUBLIC_API_BASE=http://192.168.x.x:8025 npm run dev:mobile` (CORS dev exception via `ALLOWED_ORIGINS` env) |
| Bootstrap owner record on a new VPS | `npm run seed:owner` (interactive: email, password, optional TOTP) |
| Pair a dev phone | Sign in to webmail → Settings → Devices → "Add device" → scan QR |

### Build / release profiles

| Profile | What | When |
|---|---|---|
| **Expo Go (Android)** | Standard Expo Go shell + JS bundle from `expo start` | Daily dev on Android, including push notifications. |
| **EAS Development Build (iOS)** | Custom dev client; sideloaded via TestFlight or device-attached install | Required for iOS push (Expo Go on iOS dropped remote push in SDK 53). One-time build per dev iOS device, then JS-only updates via EAS Update or `expo start --dev-client`. |
| **EAS Preview Build** | Adhoc-signed (iOS) / APK (Android) for trusted testers | Phase 4+. |
| **EAS Production Build** | App Store / Play Store binaries | When/if you publish. |

`eas.json`:
```jsonc
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "ios": { "simulator": false } },
    "preview":     { "distribution": "internal" },
    "production":  {}
  },
  "submit": { "production": {} }
}
```

EAS Update is wired in but optional — JS bundle pushes without a binary rebuild for fix-it-now cases.

### API contract versioning

`shared/` exports an `API_VERSION` constant. Server attaches `X-API-Version` header; mobile checks it on every response. Major mismatch → "App update required" blocking screen. Minor mismatch → soft warning + log.

## 9. Testing strategy

| Layer | Tool | Coverage target |
|---|---|---|
| `shared/` | vitest | ~100% on zod schemas — they're the source of truth for both client and server. |
| `server/` | vitest (already adopted) | New auth/middleware, pairing, push fan-out, audit log — full integration tests against a temp SQLite. Existing setup-fixture pattern from the recent `chore(test)` commit extends to the new tables. |
| `mobile/` pure logic | vitest | Hooks, `api/*` clients, format utilities, deep-link parser. |
| `mobile/` components | `@testing-library/react-native` + MSW | Inbox row, message screen, pair flow, compose form. |
| `mobile/` E2E | Maestro flows under `mobile/.maestro/` | Pair → Inbox → Open message → Trust sender → Sign out. *Optional for v1.* |
| Type safety | `tsc -b server web mobile shared` | Required to pass in CI before tests run. |

### CI (GitHub Actions, single workflow)

```yaml
jobs:
  ci:
    steps:
      - checkout
      - setup-node 20
      - npm ci
      - npm run typecheck
      - npm test
      # Mobile build smoke test (PRs only):
      - if: github.event_name == 'pull_request'
        run: npx expo-doctor && npx expo prebuild --no-install --platform all
```

Full EAS builds are triggered out-of-band (manual `eas build`), not on every PR.

## 10. Phasing

The implementation plan (next document) will break this into phases. A reasonable cut:

1. **Phase A — Server foundation.** `users`, `sessions`, `pairing_codes`, `devices` tables. Auth middleware. Login/logout/TOTP. Owner seed CLI. Audit log. Rate limiting. Move existing endpoints behind `requireAuth`. Webmail login screen.
2. **Phase B — Pairing & shared workspace.** `shared/` workspace. Pairing endpoints (`/api/devices/pair-init`, `/api/mobile/pair`). Webmail "Devices" settings (list, add, revoke). Bearer middleware path.
3. **Phase C — Mobile shell.** `mobile/` workspace. Pair screen. Bottom tabs + drawer. Inbox list + Message detail (read, plus mark-read / star / trash / trust on a message). Bearer storage in SecureStore. Hardened webview reader. *No Compose, Search, or admin screens yet — those come in Phase D.*
4. **Phase D — Mobile parity.** Quarantine, Search, Compose, Reply (which routes through Compose), Mailboxes, Whitelist, DKIM panel, Devices, Sign out.
5. **Phase E — Push.** `server/src/push.ts`. `device_push_prefs` table. Push prefs UI on web + mobile. Expo token registration on mobile. iOS EAS Development Build.
6. **Phase F — Hardening.** Production deploy on `zero-spam.email`. TLS via Caddy. Audit-log UI. EAS preview builds for testers.

Each phase ships independently and the previous phase remains usable.

## 11. Out of scope (for v1)

- **Multi-user support.** Server stays single-owner. Adding more users is a future spec.
- **Action queue when offline.** Read works; writes block. The "queue + replay" model from the brainstorm's option C is deferred.
- **WebAuthn / passkeys.** Password + TOTP for v1. Passkeys is a future upgrade.
- **Background fetch / periodic sync on the phone.** Push covers the "tell me about new mail" case.
- **Direct-MX outbound.** Stays out of scope per the existing README's stance — relay-only.
- **Threading.** Already noted as deferred in the README.

## 12. Open questions / risks

- **iOS push without Expo Go.** EAS Development Build has a one-time setup cost (Apple Developer account, signing). Plan must include this gate.
- **Rate-limit tuning.** Initial values are guesses; we'll tune after some real traffic.
- **`zod` version coupling.** Both server and mobile import the same `zod` schemas — pin a single version in `shared/` and require consumers to use it.
- **NativeWind + Expo SDK 54.** NativeWind v4 has good SDK 54 support but the metro alias dance can be finicky on workspace setups; budget half a day for first-build issues.
- **Caddy vs nginx on the VPS.** Caddy is simpler (auto-ACME) but nginx is more familiar to ops. Either works; pick one before Phase F.

## 13. Success criteria

- Owner can sign in to webmail at `https://zero-spam.email` with a password (and TOTP if enabled).
- Owner can pair an Android phone (Expo Go) and an iOS phone (EAS Dev Build) by scanning a QR.
- Phone receives a push notification when new mail hits a whitelisted folder.
- Tapping the push deep-links into the right message.
- Phone can read, trust senders, delete, compose, search, and manage mailboxes — full webmail parity.
- Phone "Sign out" wipes secure storage and revokes the device server-side.
- Owner can revoke any device from the webmail; the phone is logged out within seconds.
- Off-network: phone reads from React Query in-memory cache; write actions disabled with a clear banner.
