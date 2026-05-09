# Landing Page + Email-OTP Auth — Design Spec

**Status:** approved 2026-05-09. Ready for implementation plan.
**Brand reference:** [`docs/brand/zerospam-vibe.md`](../../brand/zerospam-vibe.md) (Reading Room v2).
**Scope reference:** Phase 1 + Phase 2 are shipped. This spec extends the auth subsystem and replaces the marketing surface.

## Overview

Two coupled changes:

1. **Landing page** — replace the existing SaaS-toned `Landing.tsx` with a Reading Room v2 editorial page (cream paper, italic Source Serif, sunshine-yellow accent). Six sections, manifesto-toned voice.
2. **Email-OTP primary auth** — passwordless 6-digit-code login as the default path. Signup is gated by single-use invite codes. Successful OTP issues a 30-day trusted-device cookie that lets returning logins skip OTP. Password and TOTP remain available as an opt-in second path for users who set them.

The product position — *your inbox is by invitation; everything else expires* — drives both pieces. The landing page asserts the position; the auth flow enforces it.

## Goals

- Landing page reads in under 90 seconds and clearly states the manifesto.
- A first-time user with an invite link can claim their inbox in under 2 minutes without choosing a password.
- A returning user on a trusted device signs in in one click + one form post.
- A returning user on a new device signs in in under 60 seconds (email → code → in).
- No passwords required anywhere by default. Power users can add one in settings.

## Non-goals

- Webmail UI, three-pane layout, compose, screener — out of scope.
- Self-serve waitlist or invite-request flow — invite codes are owner-generated.
- Dark mode — reserved tokens exist in the vibe doc; not implemented here.
- Admin UI for invite-code generation — CLI only for v1.
- Account recovery without email access — explicitly deferred.

## Architecture

### File-level changes

- `web/src/components/Landing.tsx` — full rewrite to Reading Room v2.
- `web/src/components/EmailEntry.tsx` — new. First-step "enter your email" screen.
- `web/src/components/OtpEntry.tsx` — new. Six-digit code grid screen.
- `web/src/components/PasswordEntry.tsx` — new. Optional second-step for users with a password set.
- `web/src/components/TotpEntry.tsx` — new. Third-step for users with TOTP enabled. Reuses `<OtpGrid>`.
- `web/src/components/Signup.tsx` — rewritten. Reads `?invite=` URL param; rejects without it.
- `web/src/components/LoginForm.tsx` — deleted; replaced by composition of the three screens above.
- `web/src/components/brand/` — new directory with shared editorial primitives (see Visual system).
- `web/src/styles.css` + `web/tailwind.config.js` — Reading Room tokens added alongside legacy `zs*` tokens.
- `web/index.html` — Source Serif 4, Geist, JetBrains Mono from Google Fonts.
- `server/src/api.ts` — new endpoints listed under Auth flow.
- `server/src/auth/otp.ts` — new module (request, verify, rate-limit, attempt count).
- `server/src/auth/invite.ts` — new module (redeem, generate-CLI helper).
- `server/src/auth/trusted-devices.ts` — new module (issue cookie, validate, revoke).
- `server/src/auth/emails.ts` — new module with `otp_login.eml.ts` and `otp_signup.eml.ts` templates.
- `server/src/db.ts` — schema migration adding `otp_codes`, `invite_codes`, `trusted_devices`.
- `server/src/cli/invite-create.ts` — new CLI script. Wired up as `npm run invite:create`.

### What stays the same

- argon2id password hashing.
- HMAC-signed session cookie format and `sessions` table.
- Audit log (`audit_log`).
- Existing per-IP login rate-limit.
- TOTP for users who pair it with a password.
- DKIM signing on outbound email.

## Landing page

Six editorial sections plus header, footer, and a single product moment. Cream paper background (`--paper`), 6%-opacity SVG turbulence overlay for grain, italic Source Serif display, Geist body, JetBrains Mono marginalia.

### Header bar

