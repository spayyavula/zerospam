# ZeroSpam Deployment Runbook (zero-spam.email)

Prereqs: an AWS account, an EC2 key pair, awscli v2 configured, Terraform >= 1.6,
the domain's DNS managed at your registrar.

All Terraform commands run from `infra/terraform/` after `cp terraform.tfvars.example
terraform.tfvars` and filling in your values (`ssh_ingress_cidr`, `key_name`, `repo_url`).

## Phase 0 — SES (start first; production access takes ~24h)
1. `terraform init && terraform apply` creates the SES domain identity + DKIM. Run
   `terraform output ses_dkim_cnames` and add the 3 CNAMEs at the registrar. SES marks
   the domain "verified" once they propagate.
2. In the SES console, **Request production access** (leave the sandbox). Until granted,
   SES only sends to verified addresses.

## Phase 1 — Provision
- `terraform apply` (same dir). Then `terraform output eip`.

## Phase 2 — DNS (at registrar)
| Type | Name | Value |
|---|---|---|
| A | zero-spam.email | <eip> |
| A | mail.zero-spam.email | <eip> |
| MX | zero-spam.email | 10 mail.zero-spam.email. |
| TXT | zero-spam.email | v=spf1 include:amazonses.com -all |
| TXT | _dmarc.zero-spam.email | v=DMARC1; p=none; rua=mailto:dmarc@zero-spam.email |
| CNAME x3 | (from ses_dkim_cnames) | … |
| TXT | zs1._domainkey.zero-spam.email | (from the app DNS panel after first boot) |

## Phase 3 — Secrets to SSM
For each secret, generate 32+ random chars (`openssl rand -base64 32`):
```
aws ssm put-parameter --type SecureString --name /zerospam/prod/SESSION_SECRET --value "..."
aws ssm put-parameter --type SecureString --name /zerospam/prod/CONNECTION_SECRET --value "..."
aws ssm put-parameter --type SecureString --name /zerospam/prod/DIGEST_SIGNING_SECRET --value "..."
aws ssm put-parameter --type SecureString --name /zerospam/prod/RELAY_USER --value "$(terraform output -raw ses_smtp_username)"
aws ssm put-parameter --type SecureString --name /zerospam/prod/RELAY_PASS --value "$(terraform output -raw ses_smtp_password)"
```
Plus the non-secret vars from `server/.env.production.example` (NODE_ENV, API_PORT,
SMTP_PORT, DATA_DIR, WEB_DIST_PATH, PUBLIC_BASE_URL, ALLOWED_ORIGINS, SIGNUP_DOMAIN,
TRUST_PROXY, SEND_MODE, RELAY_HOST, RELAY_PORT, RELAY_SECURE, TLS_CERT_PATH,
TLS_KEY_PATH) as `String` parameters under the same `/zerospam/prod/` prefix.
`entrypoint.sh` renders every parameter under the prefix, so adding one is enough.

> **Required:** set `TRUST_PROXY=loopback,uniquelocal`. The app sits behind Caddy on
> the docker network, so without it `req.ip` resolves to Caddy's container IP and the
> rate-limiter buckets all clients together (and audit logs lose the real IP). Don't use
> a hop count such as `1`: Fastify ≥5.12 ignores numeric values (they can be spoofed),
> and the app only translates them to the value above as a stopgap, with a warning.
> `SESSION_IDLE_TTL_DAYS` (30) and `SESSION_ABSOLUTE_TTL_DAYS` (90) are optional
> overrides for the session idle window and absolute cap.

## Phase 4 — Deploy
- On first boot cloud-init cloned the repo, set up Docker, mounted `/data`, and tried
  `docker compose up`. Because secrets (Phase 3) did not exist yet — and SES creds come
  *from* the `terraform apply` output, so they cannot precede it — the app crash-loops
  until secrets are present. That is expected.
- After Phase 3 finishes, SSH in and bring it up for real:
  ```bash
  cd /opt/zerospam && git pull
  AWS_REGION=us-east-1 bash scripts/entrypoint.sh /data/app.env   # re-render env from SSM
  docker compose up -d --build                                    # re-reads env_file
  docker compose ps && curl -s localhost:8025/api/health
  ```
- Caddy obtains the cert once the A record resolves. Find the issued cert path under the
  `caddy_data` volume (e.g. `/var/lib/docker/volumes/zerospam_caddy_data/_data/caddy/
  certificates/acme-v02.api.letsencrypt.org-directory/zero-spam.email/`) and set the
  `TLS_CERT_PATH`/`TLS_KEY_PATH` SSM params to the mounted `/certs/...` paths, then
  re-render app.env and `docker compose up -d` to enable SMTP STARTTLS.

## Phase 5 — Bootstrap
- Create the owner:
  `docker compose exec app node server/dist/seed-owner.js --email you@zero-spam.email --password '...'`
- Ensure system mailboxes exist: postmaster@, abuse@, dmarc@zero-spam.email.

## Phase 6 — Verify
- Web: open https://zero-spam.email (valid TLS).
- Inbound: from Gmail, mail you@zero-spam.email; confirm it appears. `dig MX zero-spam.email`;
  `openssl s_client -starttls smtp -connect <eip>:25`.
- Outbound: sign up a new user; confirm the verification email arrives at an external inbox
  with SPF/DKIM/DMARC = pass (Gmail "Show original"); run a mail-tester.com check.

## Enabling alias forwarding (after PR #13)
Forwarding ships disabled by default: every existing alias stays in `store` mode until a
user picks a forwarding mode. To make it usable in production:

1. **SES out of the sandbox.** Check `aws sesv2 get-account --region us-east-1`
   → `ProductionAccessEnabled: true`. If false, request it (console: SES → Account
   dashboard → *Request production access*, or `aws sesv2 put-account-details` with a
   mail-type, website URL and use-case description). In the sandbox, forwards to an
   unverified Gmail address are rejected by SES; ZeroSpam then stores the message
   instead (`forward-skipped:relay-error`), so nothing is lost while waiting.
2. **Update `TRUST_PROXY`.** This release upgrades Fastify, which ignores hop counts:
   ```
   aws ssm put-parameter --overwrite --type String --name /zerospam/prod/TRUST_PROXY --value "loopback,uniquelocal"
   ```
3. **Optional limits** (defaults shown in `server/.env.production.example`): add any of
   `ALIAS_MAX_PER_ACCOUNT`, `FORWARD_TARGETS_MAX_PER_ACCOUNT`, `ALIAS_FORWARD_MAX_PER_HOUR`,
   `ALIAS_REPLY_MAX_PER_HOUR` as `String` params. Keep `ALIAS_REPLY_REQUIRE_DMARC` unset
   (defaults to `true`).
4. **Deploy** (Phase 4 commands): `git pull`, re-render `app.env`, `docker compose up -d --build`.
   Schema changes are additive and run automatically on boot.
5. **Smoke test.**
   - In webmail → Aliases, add your Gmail address as a forwarding address and confirm
     the link.
   - Create an alias in *Forward only* mode. Whitelist a second external address of
     yours and send to the alias from it.
   - In Gmail, open *Show original* on the forwarded copy: DKIM = PASS
     (`d=zero-spam.email`), DMARC = PASS, and From is an `rv.…@zero-spam.email` address.
   - Reply from Gmail. On the sender's side the reply must come From the alias, with
     no Gmail address in any header.
   - Check `docker compose logs app | grep -E "forward|reply"` for `[forward] failed`
     or `alias.reply.rejected` entries.

## Rollback
`terraform destroy` (data persists in EBS snapshots) or point DNS away.
