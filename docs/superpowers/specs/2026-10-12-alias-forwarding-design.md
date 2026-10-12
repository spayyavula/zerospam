# Alias Forwarding, Reverse-Alias Replies & Abuse Limits — Design Spec

**Date:** 2026-10-12
**Status:** Implemented on `feat/alias-forwarding`
**Scope:** Extends the existing disposable aliases (`aliases` table, `/api/aliases`, `AliasManager.tsx`) so an alias can deliver to the user's real inbox, the user can reply as the alias, and the domain is protected from abuse.

---

## 1. Overview

Today an alias such as `quiet-otter-x7k2@zero-spam.email` only delivers into the user's hosted ZeroSpam mailbox. This spec adds three things:

1. **Forwarding.** Each alias gets a delivery *mode* — `store` (today's behaviour), `forward` (relay to a verified external address, keep nothing), or `both`. Forwarding respects the whitelist: only whitelisted senders are forwarded; everyone else lands in quarantine exactly as today.
2. **Reverse-alias replies.** Every forwarded message carries a per-(alias, contact) *reverse address*. Replying from Gmail/Outlook sends to that reverse address; ZeroSpam rewrites the reply so it leaves from the alias and the contact never sees the user's real address.
3. **Abuse limits.** Per-account caps on aliases and forwarding targets, and hourly caps on forwards and replies, so one account cannot burn the shared domain's sending reputation.

## 2. Goals

- A user can point any alias at their real inbox and keep using it there, both receiving and replying.
- Mail is never silently lost: any forward that cannot happen (no verified target, rate limit, relay failure) falls back to storing the message in the mailbox.
- The user's real address never appears in anything sent to a contact.
- Forwarded and reply mail passes DMARC at Gmail/Outlook (From aligned with the DKIM-signing domain).
- No new infrastructure: inbound stays on our own SMTP server, outbound stays on the existing relay (SES in production).

## 3. Non-Goals (v1)

- Retroactively forwarding a message when its sender is trusted later from quarantine.
- Sending *new* (non-reply) mail from an alias to a contact who has never written in.
- Mobile app UI (API is ready; React Native / Flutter screens are a follow-up).
- Plan-based limits — limits are global env config until billing plans exist.
- Automatic abuse detection (e.g. auto-disable an alias after a quarantine spike). The manual block toggle remains.
- Scrubbing the user's identity from reply *bodies* (e.g. a signature containing their real address).

## 4. Why not SRS?

Classic forwarders re-send the original message unchanged and use SRS to rewrite the envelope sender. That does not work here: outbound goes through SES, which only relays mail whose `From` is on a verified identity, and an unchanged `From: someone@bank.com` would also fail DMARC at the destination. So forwarding **rewrites the From header** to the reverse alias on our own domain and DKIM-signs as that domain. The reverse alias is what makes replies work, so features 1 and 2 share one mechanism.

## 5. Architecture

### 5.1 Inbound flow

```
SMTP RCPT TO
  ├─ mailbox address ─────────────► ingest()  (unchanged)
  ├─ alias address  ──────────────► ingest()
  │                                   ├─ whitelist miss ─► quarantine (all modes)
  │                                   └─ whitelist hit
  │                                        ├─ mode=store  ─► inbox
  │                                        ├─ mode=both   ─► inbox + forwardAliasMessage()
  │                                        └─ mode=forward ─► forwardAliasMessage()
  │                                                            └─ on any failure ─► inbox (fallback)
  └─ reverse address ─────────────► handleReverseReply()
                                       ├─ sender = verified target AND DMARC pass ─► relay to contact as the alias
                                       └─ otherwise ─► drop + audit log
```

### 5.2 Components

| Module | Responsibility | Status |
|---|---|---|
| `server/src/mail-headers.ts` | Pure RFC 5322 header-block split / filter / rebuild, RFC 2047 encoding | New |
| `server/src/forwarding.ts` | Forward targets, reverse aliases, rate counters, `forwardAliasMessage()`, `handleReverseReply()` | New |
| `server/src/ingest.ts` | Mode-aware routing after the whitelist decision | Modified |
| `server/src/smtp.ts` | Accept reverse addresses at RCPT; route them to `handleReverseReply()`; 451 on reply rate limit | Modified |
| `server/src/sender.ts` | Export `buildTransport()` so forwarding reuses the relay config | Modified |
| `server/src/api.ts` | Forward-target routes, alias `PATCH`, alias usage, alias cap, public verify routes | Modified |
| `server/src/db.ts` | New tables + alias columns (idempotent) | Modified |
| `server/src/config.ts` | Limit and auth env vars | Modified |
| `server/src/usernames.ts` | Username availability also checks aliases and reverse aliases | Modified |
| `server/src/sweeper.ts` | Prune rate-counter rows older than 24 h | Modified |
| `web/src/components/AliasManager.tsx` | Mode picker, forwarding addresses, usage meter | Modified |

## 6. Data Model

```sql
CREATE TABLE forward_targets (
  id                INTEGER PRIMARY KEY,
  account_id        INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  verified_at       INTEGER,
  verify_token_hash TEXT,
  verify_expires_at INTEGER,
  created_at        INTEGER NOT NULL,
  UNIQUE(account_id, email)
);

CREATE TABLE reverse_aliases (
  id               INTEGER PRIMARY KEY,
  alias_id         INTEGER NOT NULL REFERENCES aliases(id) ON DELETE CASCADE,
  contact_address  TEXT NOT NULL,
  contact_name     TEXT,
  address          TEXT UNIQUE NOT NULL,   -- rv.<12 base36>@<alias domain>
  created_at       INTEGER NOT NULL,
  last_used_at     INTEGER,
  UNIQUE(alias_id, contact_address)
);

CREATE TABLE outbound_events (            -- rolling rate-limit counter
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK(kind IN ('forward','reply')),
  at          INTEGER NOT NULL
);

ALTER TABLE aliases ADD COLUMN mode TEXT NOT NULL DEFAULT 'store';      -- store | forward | both
ALTER TABLE aliases ADD COLUMN forward_target_id INTEGER REFERENCES forward_targets(id) ON DELETE SET NULL;
ALTER TABLE aliases ADD COLUMN forwarded_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aliases ADD COLUMN replied_count INTEGER NOT NULL DEFAULT 0;
```

Existing aliases default to `store`, so behaviour is unchanged on deploy. Deleting a target nulls `forward_target_id`; such aliases fall back to storing.

## 7. Forward Targets & Verification

- A target must be verified before an alias may forward to it.
- If the address equals a **verified login email** of a user in the same account, it is verified on creation (that address already proved ownership at signup).
- Otherwise ZeroSpam emails a link containing a random 32-byte token; only its SHA-256 is stored, with a 24 h expiry.
- `GET /public/forward/verify?t=…` renders a confirm page; `POST` performs the verification. This is the same GET-confirm / POST-act split as the digest routes, so link pre-fetchers in mail clients can't verify on the user's behalf.
- Targets on any domain hosted by ZeroSpam are rejected. That prevents forwarding loops.
- Cap: `FORWARD_TARGETS_MAX_PER_ACCOUNT` (default 5).

## 8. Forwarding

`forwardAliasMessage(raw, alias, sender)`:

1. **Loop guard.** If the message already carries `X-ZeroSpam-Forwarded`, do not forward it.
2. **Preconditions.** The alias must have a verified target, and the account must be under `ALIAS_FORWARD_MAX_PER_HOUR`.
3. **Reverse alias.** Get or create the reverse alias for (alias, original sender).
4. **Header rewrite.** Build the header block from an allowlist: `Subject, Date, Message-ID, MIME-Version, Content-Type, Content-Transfer-Encoding, Content-Language, In-Reply-To, References, List-Id, List-Unsubscribe, List-Unsubscribe-Post, Thread-Topic, Thread-Index`. Everything else is dropped: the original DKIM/ARC signatures, Received, Return-Path, Sender, Reply-To and so on. Then set:
   - `From: "Name (sender@x.com)" <rv.xxx@domain>`
   - `Reply-To: rv.xxx@domain`
   - `To` / `Cc`: the alias is kept as is. Every *other* address gets its own reverse alias, so reply-all also stays private.
   - `X-ZeroSpam-Forwarded: <alias address>`
5. **Body.** The body is passed through byte-for-byte, so MIME structure and attachments are untouched.
6. **Send.** Send via the relay with envelope `MAIL FROM:<bounces@domain>` and `RCPT TO:<target>`, DKIM-signed with the alias domain's key.

On any failure, `forward` mode stores the message in the inbox instead and logs the reason. `both` mode has already stored it.

## 9. Reverse-Alias Replies

`handleReverseReply(raw, reverseAddress, clientIp)`:

1. **Authorization.** The header `From` must equal the alias's verified target. When `ALIAS_REPLY_REQUIRE_DMARC=true` (the default), `mailauth` must also report DMARC pass, so nobody can spoof the user to write *as* their alias. Anything else is dropped and audit-logged (`alias.reply.rejected`).
2. **Rate limit.** Over `ALIAS_REPLY_MAX_PER_HOUR`, return SMTP `451 4.7.1` so the user's provider retries later and the reply isn't lost.
3. **Header rewrite.** Use the same allowlist as forwarding, minus the original `Message-ID`, which is replaced with `<nanoid@domain>` because the user's Message-ID reveals their provider. Then set:
   - `From: <alias address>`
   - `To` / `Cc`: reverse aliases are mapped back to the real contacts. The user's own target address, and any address not known to this alias, are removed.
4. **Send.** Send via the relay as `MAIL FROM:<bounces@domain>` to this reverse alias's contact only. In a reply-all, each reverse recipient is handled once, so each contact receives exactly one copy.
5. **Counters.** Bump `replied_count` and `last_used_at`.

## 10. Limits (env, global for now)

| Env var | Default | Effect when exceeded |
|---|---|---|
| `ALIAS_MAX_PER_ACCOUNT` | 50 | `POST /api/aliases` → 403 `alias limit reached` |
| `FORWARD_TARGETS_MAX_PER_ACCOUNT` | 5 | `POST /api/forward-targets` → 403 |
| `ALIAS_FORWARD_MAX_PER_HOUR` | 200 | message stored instead of forwarded |
| `ALIAS_REPLY_MAX_PER_HOUR` | 50 | SMTP 451, sender retries |
| `ALIAS_REPLY_REQUIRE_DMARC` | `true` | replies without DMARC pass are dropped |

`outbound_events` rows older than 24 h are pruned by the sweeper.

## 11. API

| Method & path | Notes |
|---|---|
| `GET /api/aliases` | Each row now includes `mode`, `forward_target_id`, `forward_target_email`, `forwarded_count`, `replied_count` |
| `POST /api/aliases` | Accepts optional `mode`, `forwardTargetId`; enforces the alias cap |
| `PATCH /api/aliases/:id` | `{ mode?, forwardTargetId?, label? }`; a non-`store` mode requires a verified target owned by the account |
| `GET /api/aliases/usage` | `{ count, max }` for the account |
| `GET /api/forward-targets` | Lists the account's targets |
| `POST /api/forward-targets` | `{ email }` → `{ id, email, verified }`; sends a verification email if needed |
| `POST /api/forward-targets/:id/resend` | New token + email; 409 if already verified |
| `DELETE /api/forward-targets/:id` | Aliases using it fall back to storing |
| `GET` / `POST /public/forward/verify` | Confirm page / perform verification; rate-limited |

## 12. Edge Cases

- **Spoofed whitelisted sender (explicit DMARC fail).** Never forwarded. The rewrite re-signs mail as our domain, which would launder a spoof into a DMARC pass at the user's inbox. The message is stored instead, where the reading pane shows the DMARC-fail chip.
- **Alias blocked or expired.** RCPT is rejected exactly as today, and reverse aliases of a blocked alias are rejected as well.
- **Alias deleted.** Its reverse aliases cascade away, and later replies bounce with 550.
- **Target deleted mid-flight.** The forward finds no target and falls back to storing.
- **Sender appears in both To and Cc.** Addresses are deduplicated before reverse aliases are minted.
- **Very long or non-ASCII display names.** Encoded as RFC 2047 UTF-8 base64 in encoded-words of at most 75 characters. Address lists are folded between entries.
- **Username collision.** Signup availability now also checks `aliases` and `reverse_aliases`, which fixes a pre-existing gap where a username could shadow an alias.
- **SES sandbox.** While SES is sandboxed it only delivers to verified identities. Production access is a prerequisite (see `docs/deploy-runbook.md`).

## 13. Testing

- **Unit (pure):** `mail-headers.ts`. Covers folding, continuation lines, allowlist filtering, RFC 2047 encoding and address-list rewriting.
- **Integration (vitest, nodemailer mocked and captured):**
  - Each mode × whitelist hit/miss.
  - Fallback on missing target, on rate limit and on relay error.
  - Reverse alias reuse per contact.
  - Rewritten From/Reply-To/To/Cc, with the original DKIM removed.
  - Reply authorization (wrong sender, DMARC fail), rewrite (no target address anywhere in the headers), and the reply rate limit returning 451.
  - API ownership scoping, caps, verification token flow (GET does not verify; POST does; single-use; expired).
- **Manual smoke (staging):** forward to a Gmail target, confirm "PASS" for DKIM/DMARC in *Show original*, reply from Gmail, and confirm the contact sees only the alias.

## 14. Follow-ups

- Mobile screens for modes and targets.
- Retro-forward on "trust sender" from the screener.
- Plan-tiered limits once billing lands.
- Automatic abuse heuristics (quarantine spike → suggest block).