One hairline rule, edge-to-edge. Left: italic *Zero·Spam* wordmark, 38px Source Serif; the `·` is the yellow accent. Right: mono colophon `EST · MMXXVI · BY INVITATION ONLY · vol. 01 / no. 01` and a quiet `[ SIGN IN ]` link.

### 01 — HERO (`DEFAULT-DENY INBOX`)

- Marginalia label above headline in mono small caps with hairline tick.
- Headline italic Source Serif 96px, two lines: *"Your inbox is by invitation. Everything else expires."*
- The phrase *by invitation* carries a yellow underline that wipes in 700ms once after page load.
- Lede paragraph in Source Serif 22/1.45, indented to columns 5–10, two sentences.
- Primary CTA: hairline border, mono label `[ SIGN IN ↗ ]`. Hover fills yellow.
- Mono caption beneath: `// got an invite? redeem here →` linking to `/signup` (which 404s without `?invite=`).

### 02 — THE FLOW (`THE FLOW — A 30-SECOND TOUR`)

Hard ink rule with mono drop-label. One product moment: a real Screener UI screenshot, full-bleed, dead-center, no perspective tilt, sharp pixels. Beneath: an italic-serif intro line + two Geist body lines explaining the screener moment.

### 03 — THE MANUAL (`THE MANUAL — 03 PRINCIPLES`)

Hard rule with mono drop-label. Three columns separated by hairlines. Each column:

- Mono ID (`01.`, `02.`, `03.`).
- Italic Source Serif heading led by a yellow square bullet.
- Three lines of body in Geist.

Principles (final copy):

- **01. By invitation.** Default-deny inbox. ZeroSpam doesn't filter, score, or guess. It asks. You answer.
- **02. Quarantine that expires.** Anything not whitelisted lands in quarantine and auto-expires on a schedule you set — 168 hours by default. No backlog. No inbox debt.
- **03. Trust as a graph.** Reply to someone, they're trusted. Approve a sender once, they stay approved. Your network compounds.

### 04 — WHO (`WHO`)

Hard rule. One short paragraph, lede-style serif at 22/1.45. No persona cards, no logo strip.

> *ZeroSpam is for people whose attention is a working tool — founders, makers, and anyone whose calendar is an output, not an input. If your inbox is also your todo list, this isn't for you.*

### 05 — THE QUESTIONS (`THE QUESTIONS`)

Hard rule. Four Q&As with hairlines between. Mono `Q.` label, italic serif question, Geist answer. Drafts:

- *Why no password by default?* — A password is a thing to remember and a thing to lose. Email control is the proof we need; the code arrives in the place you already check.
- *What does "expire" actually mean?* — Quarantined messages auto-delete after 168 hours by default. You can lower the TTL. Nothing builds up to triage.
- *Can I keep my old address?* — Yes. Forward your existing inbox to your new ZeroSpam handle and let unknown senders pass through the screener.
- *Why invitation-only?* — Because the manifesto only works when the people on it agree to it. Invitations keep the room small, and the screener less noisy.

### 06 — CLOSER (`THE CLOSER`)

Hard rule. Restated invitation in italic Source Serif 64px: *"Your inbox is by invitation."* Hairline button `[ SIGN IN ↗ ]` and `// got an invite?` mono link.

### Footer

Hairline rule, mono only. Site URL · privacy · terms · github · `vol. 01 / no. 01 · est mmxxvi`.

### Motion budget

Page load: staggered reveal of wordmark → headline → lede → CTA → footer rule, ~120ms cascade, total under 700ms. Yellow underline-wipe on *by invitation* once after page-load (700ms, `cubic-bezier(0.85, 0, 0.15, 1)`). Hover: 180ms color transitions; CTA fills yellow. Click: scale 0.98, 150ms. All gated on `prefers-reduced-motion: no-preference`.

## Auth flow

### Returning login (the common path)

