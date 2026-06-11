# ZeroSpam — AWS Deployment Design (zero-spam.email)

**Date:** 2026-06-12
**Status:** Approved (design) — pending implementation plan
**Scope:** First production deployment of the full email service at `zero-spam.email`.

---

## 1. Goal & scope

Deploy the **complete product**: receive real inbound mail at `name@zero-spam.email`
(MX, SMTP on port 25, SPF/DKIM/DMARC) **and** serve the webmail over HTTPS, with
outbound mail (verification links, quarantine digests, replies) delivered through a
relay.

Out of scope for v1: horizontal scaling, multi-region, CI/CD automation, direct-to-MX
outbound sending, custom MAIL-FROM subdomain, MTA-STS/TLS-RPT.

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Full email service (inbound + outbound + webmail) | The product, not a demo |
| Host | AWS, **single EC2 instance** + Elastic IP | App embeds SQLite + local file storage + binds API & SMTP in one process → not horizontally scalable, no Fargate/RDS without a rewrite |
| Region | `us-east-1` (default; override allowed) | Cheap, SES available |
| Outbound | **Amazon SES** SMTP relay (`SEND_MODE=relay`) | Native on AWS; app has no direct-MX sender |
| DNS | **External registrar** (manual records) | Domain DNS lives at the registrar; IaC scoped to AWS only |
| Packaging | **Terraform + Docker Compose** (app + Caddy) | Reproducible, version-controlled; no CI yet |
| UI serving | **App serves the built SPA** via `@fastify/static` | Keeps route knowledge in the app; Caddy stays a dumb TLS proxy |
| Inbound TLS | **STARTTLS** on port 25 using the Caddy cert | TLS-preferred inbound; plaintext still accepted |
| DMARC | Start `p=none` (monitor), tighten later | Safe rollout |
| Secrets | **SSM Parameter Store** (SecureString) | Nothing secret in repo or image |

**Key simplification from choosing SES:** all outbound flows through SES, so the EC2 IP
never sends mail directly. Therefore we do **not** need the AWS outbound-port-25 unblock,
and the Elastic IP's reverse DNS (PTR) is nice-to-have, not blocking. Inbound on port 25
works once the security group is open.

## 3. Architecture

```
                  Internet
   ┌─────────────────┼───────────────────┐
   │ MX/SMTP :25      │ HTTPS :443/:80     │  (both → same Elastic IP)
   ▼                  ▼
┌─────────────── EC2 (t4g.small, ARM, Ubuntu 24.04) ───────────────┐
│  Docker Compose:                                                  │
│   • caddy — :80/:443, auto-TLS for zero-spam.email, proxy → app   │
│   • app   — Node: Fastify API + smtp-server, serves web/dist SPA  │
│  /data (EBS gp3) → zerospam.sqlite + raw mail blobs               │
└──────────────────────────────────────────────────────────────────┘
       │ outbound (verification, digests, replies)
       ▼
   Amazon SES (SMTP relay :587) → recipients
```

**Inbound path (production form of the dev loopback):**
`MX → mail.zero-spam.email (A→EIP) → :25 on EC2 → app smtp-server → onRcptTo`
(accepts only local mailboxes/aliases) → ingest pipeline → inbox/quarantine.

## 4. AWS resources (Terraform)

- 1× EC2 `t4g.small` (2 vCPU / 2 GB, ARM) + **Elastic IP**
- Security group: inbound **22** (SSH, restricted to operator IP), **25** (SMTP, world),
  **80/443** (web, world); all outbound allowed
- **EBS gp3** data volume (20 GB) mounted at `/data`, separate from root so it survives
  instance replacement
- **SES**: domain identity for `zero-spam.email` + Easy-DKIM; IAM user with SES-SMTP
  credentials
- IAM instance role: read SSM Parameter Store
- **DLM** lifecycle policy: nightly EBS snapshot of `/data`
- `outputs.tf`: Elastic IP, SES DKIM CNAME set, SES SMTP credentials (sensitive)

Estimated cost: ~$15–20/mo (t4g.small + EBS + EIP + minimal SES).

## 5. Runtime & packaging

**Docker image — multi-stage `Dockerfile`:**
1. build: `npm ci`; build `@zerospam/shared-api`, `web` (Vite → `web/dist`),
   `server` (tsc → `server/dist`)
2. runtime: `node:22-bookworm-slim` (arm64); copy `server/dist` + `web/dist` + prod
   `node_modules`; `HEALTHCHECK` → `GET /api/health`; `CMD node server/dist/index.js`

> **Node version:** the app uses `node:sqlite` (`DatabaseSync`), introduced in Node
> **22.5**. Both build and runtime stages must be Node ≥ 22.5 (`node:22`). The root
> `package.json` `engines` field currently says `>=20`, which is inaccurate — bump it
> to `>=22.5` as part of this work.

**`docker-compose.yml`:** services `app` + `caddy` on a shared network. `/data`
bind-mounted into `app`. Caddy's cert volume mounted **read-only into `app`** so the SMTP
server can offer STARTTLS with the same Let's Encrypt cert.

