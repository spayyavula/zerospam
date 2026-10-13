# ZeroSpam for Android — v1 spec

Status: in progress · Owner: spayyavula · Codebase: `apps/mobile` (Expo / React Native)

## 1. Goal

A native Android app that does everything a ZeroSpam customer does day to day in
webmail, plus instant new-mail notifications, shipped to a Google Play **internal
testing** track first. iOS comes for free from the same code later; it is not a v1
release target.

## 2. Decisions

| Topic | Decision | Why |
|---|---|---|
| Codebase | Expo SDK 54 / React Native in `apps/mobile` | Same language as web + server; reuses `@zerospam/shared-api` types and client. |
| Flutter app | Left in place, not developed. Codemagic config untouched. | Delete in a later cleanup PR once the Expo app ships. |
| API origin | `https://zero-spam.email` | The old `api.zerospam.co` in `eas.json` never existed. |
| Android package id | `email.zerospam.app` | Old id (`co.researchbot.zerospam`) belongs to another brand. **Permanent once the first build is uploaded to Play** — change it before then if wanted. |
| Auth | Existing device-token flow: `/api/auth/login` (+TOTP) → `/api/auth/devices` → Bearer token in Android Keystore via `expo-secure-store` | Already implemented server-side; no cookies on device. |
| Look | Reading Room brand (paper / ink / signal yellow, serif display), light + dark following the system with an override in More | Matches web and landing page. |
| Billing | **No purchase flow and no links to pay in the app.** When the trial ends (`402 subscription_required`) the app shows a neutral "Your free trial has ended — your mail is still arriving. Manage your account at zero-spam.email" screen. No prices, no buttons to Stripe. | Google Play's payments policy forbids steering users to non-Play payment for digital services. A neutral notice is the accepted pattern. |
| Push | Expo Push Service (delivers through Firebase Cloud Messaging) | One HTTPS call from our server; no Firebase SDK on the server. Needs an FCM v1 key uploaded to Expo once. |

## 3. Scope

### 3.1 Core mail
- Sign in (email + password, TOTP step when enabled), sign out (revokes the device token).
- Create account in-app (same rules as web; then "check your email to verify").
- Mailbox switcher when the account has more than one mailbox.
- Folders: Inbox, Sent, Trash (Quarantine and Screener in 3.2). Infinite scroll, pull to refresh, unread styling, star.
- Message view: header (from / to / cc / date), SPF·DKIM·DMARC chips, "delivered to alias" line, attachments list (open/share), body.
  - HTML is rendered in a WebView with **JavaScript off**, a CSP that blocks all remote loads, and links opened in the system browser.
  - "Show images" rewrites `<img>` to signed, short-lived URLs on our image proxy, so senders never see the phone's IP (same privacy model as web). See 4.2.
  - Plain-text fallback and a "Show as text" toggle.
- Actions: mark read/unread, star, move to Trash / Inbox, delete forever (from Trash), swipe actions on list rows.
- Search (per mailbox, all folders) using `/api/search`.
- Compose, reply, reply-all, forward using `/api/messages/:id/reply` prefill and `/api/send`.

### 3.2 Screener + Quarantine
- Screener tab: new senders grouped, Allow / Allow domain / Block (already started).
- Quarantine list with expiry countdown, "Trust sender" (moves to inbox + whitelists), Delete, "Empty quarantine".

### 3.3 Aliases
- List with usage meter (`count / max`), mode badge, forward target, counts.
- Create alias (label, optional expiry), copy address to clipboard, share.
- Edit label and delivery mode (Store / Forward / Both), pick forward target.
- Report abuse / restore, delete.
- Forward targets: add (sends verification email), resend, delete; verified state shown.

### 3.4 Push notifications
- Ask for notification permission after first sign-in (Android 13+ runtime permission).
- Register the Expo push token on the current device (`PUT /api/auth/devices/me/push`).
- Notify on new mail that lands in **Inbox** only (Screener/Quarantine never notify — that is the product).
- Per-device toggle "Show sender and subject" (default on). Off → "New message in you@zero-spam.email".
- Tap opens the message.
- Sign-out and token revocation stop pushes immediately.