```
landing → [SIGN IN ↗] → /login (email-entry)
  → POST /api/auth/otp/request → server returns {next_step}
       'password'    → /login/password           (trusted device + password set)
       'otp'         → /login/code               (OTP-only account, or OTP step before password)
  → on /login/code success:
       has_password? → /login/password           (OTP done, password is the second factor)
       else          → set 30-day trust cookie if checkbox set → /webmail
  → on /login/password success:
       totp_enabled? → /login/totp               (third factor)
       else          → /webmail
```

**Email-entry screen** (`/login`)

- Single editorial input, hairline-only, floating mono label `EMAIL`.
- Submit `[ CONTINUE ↗ ]`.
- Footer: `// got an invite? redeem here →`.
- Submit posts `POST /api/auth/otp/request {email}`. Server response is uniform regardless of whether the email is registered: `{next_step: 'otp' | 'password'}`. Server returns `'password'` only when (a) the email matches a real user, (b) the user has a password set, and (c) the trust cookie validates against a non-revoked `trusted_devices` row. Otherwise it returns `'otp'`. Unknown emails always return `'otp'` with no email actually sent — the response shape is identical, the timing is constant-padded.

**OTP-entry screen** (`/login/code`)

- Headline italic serif: *"Check your email."*
- Lede: *"We sent a six-digit code to `you@gmail.com`. It expires in 10 minutes."* (The masked email shows the local-part trimmed to first letter + `…` + last letter, then the full domain.)
- Six monospace input boxes, JetBrains Mono 28px, hairline-bottom each. Auto-advance on type. Paste-aware (paste 6 digits → fills all). Backspace at empty box steps back.
- `[ VERIFY ↗ ]` button, fills yellow on hover.
- `// resend code` link, disabled for 30s after last send. Clicking re-issues a fresh code; the old code is invalidated.
- `// trust this device for 30 days` checkbox, defaults ON.
- Errors: wrong code → "That code didn't match. Try again." After 5 failed attempts on a single code → code is invalidated server-side, screen shows "Too many attempts. Request a new code."

**Password-entry screen** (`/login/password`)

Reached either (a) directly from `/login` when the trust cookie is valid AND the user has a password set, or (b) from `/login/code` after a successful OTP when the user has a password set on a non-trusted device. Shows email (read-only), password input. Submit posts `POST /api/auth/login`. If TOTP is enabled, on success redirects to `/login/totp` instead of `/webmail`. The existing per-IP login rate-limit applies.

**TOTP-entry screen** (`/login/totp`)

Only reached when the user has TOTP enabled. Six-digit input (same `<OtpGrid>` primitive as email-OTP, but visually labeled `AUTHENTICATOR CODE`). Submit posts the existing TOTP-verify path. On success, sets the 30-day trust cookie if the email-OTP checkbox was on, then redirects to `/webmail`.

### Signup (invite-gated)

```
/signup?invite=ABCD-EFGH-1234
  → invite param missing or invalid → manifesto screen + /login link
  → invite valid → signup form
  → submit → POST /api/auth/invite/redeem → OTP sent → /signup/code
  → verify → user + mailbox created → 30-day cookie issued → /webmail with welcome tour
```

**Invite redemption screen** (`/signup`)

- Without `?invite=` or with invalid/expired/used invite, render a manifesto-toned screen:
  > *ZeroSpam is by invitation.*
  > If you have an invite, the link will include it. If not, you can [sign in](/login) instead.
