# ZeroSpam Email

Whitelist-first SMTP server + Outlook-style webmail. Default-deny inbox; non-whitelisted mail goes to quarantine and auto-deletes after a TTL. DKIM-signed outbound. Sandboxed HTML rendering with image-blocking. Keyboard-driven UI.

## What it does

### Receive
- **SMTP receive** on port 2525 (configurable). Hooks into a shared ingest pipeline.
- **Whitelist engine** — exact address, domain, or regex rules per mailbox. Whitelist match → inbox; everything else → quarantine.
- **SPF/DKIM/DMARC** verification via `mailauth`, surfaced as colored chips in the reading pane. Auth result is *recorded*, not enforced — whitelist always wins for routing, but a DMARC-fail flag is shown.
- **Quarantine + TTL** sweeper runs every minute. Default 168 h (7 days), configurable per mailbox.
- **Sender display-name spoof detection** — flags "PayPal Support" <support@notpaypal.io>-style mismatches in real time.

### Send (Phase 2)
- **POST `/api/send`** — DKIM-signed outbound via nodemailer. Default `loopback` mode submits SMTP back to our own server (so messages to local mailboxes round-trip through ingest). Set `SEND_MODE=relay` + `RELAY_HOST/PORT/USER/PASS` to ship through a real relay.
- **Per-domain DKIM** — RSA-2048 keypair generated automatically when a domain is created (or via reseed). Public key exposed at `/api/domains/:id/dns` as a ready-to-paste TXT record (`<selector>._domainkey.<domain>`). The selector defaults to `zs1`.
- **Trust on first send** — every recipient you send to is auto-added to your mailbox's whitelist, so their replies bypass quarantine.
- **Compose UI** — three-pane modal with from/to/cc/subject/body. Sent copies land in the Sent folder.

### UI
- Three-pane Outlook layout (sidebar | message list | reading pane).
- **Full-text search** (SQLite FTS5) across subject + sender + body, ranked by relevance. `/` to focus.
- **Bulk select + actions** — checkboxes, mark read/unread, trust senders, move to inbox/trash, delete forever.
- **Sandboxed HTML** rendering in an iframe with `sandbox=""` and a strict CSP. Remote content (images, fonts) blocked by default; one-click toggle to allow per-message — kills tracking pixels.
- **Attachments** — listed with size + content type, click to download.
- **Mailbox manager** modal — add new mailboxes, edit per-mailbox quarantine TTL, delete mailbox + all mail.
- **DKIM/DNS panel** — copy-pasteable TXT record per domain, with `dig` instructions.
- **Keyboard shortcuts** (press `?` in the UI):
  - `j` / `k` — next / prev
  - `Enter` — open
  - `s` — star, `u` — read/unread, `t` — trust sender, `e` — trash, `#` / `Del` — delete
  - `x` — toggle bulk-select for current row, `Shift+A` — select all
  - `/` — focus search, `?` — help, `Esc` — clear / close
- **Test injector** — three preset mails (whitelisted, spam, github) hit the same ingest pipeline as real SMTP, no DNS required.

## Quick start

```bash
npm install
npm run seed       # creates the default domain/mailbox/whitelist + DKIM keys
npm run dev        # SMTP :2525, API :8025, web :5173
```

Open <http://localhost:5173>.

Fire test mails via the UI's **Test Injector** (sidebar) or the CLI:

```bash
npm run inject -- --to sreekanth@researchbot.co --from boss@trusted.com  --subject Hi --text "trust me"
npm run inject -- --to sreekanth@researchbot.co --from spam@evil.io      --subject "Buy crypto" --smtp
```

`--smtp` exercises the real SMTP path on port 2525; without it, the script feeds the ingest pipeline directly. The first lands in **Inbox** (whitelisted), the second in **Quarantine** with a 7-day TTL.

Click **Compose** in the sidebar to send a DKIM-signed message back to yourself — it round-trips through the local SMTP server and appears in your Inbox.

## Layout

```
server/  Node.js SMTP + Fastify API + SQLite (node:sqlite) + sweeper + DKIM + nodemailer
web/     Vite + React + Tailwind webmail UI
shared/  (reserved)
```

## Configuration

`server/.env` (copy from `.env.example`):