### 3.5 Account deletion (Google Play requirement)
Apps that create accounts must offer deletion inside the app and on the web.
- More → Delete account, confirmed with the password (and the 2FA code when enabled). `POST /api/account/delete`.
- Public page `https://zero-spam.email/delete-account` explaining how to delete, with an email route for people without the app.
- The deletion cancels any Stripe subscription first, and aborts if that fails. It then deletes mailboxes, mail (rows and files), aliases, rules, drafts, connections, forwarding addresses, users and devices.
- Domain rows are never deleted. The shared signup domain holds the DKIM key published in DNS.
- Deleted addresses and aliases go into `retired_addresses` and can never be claimed again.

### 3.6 Out of scope for v1
Drafts list/editing, attachments in compose, whitelist rule editor, digest settings, TOTP setup, password change, connected Gmail/Outlook accounts, billing management. All stay on web; More links to the website for them (except billing, see §2).

## 4. Server changes

### 4.1 Push
- `PUT /api/auth/devices/me/push` `{ token: string|null, showPreview?: boolean }` — device (Bearer) auth only; stores `devices.expo_push_token` (column exists) and new `devices.push_preview` (default 1).
- `server/src/push.ts`: subscribes to the event bus; on `message:new` with `folder === 'inbox'`, finds non-revoked devices with a push token for users in the mailbox's account, and POSTs to `https://exp.host/--/api/v2/push/send` in batches of 100. Tickets with `DeviceNotRegistered` clear the token. Fire-and-forget; failures are logged, never block ingest. Off unless `PUSH_ENABLED=true`.
- Payload: `{ title, body, data: { messageId, mailboxId } }`, Android channel `mail`.
- Unpaid (not entitled) accounts get no push — matches the paywall.

### 4.2 Signed image proxy for the app
- `POST /api/messages/:id/remote-images` → `{ map: { [originalUrl]: signedUrl } }` for every `http(s)` `<img src>` in the message.
- `GET /public/img?u=<url>&e=<exp>&s=<hmac>` — HMAC-SHA256 over `u|e` with a server secret, 1-hour expiry, then the same SSRF-safe fetch as `/api/proxy/image`. Needed because a WebView can't attach the Bearer header to image requests.

### 4.3 Fixes found while reading the code
- `/api/events` (SSE) currently broadcasts every account's message IDs to every signed-in client. Filter events to mailboxes the caller owns.

## 5. Release (Play internal testing)
1. Google Play Console account ($25 one-time) → create app "ZeroSpam", package `email.zerospam.app`.
2. Expo account → `eas init` in `apps/mobile`, which writes the real `projectId`.
3. Firebase project → add Android app with the same package → upload the FCM v1 service-account key to Expo (`eas credentials`).
4. `eas build -p android --profile production` → `.aab`; first upload is manual in Play Console (Internal testing), later `eas submit`.
5. Play listing basics: privacy policy URL `https://zero-spam.email/privacy-policy`, Data safety form (email address, messages; encrypted in transit; account deletion via website), content rating, testers list.

Step-by-step commands live in `docs/android-release.md`.

## 6. Testing
- `npm run typecheck:mobile`, `npm run lint:mobile`.
- Unit tests (jest-expo) for pure logic: HTML body builder, image rewrite, address parsing, 402 handling.
- Server vitest for push dispatch, device push endpoint, signed image URLs, SSE filtering.
- Manual: Expo Go / development build on a real Android phone against production.

## 7. Delivery
Four PRs, each mergeable on its own:
1. This spec + foundation + core mail (+ signed image proxy).
2. Screener, Quarantine, Aliases.
3. Push notifications (server + app) + SSE fix.
4. Account deletion, release config, and `docs/android-release.md`.