- With a valid invite, render the form:
  - `USERNAME` — your `@zero-spam.email` handle. Live preview: `alice@zero-spam.email`. Lowercase, `[a-z0-9._-]+`, 3–32 chars.
  - `EMAIL` — where verification and recovery messages go.
  - `NAME` (optional) — display name.
  - `[ CLAIM YOUR INBOX ↗ ]` posts `POST /api/auth/invite/redeem {invite, username, email, name}`. Server validates invite, validates username availability, creates a *pending* user row, and sends the OTP. Pending users are committed to `users` only after OTP verify (so abandoned signups don't reserve usernames).

**OTP-entry screen** (`/signup/code`)

Same component as login OTP. On verify, the pending signup is finalized: user row created, mailbox provisioned, invite `used_count` incremented in the same SQL transaction, 30-day cookie issued, redirected to `/webmail`.

### Invite-code generation (out of UI scope, owner-only)

CLI: `npm run invite:create [-- --max-uses 1 --expires-in 30d --note "for jane"]`. Generates a 12-character code from an unambiguous alphabet (no `I`, `O`, `0`, `1`), inserts a row into `invite_codes`, prints the redemption URL `https://zero-spam.email/signup?invite=...`. Owner shares the URL directly. A future admin panel can replace the CLI but is not required for v1.

### Trusted devices

**Cookie** — `zs_trust=<HMAC(device_id, user_id, exp) | device_id | user_id | exp>`, 30-day expiry, `HttpOnly`, `SameSite=Lax`, `Secure` in production, signed with `SESSION_SECRET`. Independent of the session cookie — sessions can roll, trust persists.

**Server table `trusted_devices`** — see schema below. Indexed on `(user_id, revoked_at)` for fast lookup of active devices.

**Lifecycle**

- Issued on first successful OTP verify when "trust this device" checkbox is on. Server inserts a `trusted_devices` row with a freshly generated `device_id`, then sets the cookie.
- Re-validated on each `/api/auth/otp/request` call: cookie HMAC valid, row not revoked, `created_at + 30d > now`. Validation failure clears the cookie and falls through to OTP.
- Revoked by user from settings (`DELETE /api/auth/devices/:id`) or automatically on password change, password removal, TOTP enable, TOTP disable, or any sensitive operation.
- `last_seen_at` and `ip_last` are bumped on each successful validation.

### Password (optional, set in settings)

- First-time set: `POST /api/auth/password {new}` requires a fresh OTP token (issued via the `password_set` purpose). Server consumes the OTP token in the same transaction.
- Change: `POST /api/auth/password {current, new}` requires both the current password and a fresh OTP token.
- Remove: `DELETE /api/auth/password` requires a fresh OTP token. Reverts the account to OTP-only.
- All three operations revoke every existing trusted device.

### TOTP (preserved)

- Available only to users with a password set. Pairs with password, not with email-OTP. (Email-OTP is itself a knowledge proof of email control; layering TOTP on top would be redundant for an OTP-only account.)
- When TOTP is enabled, the password-entry screen extends to require a TOTP code as a third factor (email-trust cookie + password + TOTP).
- Enable: requires password + fresh OTP, then a TOTP code to confirm.
- Disable: requires password + current TOTP + fresh OTP.

### Backend endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/otp/request` | none | Issue OTP for `email`, return uniform response. |
| `POST` | `/api/auth/otp/verify` | none | Verify OTP for `(email, code, purpose)`, issue session + optional trust cookie. |
| `POST` | `/api/auth/invite/redeem` | none | Redeem invite, create pending user, issue OTP with `signup` purpose. |
| `POST` | `/api/auth/login` | none | Existing password endpoint. Now requires trust cookie or fresh OTP token. |
| `POST` | `/api/auth/password` | session | Set or change password (requires fresh OTP token). |
| `DELETE` | `/api/auth/password` | session | Remove password (requires fresh OTP token). |
| `GET` | `/api/auth/devices` | session | List the calling user's trusted devices. |
| `DELETE` | `/api/auth/devices/:id` | session | Revoke a trusted device. |
| `POST` | `/api/auth/logout` | session | Existing endpoint. Also clears trust cookie when called with `?revoke_trust=1`. |

### Backend tables (new)

```sql
CREATE TABLE otp_codes (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','signup','password_set','sensitive_op')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  signup_payload TEXT
);
CREATE INDEX idx_otp_email_active ON otp_codes(email, consumed_at);

CREATE TABLE invite_codes (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE trusted_devices (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  ua TEXT,
  ip_first TEXT,
  ip_last TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX idx_trusted_user_active ON trusted_devices(user_id, revoked_at);
```

`signup_payload` on `otp_codes` is a JSON blob holding the pending signup form data (`username`, `email`, `name`, `invite`) so we can finalize on verify without a second client round-trip.

### Rate limits & abuse

- `POST /api/auth/otp/request` — 5 per email per hour, 20 per IP per hour.
- `POST /api/auth/otp/verify` — 10 per email per hour, 30 per IP per hour. After 5 failed attempts on a single code, the code row is marked consumed.
- `POST /api/auth/invite/redeem` — 30 per IP per hour.
- All three log to `audit_log` with reason codes (`otp_request`, `otp_verify_ok`, `otp_verify_bad_code`, `otp_attempts_exhausted`, `invite_redeem_ok`, `invite_redeem_used`, `invite_redeem_expired`).

### Email delivery

Reuses the existing nodemailer setup. New module `server/src/auth/emails.ts` exports `sendOtpEmail({ to, code, purpose })`. Two templates:

- `otp_login.eml.ts` — subject *"Your ZeroSpam sign-in code"*. Body in plain-text with a leading italic-feeling line and the code on its own line in a mono code block. DKIM-signed.
- `otp_signup.eml.ts` — subject *"Claim your ZeroSpam inbox"*. Same structure, different lede.

In `loopback` mode (dev), OTP emails route through the local SMTP and land in the user's own ZeroSpam inbox so devs test end-to-end without a relay. In `relay` mode, the email is shipped via `RELAY_HOST` to the user's external email.

## Visual system

Tokens (added to `web/src/styles.css` as CSS variables, exposed via Tailwind):

```css
--paper: #FBF8F1;        --paper-deep: #F5EFE3;
--ink:   #0A0A0A;        --ink-soft:   #2A2A2A;
--quiet: #6B6863;
--rule:  #E8E1D2;        --rule-strong: #1F1F1F;
--signal: #FFD52E;       --signal-ink:  #7A5C00;
--danger: #B53C2F;
--font-display: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
--font-body:    'Geist', 'Helvetica Neue', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

Tailwind extends with `paper`, `ink`, `signal`, `rule` color names and `display`, `body`, `mono` font families. Legacy `zs*` tokens stay; webmail uses them and is out of scope for this spec.

### Component primitives (`web/src/components/brand/`)

- `<Wordmark size="sm|md|lg" />` — italic *Zero·Spam* with the yellow `·`.
- `<MonoLabel>EST · MMXXVI</MonoLabel>` — uppercase, 0.06em tracking.
- `<HardRule label="THE MANUAL — 03 PRINCIPLES" />` — 1px ink line with a mono drop-label punching through (label has `--paper` background to clear the rule visually).
- `<Hairline />` — 1px `--rule`.
- `<EditorialButton variant="primary|ghost">[ SIGN IN ↗ ]</EditorialButton>` — hairline border, mono uppercase label, fills yellow on hover, scale 0.98 on click.
- `<EditorialInput label="EMAIL" />` — hairline-bottom only, floating mono label, focus thickens hairline to 2px.
- `<OtpGrid value={code} onChange={...} disabled? />` — six monospace boxes, paste-aware, auto-advance, backspace-aware.
- `<YellowDot />` — the brand symbol, 6×6 with `border-radius: 1px` (typewriter-square).

### Paper grain overlay

A single fixed `<div>` behind everything with a `background-image` of an inline SVG `<feTurbulence baseFrequency="0.9" numOctaves="2">` rendered to a 200×200 tile, opacity 6%. `pointer-events: none`. Disabled under `prefers-reduced-motion`? — no; grain is static, not motion. Always on.

### Dark mode

Out of scope. `--paper-dark: #161310` and `--ink-dark: #F0EBDF` are reserved per the vibe doc but not implemented.

## Testing

### Server (vitest, `server/test/`)

- `auth.otp.test.ts` — request → captured email body contains a 6-digit code → verify → session created. Wrong code, expired code, exhausted attempts (5 → invalidated), replay (consumed code rejected), unknown email returns uniform `{sent: true}` and creates no row.
- `auth.invite.test.ts` — valid invite redeems once and increments `used_count`. Expired and used invites reject. Username collision rejects. Two concurrent redeems of the same single-use invite: one wins with `200`, the other gets `409 Conflict`.
- `auth.trusted-devices.test.ts` — cookie issued on OTP success when checkbox set, not issued otherwise. Skip-OTP path on subsequent login when password is also set. Revoke clears skip. Password change revokes all devices.
- `auth.rate-limit.test.ts` — 6 OTP requests in an hour → 6th rejected. 5 wrong verifies on one code → code invalidated.
- `auth.password.test.ts` — first-time set requires fresh OTP. Change requires current + OTP. Remove requires OTP. Each operation revokes trusted devices.

### Web (vitest + RTL, `web/src/components/__tests__/`)

- `Landing.test.tsx` — renders all six section labels (`DEFAULT-DENY INBOX`, `THE FLOW`, etc.), headline contains the literal "by invitation", primary CTA `aria-label` is "Sign in", footer link to invite redemption.
- `EmailEntry.test.tsx` — empty submit blocked. Valid submit calls `POST /api/auth/otp/request` and navigates to `/login/code`. Server error renders inline.
- `OtpEntry.test.tsx` — paste 6 digits fills all boxes. Auto-advances on keypress. Backspace at empty box steps back. Resend disabled for 30s after page load. Trust-device checkbox default on. Wrong code shows the inline error.
- `Signup.test.tsx` — without `?invite=` shows manifesto + sign-in link. With invalid invite shows error. With valid invite shows form. Submit calls redeem endpoint and navigates to `/signup/code`.
- `brand/EditorialButton.test.tsx`, `brand/OtpGrid.test.tsx` — primitive smoke tests.

### Test database

All server tests hit a fresh in-memory SQLite (existing pattern in `server/test/`). Email delivery is captured via a test transport injected into `nodemailer`; assertions read the captured `mail.text`.

## Error handling & edge cases

- **Email enumeration** — `POST /api/auth/otp/request` always returns `200` with the uniform shape regardless of whether the email is registered. If unregistered, no email is sent and no `otp_codes` row is created. Response timing is constant-padded to ~200ms.
- **OTP collision** — when a request arrives for an `(email, purpose)` that already has a non-consumed unexpired row, the existing row is marked consumed and a fresh row is created. Only one active OTP per `(email, purpose)` at a time.
- **Invite race** — `invite_codes.used_count` is incremented in the same SQL transaction that creates the user. Single-use invite + concurrent redemptions: one wins with `200`, others get `409 Conflict`.
- **Email delivery failure** — `/otp/request` waits for `nodemailer.sendMail()` to resolve before returning. On error, returns `503 {error: "email_failed", retry_after: 30}`. UI shows "We couldn't send the code right now. Try again in 30s."
- **Clock skew** — `expires_at` is computed server-side at insert. UI shows a relative countdown but the server is authoritative.
- **Trusted-device cookie corruption** — bad HMAC or DB row not found clears the cookie and falls through to OTP. Logged to audit.
- **Pending signup expiry** — pending signups live in `otp_codes` only (with `signup_payload`); they never reach `users` until verify. If the OTP expires, the username is freed automatically.
- **Existing users** — the 10 demo/test users keep their password+TOTP. They can also use OTP login once the new endpoints ship. No destructive migration.

## Open questions (deferred)

- Account recovery when email access is lost. v1 punts; recovery requires email control by design.
- Admin UI for invite-code management. CLI is sufficient for v1.
- WebAuthn / passkey support as a third path. Not in v1; the design leaves room to add as a peer of "password" without disturbing OTP.