**`Caddyfile`:** `zero-spam.email` → auto-HTTPS, reverse-proxy all to `app:8025`.

**`scripts/entrypoint.sh`:** pull SSM SecureString params → export into env → exec app.

## 6. App code changes (small, additive)

| Change | File | Why |
|---|---|---|
| Serve `web/dist` SPA + index fallback for non-API routes | `server/src/api.ts` (`@fastify/static`) | UI needs a host in prod |
| STARTTLS on inbound SMTP using the shared cert (plaintext fallback) | `server/src/smtp.ts` | TLS-preferred inbound |
| Graceful `SIGTERM` → close API + SMTP | `server/src/index.ts` | clean container restarts; also fixes the dev bind-race |
| Docker `HEALTHCHECK` → `/api/health` | `Dockerfile` | compose restart-on-unhealthy |

**Production env** (`NODE_ENV=production`, `SEND_MODE=relay`,
`PUBLIC_BASE_URL=https://zero-spam.email`, `SIGNUP_DOMAIN=zero-spam.email`,
`ALLOWED_ORIGINS=https://zero-spam.email`, SES relay host/creds, generated secrets).

## 7. DNS records (paste at registrar; `<EIP>` from `terraform output eip`)

| Type | Name | Value | Purpose |
|---|---|---|---|
| `A` | `zero-spam.email` | `<EIP>` | web (apex) |
| `A` | `mail.zero-spam.email` | `<EIP>` | MX target host |
| `MX` | `zero-spam.email` | `10 mail.zero-spam.email.` | inbound mail |
| `TXT` | `zero-spam.email` | `v=spf1 include:amazonses.com -all` | SPF (outbound = SES only) |
| `CNAME` ×3 | `<token>._domainkey…` | `<token>.dkim.amazonses.com` | SES Easy-DKIM + domain verification |
| `TXT` | `zs1._domainkey.zero-spam.email` | from app `/api/domains/:id/dns` panel | app per-domain DKIM (`d=zero-spam.email`) |
| `TXT` | `_dmarc.zero-spam.email` | `v=DMARC1; p=none; rua=mailto:dmarc@zero-spam.email` | DMARC (monitor first) |

System mailboxes to create: `postmaster@`, `abuse@`, `dmarc@zero-spam.email` (real mail
servers expect `postmaster@` to exist).

## 8. Rollout sequence

| Phase | Action | Gated by |
|---|---|---|
| **0** (day 1) | Create SES domain identity → paste DKIM CNAMEs + SPF; **request SES production access (~24h)** | — |
| **1** | `terraform apply` → EC2 + EIP + SG + EBS + IAM + SSM → `terraform output eip` | AWS creds |
| **2** | Paste `A` (apex + `mail`), `MX`, `DMARC p=none` using the EIP | Phase 1 |
| **3** | Put secrets (SESSION/CONNECTION/DIGEST, SES SMTP creds, OAuth) into SSM | Phase 1 |
| **4** | `docker compose up` → Caddy auto-cert; app serves SPA + API + SMTP (STARTTLS) | Phase 2 (A record + :80/:443 live) |
| **5** | Create owner account; ensure `postmaster@`/`abuse@`/`dmarc@` mailboxes exist | Phase 4 |
| **6** | Verify (§9) | SES prod access for outbound |

**Long pole:** SES production access (~24h). Until granted, SES sends only to verified
addresses (200/day) — real signup-verification emails to arbitrary users are blocked.
Request on day 1.

## 9. Verification (the "drive it" step)

- **Web:** `https://zero-spam.email` loads with valid TLS.
- **Inbound:** real Gmail → `you@zero-spam.email` lands in inbox; `dig MX zero-spam.email`;
  `openssl s_client -starttls smtp -connect <EIP>:25` handshake succeeds.
- **Outbound:** trigger a signup → SES delivers the verification email to an external
  inbox; confirm **SPF / DKIM / DMARC = pass** via Gmail "Show original" + a
  mail-tester.com score.

## 10. Operations

- **Backups:** nightly EBS snapshot of `/data` (DLM). SQLite in WAL mode → snapshots are
  crash-consistent.
- **Updates:** rebuild image → `docker compose up -d` (graceful SIGTERM drains
  connections).
- **Rollback:** greenfield deploy (no existing prod) → `terraform destroy` or point DNS
  away; data preserved in EBS snapshots.
- **Secrets rotation:** update SSM param → restart container.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| SES sandbox delays real signups | Request production access day 1; seed/test with verified addresses meanwhile |
| New domain/IP reputation → spam folder | DMARC `p=none` first; SES handles sending reputation; monitor mail-tester score |
| Single instance = single point of failure | EBS snapshots; instance is reproducible from Terraform + image |
| SQLite write contention under load | Acceptable for v1 scale; WAL mode; revisit if traffic grows |
| Caddy cert issuance needs DNS live first | Rollout enforces DNS (phase 2) before deploy (phase 4) |