```
SMTP_PORT=2525
API_PORT=8025
DATA_DIR=./data
QUARANTINE_TTL_HOURS=168
SWEEPER_INTERVAL_SEC=60
LOG_LEVEL=info

# Outbound
SEND_MODE=loopback                # loopback | relay
DKIM_SELECTOR=zs1
RELAY_HOST=smtp.your-relay.com
RELAY_PORT=587
RELAY_USER=
RELAY_PASS=
RELAY_SECURE=false                # true for implicit-TLS port 465
```

## Deployment

To accept mail at `you@yourdomain.com` from the public internet you need:

### 1. A public host
- A VPS (Hetzner, OVH, Vultr, AWS EC2, etc.) with a static IP.
- Open inbound TCP **25** for incoming mail and **587** if you also want submission.
- A clean IP reputation. New IPs may need a warm-up period; some hosting providers block port 25 by default (e.g. AWS EC2 — request unblock or use SES).

### 2. DNS records (replace `mail.yourdomain.com` and `203.0.113.10`)

| Type   | Name                              | Value                                                                       |
|--------|-----------------------------------|-----------------------------------------------------------------------------|
| `A`    | `mail.yourdomain.com`             | `203.0.113.10`                                                              |
| `MX`   | `yourdomain.com`                  | `10 mail.yourdomain.com.`                                                   |
| `TXT`  | `yourdomain.com`                  | `v=spf1 mx -all`                                                            |
| `TXT`  | `zs1._domainkey.yourdomain.com`   | (from **DKIM/DNS** panel — `/api/domains/:id/dns`)                          |
| `TXT`  | `_dmarc.yourdomain.com`           | `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com`                   |
| `PTR`  | (reverse DNS for `203.0.113.10`)  | `mail.yourdomain.com` — set with your hosting provider                      |

Verify each: `dig MX yourdomain.com`, `dig TXT zs1._domainkey.yourdomain.com`, etc.

### 3. Ports + TLS
- For receiving on **port 25**: run the server as root (or `setcap cap_net_bind_service=+ep $(which node)`) so it can bind low ports. Or front it with a reverse proxy that forwards to 2525.
- For real production, terminate TLS via a reverse proxy (Caddy / nginx) or extend `smtp-server` config with a cert.

### 4. Outbound: relay vs direct
- **Relay (recommended for getting started)**: set `SEND_MODE=relay` and configure `RELAY_HOST/PORT/USER/PASS`. Use Mailgun, Postmark, AWS SES, your-own-Postfix, etc. The relay handles MX lookup, retries, and bounces.
- **Direct MX**: not implemented. Building a production-grade direct-MX sender means writing a queue with retries, bounce parsing, and reputation handling — a separate subsystem.

### 5. Persistence
- All state lives under `server/data/`: a single `zerospam.sqlite` (with WAL) plus a `maildir/` tree of raw `.eml` files and attachments. Back this up.

## Security model

- **Whitelist-first.** Default-deny inbox. Quarantined mail expires by TTL, no human review needed for the long tail.
- **Sandboxed HTML** in an iframe with `sandbox=""` (no scripts, no forms, no top navigation) and a strict CSP that blocks remote loads by default. Tracking pixels can't fire.
- **Spoof guards.** Display-name vs domain mismatch is flagged in the list and reading pane. DMARC failures are visible as a red chip.
- **DKIM signing on every send** — your outbound has a verifiable signature from day one.

## Phase status

- ✅ **Phase 1**: SMTP receive, whitelist, quarantine + TTL, REST API, three-pane UI, SSE updates, test injector
- ✅ **Phase 1+**: FTS5 search, attachments, sandboxed HTML rendering with image blocking, bulk select, keyboard shortcuts, mailbox manager, sender mismatch detection
- ✅ **Phase 2**: outbound send via nodemailer, per-domain DKIM signing + DNS panel, compose UI, trust-on-send

## Known caveats

- **No outbound queue.** `relay` mode delegates retry/bounce handling to your relay. There is no built-in retry-on-temporary-failure for direct delivery.
- **`mailauth` does real DNS lookups.** In dev, SPF/DKIM/DMARC results are usually `null` (inconclusive) because the test data doesn't have valid DNS published — that's expected and routing is whitelist-driven.
- **Loopback delivery is dev-only.** The `loopback` send mode never leaves localhost. Switch to `relay` (or wire up an MX) for real recipients.
- **No threading yet.** Messages are listed flat by date. Threading is a fair next addition.
