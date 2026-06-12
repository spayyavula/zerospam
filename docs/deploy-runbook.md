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
SEND_MODE, RELAY_HOST, RELAY_PORT, RELAY_SECURE, TLS_CERT_PATH, TLS_KEY_PATH) as
`String` parameters under the same `/zerospam/prod/` prefix.

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

## Rollback
`terraform destroy` (data persists in EBS snapshots) or point DNS away.
