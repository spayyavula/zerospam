# ZeroSpam AWS Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ZeroSpam app deployable as a production email service at `zero-spam.email` on a single AWS EC2 instance (Docker Compose: app + Caddy), with inbound SMTP on port 25 (STARTTLS), outbound via Amazon SES, SQLite + raw mail on an EBS volume, and Terraform for the AWS side.

**Architecture:** One EC2 + Elastic IP. Caddy terminates TLS and reverse-proxies to the Node app, which serves the built web SPA *and* runs the Fastify API + smtp-server in one process. Persistence is a local SQLite file + raw-mail blobs on a mounted EBS volume. All outbound mail relays through SES. See spec: `docs/superpowers/specs/2026-06-12-aws-deployment-design.md`.

**Tech Stack:** Node 22 (`node:sqlite`), Fastify, `@fastify/static`, `smtp-server`, Docker + Docker Compose, Caddy (auto-HTTPS), Terraform (AWS provider), Amazon SES, AWS SSM Parameter Store.

**Conventions:** Run server tests with `npm test --workspace=server` (vitest). Server tests use `app.inject()` and an in-process DB. Commit after each task. The app's tests share a singleton DB module (`server/src/db.ts`) that runs migrations at import.

---

## File Structure

**App code (modify):**
- `package.json` — bump `engines.node` to `>=22.5`
- `server/src/index.ts` — capture server handles, add graceful shutdown
- `server/src/api.ts` — serve web SPA via `@fastify/static`; exempt static/SPA from auth; SPA fallback
- `server/src/smtp.ts` — optional STARTTLS using cert/key from config
- `server/src/config.ts` — add `tls: { certPath, keyPath }` from env

**App code (create):**
- `server/src/shutdown.ts` — `closeAll(closers)` helper (testable)
- `server/test/spa-serving.test.ts`
- `server/test/smtp-tls.test.ts`
- `server/test/shutdown.test.ts`

**Deploy artifacts (create):**
- `Dockerfile`, `.dockerignore`
- `docker-compose.yml`, `Caddyfile`
- `scripts/entrypoint.sh`
- `server/.env.production.example`
- `infra/terraform/{versions.tf,variables.tf,main.tf,ses.tf,outputs.tf,terraform.tfvars.example}`
- `infra/terraform/cloud-init.yaml`
- `docs/deploy-runbook.md`

---

## Task 1: Pin Node ≥ 22.5

**Files:**
- Modify: `package.json` (root)
- Create: `.nvmrc`

- [ ] **Step 1: Bump the engines field**

In root `package.json`, change:
```json
  "engines": {
    "node": ">=20"
  },
```
to:
```json
  "engines": {
    "node": ">=22.5"
  },
```

- [ ] **Step 2: Add `.nvmrc`**

Create `.nvmrc` with exactly:
```
22
```

- [ ] **Step 3: Verify the running Node satisfies it**

Run: `node -p "process.version"`
Expected: `v22.x` or higher (the app already uses `node:sqlite`, which requires 22.5+).

- [ ] **Step 4: Commit**

```bash
git add package.json .nvmrc
git commit -m "chore: require Node >=22.5 (node:sqlite)"
```

---

## Task 2: Graceful shutdown helper + signal handling

`startSmtp()` returns the `SMTPServer` and `startApi()` returns the Fastify `app`; both expose `.close()`. We add a small tested helper and wire `SIGTERM`/`SIGINT` in `index.ts` so containers stop cleanly (also removes the dev bind-race).

**Files:**
- Create: `server/src/shutdown.ts`
- Create: `server/test/shutdown.test.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/shutdown.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { closeAll } from '../src/shutdown.js';

describe('closeAll', () => {
  it('invokes every closer once, in order', async () => {
    const calls: string[] = [];
    await closeAll([
      { name: 'a', close: async () => { calls.push('a'); } },
      { name: 'b', close: async () => { calls.push('b'); } },
    ]);
    expect(calls).toEqual(['a', 'b']);
  });

  it('continues if one closer throws and reports the failures', async () => {
    const calls: string[] = [];
    const errors = await closeAll([
      { name: 'a', close: async () => { throw new Error('boom'); } },
      { name: 'b', close: async () => { calls.push('b'); } },
    ]);
    expect(calls).toEqual(['b']);
    expect(errors.map((e) => e.name)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- shutdown`
Expected: FAIL — `Cannot find module '../src/shutdown.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/src/shutdown.ts`:
```ts
export type Closer = { name: string; close: () => void | Promise<void> };

/**
 * Close each resource in order. Never throws — collects and returns the
 * failures so a caller can log them, guaranteeing every closer is attempted.
 */
export async function closeAll(closers: Closer[]): Promise<Array<{ name: string; err: unknown }>> {
  const errors: Array<{ name: string; err: unknown }> = [];
  for (const c of closers) {
    try {
      await c.close();
    } catch (err) {
      errors.push({ name: c.name, err });
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=server -- shutdown`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire signals in `index.ts`**

Replace the entire contents of `server/src/index.ts` with:
```ts
import { startSmtp } from './smtp.js';
import { startApi } from './api.js';
import { startSweeper } from './sweeper.js';
import { startDigester } from './digester.js';
import { startConnectionPoller } from './connection-poller.js';
import { closeAll, type Closer } from './shutdown.js';

async function main() {
  const smtp = startSmtp();
  const app = await startApi();
  startSweeper();
  startDigester();
  startConnectionPoller();

  const closers: Closer[] = [
    { name: 'smtp', close: () => new Promise<void>((res) => smtp.close(() => res())) },
    { name: 'api', close: () => app.close() },
  ];

  let shuttingDown = false;
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      // eslint-disable-next-line no-console
      console.log(`[shutdown] ${sig} received, closing servers…`);
      closeAll(closers).then((errors) => {
        for (const e of errors) {
          // eslint-disable-next-line no-console
          console.error(`[shutdown] ${e.name} failed to close`, e.err);
        }
        process.exit(0);
      });
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
```

- [ ] **Step 6: Verify the server still boots and stops cleanly**

Run (from repo root): `npm run dev:server` in one terminal; confirm `[api] listening on :8025`, then stop with Ctrl+C and confirm `[shutdown] SIGINT received` appears with no stack trace.
Expected: clean exit, no `EADDRINUSE` on a subsequent start.

- [ ] **Step 7: Commit**

```bash
git add server/src/shutdown.ts server/test/shutdown.test.ts server/src/index.ts
git commit -m "feat(server): graceful shutdown on SIGTERM/SIGINT"
```

---

## Task 3: Serve the web SPA from the app

The app must serve `web/dist` (built SPA) and fall back to `index.html` for client routes, while keeping `/api/*` auth intact. The existing `preHandler` (`server/src/api.ts:64`) runs `requireAuth` on every non-public path, so static/SPA routes must be exempted.

**Files:**
- Modify: `server/src/config.ts` (add `webDistPath`)
- Modify: `server/src/api.ts` (static plugin, auth exemption, SPA fallback)
- Create: `server/test/spa-serving.test.ts`

- [ ] **Step 1: Add `webDistPath` to config**

In `server/src/config.ts`, inside the `config` object (after the `signupDomain`/`verifyTokenExpiryHours` lines, before the closing `} as const;`), add:
```ts
  // Absolute path to the built web SPA (web/dist). Served in production by
  // @fastify/static. Overridable for the Docker image layout via WEB_DIST_PATH.
  webDistPath: process.env.WEB_DIST_PATH ?? resolve(SERVER_ROOT, '..', 'web', 'dist'),
```

- [ ] **Step 2: Write the failing test**

Create `server/test/spa-serving.test.ts`. It builds a tiny fake `web/dist` in a temp dir, points `WEB_DIST_PATH` at it via config override, and asserts routing. Because `config` reads env at import, we pass the dist path directly to a helper we will add (`registerWebSpa`).

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerWebSpa } from '../src/api.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'zsweb-'));
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ZeroSpam SPA</title>');
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function build() {
  const app = Fastify({ logger: false });
  await registerWebSpa(app, dir);
  await app.ready();
  return app;
}

describe('web SPA serving', () => {
  it('serves index.html at /', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('ZeroSpam SPA');
    await app.close();
  });

  it('serves built assets', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('console.log');
    await app.close();
  });

  it('falls back to index.html for unknown client routes', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/some/client/route' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('ZeroSpam SPA');
    await app.close();
  });

  it('returns JSON 404 for unknown /api routes (no SPA fallback)', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(r.statusCode).toBe(404);
    expect(r.headers['content-type']).toContain('application/json');
    await app.close();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test --workspace=server -- spa-serving`
Expected: FAIL — `registerWebSpa` is not exported from `../src/api.js`.

- [ ] **Step 4: Implement `registerWebSpa` and call it**

In `server/src/api.ts`, add the import at the top (with the other imports):
```ts
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
```

Add this exported function near the bottom of the file, **above** `export async function startApi(...)`:
```ts
/**
 * Serve the built web SPA (web/dist): static files first, then a catch-all
 * not-found handler that returns index.html for client-side routes. Only
 * GET/HEAD requests outside the server's own route prefixes get the SPA;
 * unknown /api, /auth, /public routes still return a JSON 404.
 */
export async function registerWebSpa(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, { root, wildcard: false });

  const SERVER_PREFIXES = ['/api', '/auth/', '/public/'];
  app.setNotFoundHandler((req, reply) => {
    const isServerRoute = SERVER_PREFIXES.some((p) => req.url === p || req.url.startsWith(p));
    if ((req.method === 'GET' || req.method === 'HEAD') && !isServerRoute) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });
}
```

- [ ] **Step 5: Exempt static/SPA routes from auth in the preHandler**

In `server/src/api.ts`, the `preHandler` hook currently is:
```ts
  app.addHook('preHandler', async (req, reply) => {
    if (PUBLIC_PREFIXES.some((p) => req.url === p || req.url.startsWith(p + '?'))) return;
```
Add a second early-return **immediately after** the `PUBLIC_PREFIXES` check:
```ts
    // Static assets and SPA navigation (anything that is not a server route)
    // are public — only server routes go through auth.
    const SERVER_PREFIXES = ['/api', '/auth/', '/public/'];
    const isServerRoute = SERVER_PREFIXES.some((p) => req.url === p || req.url.startsWith(p));
    if (!isServerRoute && (req.method === 'GET' || req.method === 'HEAD')) return;
```

- [ ] **Step 6: Call `registerWebSpa` in `startApi` (production only)**

In `server/src/api.ts`, find the block:
```ts
  if (opts.inject) {
    await app.ready();
    return app;
  }
```
Insert **immediately before** it:
```ts
  // Serve the built SPA in non-test runs. (Tests use opts.inject and exercise
  // registerWebSpa directly against a temp dir.)
  await registerWebSpa(app, config.webDistPath);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test --workspace=server -- spa-serving`
Expected: PASS (4 tests).

- [ ] **Step 8: Run the full server suite (no regressions)**

Run: `npm test --workspace=server`
Expected: all tests pass (the prior 253 + new ones). The auth-exemption change must not break existing auth tests, which use `/api/*` paths.

- [ ] **Step 9: Commit**

```bash
git add server/src/config.ts server/src/api.ts server/test/spa-serving.test.ts
git commit -m "feat(server): serve built web SPA with auth-exempt static + index fallback"
```

---

## Task 4: STARTTLS for inbound SMTP

Make the SMTP server offer STARTTLS when a cert+key are configured (production), and stay plaintext otherwise (dev/test). The cert comes from Caddy's storage, mounted read-only into the container.

**Files:**
- Modify: `server/src/config.ts` (add `tls`)
- Modify: `server/src/smtp.ts` (build TLS options)
- Create: `server/test/smtp-tls.test.ts`

- [ ] **Step 1: Add `tls` to config**

In `server/src/config.ts`, inside the `config` object (next to `webDistPath`), add:
```ts
  // Inbound SMTP STARTTLS cert/key (PEM file paths). When both are set, the
  // SMTP server offers STARTTLS; otherwise it runs plaintext (dev/test).
  tls: {
    certPath: process.env.TLS_CERT_PATH ?? '',
    keyPath: process.env.TLS_KEY_PATH ?? '',
  },
```

- [ ] **Step 2: Write the failing test**

Create `server/test/smtp-tls.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSmtpTlsOptions } from '../src/smtp.js';

describe('buildSmtpTlsOptions', () => {
  it('returns empty (plaintext) when cert/key are not configured', () => {
    expect(buildSmtpTlsOptions({ certPath: '', keyPath: '' })).toEqual({});
  });

  it('returns secure:false + key/cert when both paths exist', () => {
    // Use this test file itself as stand-in PEM files (existence is all we check).
    const here = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const opts = buildSmtpTlsOptions({ certPath: here, keyPath: here });
    expect(opts.secure).toBe(false); // STARTTLS, not implicit TLS
    expect(Buffer.isBuffer(opts.key)).toBe(true);
    expect(Buffer.isBuffer(opts.cert)).toBe(true);
  });

  it('throws a clear error if a configured path is missing', () => {
    expect(() => buildSmtpTlsOptions({ certPath: '/no/such/cert.pem', keyPath: '/no/such/key.pem' }))
      .toThrow(/TLS_CERT_PATH/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test --workspace=server -- smtp-tls`
Expected: FAIL — `buildSmtpTlsOptions` is not exported.

- [ ] **Step 4: Implement `buildSmtpTlsOptions` and use it**

In `server/src/smtp.ts`, add imports at the top:
```ts
import { readFileSync, existsSync } from 'node:fs';
```
Add this exported function above `export function startSmtp()`:
```ts
export type SmtpTlsConfig = { certPath: string; keyPath: string };
export type SmtpTlsOptions = { secure?: boolean; key?: Buffer; cert?: Buffer };

/**
 * Build smtp-server TLS options. With no cert/key configured, returns {} so the
 * server runs plaintext (dev/test). With both set, returns STARTTLS options
 * (secure:false means "offer STARTTLS on the plaintext port", not implicit TLS).
 */
export function buildSmtpTlsOptions(cfg: SmtpTlsConfig): SmtpTlsOptions {
  if (!cfg.certPath && !cfg.keyPath) return {};
  for (const [name, p] of [['TLS_CERT_PATH', cfg.certPath], ['TLS_KEY_PATH', cfg.keyPath]] as const) {
    if (!p || !existsSync(p)) {
      throw new Error(`${name} is set or required but the file is missing: ${p || '(empty)'}`);
    }
  }
  return { secure: false, key: readFileSync(cfg.keyPath), cert: readFileSync(cfg.certPath) };
}
```
Then, in `startSmtp()`, change the `new SMTPServer({ ... })` options to spread in the TLS options. Find:
```ts
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'],
    size: 25 * 1024 * 1024,
    banner: 'ZeroSpam ESMTP',
```
and change to:
```ts
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'],
    size: 25 * 1024 * 1024,
    banner: 'ZeroSpam ESMTP',
    ...buildSmtpTlsOptions(config.tls),
```
(`config` is already imported in `smtp.ts`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=server -- smtp-tls`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full server suite**

Run: `npm test --workspace=server`
Expected: all pass; plaintext SMTP behavior unchanged in tests (no TLS env set).

- [ ] **Step 7: Commit**

```bash
git add server/src/config.ts server/src/smtp.ts server/test/smtp-tls.test.ts
git commit -m "feat(server): optional STARTTLS for inbound SMTP via TLS_CERT_PATH/TLS_KEY_PATH"
```

---

## Task 5: Production env template

**Files:**
- Create: `server/.env.production.example`

- [ ] **Step 1: Create the template**

Create `server/.env.production.example`:
```bash
# ---- ZeroSpam production env (values injected from SSM at boot; see scripts/entrypoint.sh) ----
NODE_ENV=production
API_PORT=8025
SMTP_PORT=25
DATA_DIR=/data
WEB_DIST_PATH=/app/web/dist

PUBLIC_BASE_URL=https://zero-spam.email
ALLOWED_ORIGINS=https://zero-spam.email
SIGNUP_DOMAIN=zero-spam.email

# Inbound STARTTLS — cert/key written by Caddy, mounted read-only into the app.
TLS_CERT_PATH=/certs/zero-spam.email.crt
TLS_KEY_PATH=/certs/zero-spam.email.key

# Outbound via Amazon SES SMTP relay
SEND_MODE=relay
RELAY_HOST=email-smtp.us-east-1.amazonaws.com
RELAY_PORT=587
RELAY_SECURE=false
RELAY_USER=__SES_SMTP_USERNAME__
RELAY_PASS=__SES_SMTP_PASSWORD__

# Secrets (SecureString in SSM; never commit real values)
SESSION_SECRET=__32_PLUS_RANDOM__
CONNECTION_SECRET=__32_PLUS_RANDOM__
DIGEST_SIGNING_SECRET=__32_PLUS_RANDOM__

# OAuth (optional; only if Gmail/Outlook connect is used)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT=common
```

- [ ] **Step 2: Commit**

```bash
git add server/.env.production.example
git commit -m "docs(deploy): production env template"
```

---

## Task 6: Dockerfile + .dockerignore

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

Create `.dockerignore`:
```
**/node_modules
**/dist
**/.env
**/.env.*
!**/.env.production.example
server/data
.git
.omc
.claude
infra
docs
**/*.tsbuildinfo
```

- [ ] **Step 2: Create the multi-stage `Dockerfile`**

Create `Dockerfile` at the repo root:
```dockerfile
# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# All workspace manifests must be present so npm can resolve the lockfile graph.
COPY package*.json ./
COPY packages/shared-api/package*.json packages/shared-api/
COPY server/package*.json server/
COPY web/package*.json web/
COPY apps/mobile/package*.json apps/mobile/
# Install only the workspaces needed to build the server image (skip mobile).
RUN npm ci --include-workspace-root \
      --workspace=@zerospam/shared-api --workspace=web --workspace=server
COPY . .
RUN npm run build:shared-api \
 && npm run build --workspace=web \
 && npm run build --workspace=server

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Same manifests for lockfile resolution; install prod deps for server + root only.
COPY package*.json ./
COPY packages/shared-api/package*.json packages/shared-api/
COPY server/package*.json server/
COPY web/package*.json web/
COPY apps/mobile/package*.json apps/mobile/
RUN npm ci --omit=dev --include-workspace-root --workspace=server
# Built artifacts
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/packages/shared-api/dist packages/shared-api/dist
COPY --from=build /app/web/dist web/dist
EXPOSE 25 8025
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8025/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
```

> Note for the implementer: confirm shared-api builds to `packages/shared-api/dist` and that the server imports `@zerospam/shared-api` from there. If `npm ci --workspace=server` still complains about a missing workspace, copy that workspace's `package.json` too. Verify with Step 3 (the `docker build`).

- [ ] **Step 3: Build the image**

Run: `docker build -t zerospam:local .`
Expected: build completes; final image present in `docker images`.

- [ ] **Step 4: Smoke-run the container**

Run:
```bash
docker run --rm -d --name zs -p 8025:8025 -e NODE_ENV=production \
  -e SESSION_SECRET=0123456789abcdef0123456789abcdef \
  -e PUBLIC_BASE_URL=http://localhost:8025 -e SEND_MODE=relay -e RELAY_HOST=localhost \
  -v zsdata:/data zerospam:local
sleep 5
curl -s http://localhost:8025/api/health
docker logs zs | tail
docker rm -f zs
```
Expected: `{"ok":true}` and `[api] listening on :8025` in logs.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "build: multi-stage Dockerfile (Node 22) + dockerignore"
```

---

## Task 7: docker-compose.yml + Caddyfile

**Files:**
- Create: `Caddyfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `Caddyfile`**

Create `Caddyfile`:
```
zero-spam.email {
	encode zstd gzip
	reverse_proxy app:8025
}
```

- [ ] **Step 2: Create `docker-compose.yml`**

Create `docker-compose.yml`:
```yaml
services:
  app:
    build: .
    image: zerospam:local
    restart: unless-stopped
    env_file:
      - /data/app.env
    ports:
      - "25:25"      # inbound SMTP
    volumes:
      - /data:/data
      - caddy_data:/certs:ro   # Caddy-issued cert/key, read-only for STARTTLS
    depends_on:
      - caddy

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

> Note for the implementer: Caddy stores certs under `/data/caddy/certificates/...`. The app's `TLS_CERT_PATH`/`TLS_KEY_PATH` (Task 5) must point at the actual issued files inside the mounted `caddy_data` volume (path includes the ACME CA + domain). The runbook (Task 10) documents resolving the exact path after first issuance; until then the app runs plaintext SMTP, which still accepts mail.

- [ ] **Step 3: Validate the compose file**

Run: `docker compose config`
Expected: prints the resolved config with no errors.

- [ ] **Step 4: Commit**

```bash
git add Caddyfile docker-compose.yml
git commit -m "build: docker-compose (app + caddy auto-HTTPS)"
```

---

## Task 8: SSM secrets entrypoint

The container reads its env from `/data/app.env`. We provide a script the instance runs (via cloud-init) to materialize `/data/app.env` from SSM Parameter Store, so secrets never live in the repo or image.

**Files:**
- Create: `scripts/entrypoint.sh`

- [ ] **Step 1: Create the script**

Create `scripts/entrypoint.sh` (uses `jq`, which Task 9's cloud-init installs):
```bash
#!/usr/bin/env bash
# Render /data/app.env from SSM Parameter Store. Run on the host (cloud-init),
# not inside the container. Requires awscli v2 + jq and an instance role with
# ssm:GetParametersByPath on /zerospam/prod/*.
set -euo pipefail

PREFIX="${SSM_PREFIX:-/zerospam/prod}"
OUT="${1:-/data/app.env}"
REGION="${AWS_REGION:-us-east-1}"

tmp="$(mktemp)"
next=""
while :; do
  resp="$(aws ssm get-parameters-by-path \
    --path "$PREFIX" --with-decryption --recursive --region "$REGION" \
    ${next:+--next-token "$next"} --output json)"
  echo "$resp" | jq -r '.Parameters[] | "\(.Name | split("/") | last)=\(.Value)"' >> "$tmp"
  next="$(echo "$resp" | jq -r '.NextToken // empty')"
  [ -z "$next" ] && break
done

install -m 0600 "$tmp" "$OUT"
rm -f "$tmp"
echo "wrote $(wc -l < "$OUT") vars to $OUT"
```

- [ ] **Step 2: Lint**

Run: `bash -n scripts/entrypoint.sh`
Expected: no syntax errors. If `shellcheck` is available: `shellcheck scripts/entrypoint.sh` (warnings OK, no errors).

- [ ] **Step 3: Make it executable + commit**

```bash
chmod +x scripts/entrypoint.sh
git add scripts/entrypoint.sh
git commit -m "feat(deploy): render app.env from SSM Parameter Store"
```

---

## Task 9: Terraform (AWS infrastructure)

**Files:**
- Create: `infra/terraform/versions.tf`
- Create: `infra/terraform/variables.tf`
- Create: `infra/terraform/main.tf`
- Create: `infra/terraform/ses.tf`
- Create: `infra/terraform/outputs.tf`
- Create: `infra/terraform/cloud-init.yaml.tftpl`
- Create: `infra/terraform/terraform.tfvars.example`

- [ ] **Step 1: versions.tf**

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}
```

- [ ] **Step 2: variables.tf**

```hcl
variable "region" {
  type    = string
  default = "us-east-1"
}

variable "domain" {
  type    = string
  default = "zero-spam.email"
}

variable "instance_type" {
  type    = string
  default = "t4g.small" # ARM
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to SSH (your IP/32)."
  type        = string
}

variable "key_name" {
  description = "Existing EC2 key pair name for SSH."
  type        = string
}

variable "repo_url" {
  description = "Git URL the instance clones to /opt/zerospam (https with token or public)."
  type        = string
}

variable "data_volume_gb" {
  type    = number
  default = 20
}
```

- [ ] **Step 3: main.tf**

```hcl
data "aws_ami" "ubuntu_arm" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }
}

resource "aws_security_group" "zerospam" {
  name        = "zerospam-sg"
  description = "ZeroSpam: SSH(restricted), SMTP, HTTP/S"

  ingress { description = "SSH",   from_port = 22,  to_port = 22,  protocol = "tcp", cidr_blocks = [var.ssh_ingress_cidr] }
  ingress { description = "SMTP",  from_port = 25,  to_port = 25,  protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  ingress { description = "HTTP",  from_port = 80,  to_port = 80,  protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  ingress { description = "HTTPS", from_port = 443, to_port = 443, protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  egress  { from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = ["0.0.0.0/0"] }
}

# Instance role: read SSM params under /zerospam/prod/*
resource "aws_iam_role" "instance" {
  name = "zerospam-instance"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "ssm_read" {
  name = "ssm-read"
  role = aws_iam_role.instance.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["ssm:GetParametersByPath", "ssm:GetParameter", "ssm:GetParameters"],
      Resource = "arn:aws:ssm:${var.region}:*:parameter/zerospam/prod/*"
    }]
  })
}

resource "aws_iam_instance_profile" "instance" {
  name = "zerospam-instance"
  role = aws_iam_role.instance.name
}

resource "aws_instance" "zerospam" {
  ami                    = data.aws_ami.ubuntu_arm.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.zerospam.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name
  user_data              = templatefile("${path.module}/cloud-init.yaml.tftpl", { repo_url = var.repo_url, region = var.region })
  root_block_device { volume_size = 16, volume_type = "gp3" }
  tags = { Name = "zerospam" }
}

resource "aws_eip" "zerospam" {
  instance = aws_instance.zerospam.id
  domain   = "vpc"
  tags     = { Name = "zerospam" }
}

resource "aws_ebs_volume" "data" {
  availability_zone = aws_instance.zerospam.availability_zone
  size              = var.data_volume_gb
  type              = "gp3"
  tags              = { Name = "zerospam-data", Snapshot = "daily" }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.zerospam.id
}

# Nightly snapshot of volumes tagged Snapshot=daily
resource "aws_iam_role" "dlm" {
  name = "zerospam-dlm"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "dlm.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "data" {
  description        = "zerospam daily data snapshots"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"
  policy_details {
    resource_types = ["VOLUME"]
    target_tags    = { Snapshot = "daily" }
    schedule {
      name = "daily-7"
      create_rule { interval = 24, interval_unit = "HOURS", times = ["05:00"] }
      retain_rule { count = 7 }
    }
  }
}
```

- [ ] **Step 4: ses.tf**

```hcl
resource "aws_ses_domain_identity" "zerospam" {
  domain = var.domain
}

resource "aws_ses_domain_dkim" "zerospam" {
  domain = aws_ses_domain_identity.zerospam.domain
}

# IAM user whose access key is converted to SES SMTP credentials.
resource "aws_iam_user" "ses_smtp" {
  name = "zerospam-ses-smtp"
}

resource "aws_iam_user_policy" "ses_send" {
  name = "ses-send"
  user = aws_iam_user.ses_smtp.name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Effect = "Allow", Action = ["ses:SendRawEmail", "ses:SendEmail"], Resource = "*" }]
  })
}

resource "aws_iam_access_key" "ses_smtp" {
  user = aws_iam_user.ses_smtp.name
}
```

- [ ] **Step 5: cloud-init.yaml.tftpl**

Create `infra/terraform/cloud-init.yaml.tftpl` (a Terraform template — `${repo_url}` and `${region}` are interpolated by `templatefile`):
```yaml
#cloud-config
package_update: true
packages: [docker.io, docker-compose-v2, awscli, jq, git, xfsprogs]
runcmd:
  - systemctl enable --now docker
  # Mount the data volume (first attach is blank -> format once)
  - [ bash, -lc, "if ! blkid /dev/nvme1n1; then mkfs.xfs /dev/nvme1n1; fi" ]
  - mkdir -p /data
  - [ bash, -lc, "echo '/dev/nvme1n1 /data xfs defaults,nofail 0 2' >> /etc/fstab" ]
  - mount -a
  - [ bash, -lc, "git clone ${repo_url} /opt/zerospam || (cd /opt/zerospam && git pull)" ]
  - [ bash, -lc, "cd /opt/zerospam && AWS_REGION=${region} bash scripts/entrypoint.sh /data/app.env" ]
  - [ bash, -lc, "cd /opt/zerospam && docker compose up -d --build" ]
```

> Note for the implementer: confirm the data-volume device name on first boot (`/dev/nvme1n1` on Nitro/ARM instances; the `/dev/sdf` attachment maps there). The runbook documents verifying with `lsblk`.

- [ ] **Step 6: outputs.tf**

```hcl
output "eip" {
  description = "Elastic IP — put this in the A records for zero-spam.email and mail.zero-spam.email"
  value       = aws_eip.zerospam.public_ip
}

output "ses_dkim_cnames" {
  description = "Add each as a CNAME: <token>._domainkey.zero-spam.email -> <token>.dkim.amazonses.com"
  value       = [for t in aws_ses_domain_dkim.zerospam.dkim_tokens : "${t}._domainkey.${var.domain} CNAME ${t}.dkim.amazonses.com"]
}

output "ses_smtp_username" {
  value = aws_iam_access_key.ses_smtp.id
}

output "ses_smtp_password" {
  description = "SES SMTP password (derived). Store in SSM as RELAY_PASS."
  value       = aws_iam_access_key.ses_smtp.ses_smtp_password_v4
  sensitive   = true
}
```

- [ ] **Step 7: terraform.tfvars.example**

```hcl
region           = "us-east-1"
domain           = "zero-spam.email"
instance_type    = "t4g.small"
ssh_ingress_cidr = "203.0.113.10/32" # your IP/32
key_name         = "your-ec2-keypair"
repo_url         = "https://github.com/youruser/zerospam-email.git"
data_volume_gb   = 20
```

- [ ] **Step 8: Validate**

Run:
```bash
cd infra/terraform
terraform fmt -check
terraform init -backend=false
terraform validate
```
Expected: `Success! The configuration is valid.`

- [ ] **Step 9: Commit**

```bash
git add infra/terraform
git commit -m "infra: Terraform for EC2 + EIP + SG + EBS + SES + DLM snapshots"
```

---

## Task 10: Deployment runbook

**Files:**
- Create: `docs/deploy-runbook.md`

- [ ] **Step 1: Write the runbook**

Create `docs/deploy-runbook.md` covering, in order:
```markdown
# ZeroSpam Deployment Runbook (zero-spam.email)

Prereqs: an AWS account, an EC2 key pair, awscli v2 configured, Terraform >= 1.6,
the domain's DNS managed at your registrar.

## Phase 0 — SES (start first; production access takes ~24h)
1. `cd infra/terraform && terraform init && terraform apply` creates the SES domain
   identity + DKIM. Run `terraform output ses_dkim_cnames` and add the 3 CNAMEs at
   the registrar. SES marks the domain "verified" once they propagate.
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
| CNAME ×3 | (from ses_dkim_cnames) | … |
| TXT | zs1._domainkey.zero-spam.email | (from the app DNS panel after first boot) |

## Phase 3 — Secrets to SSM
For each, generate 32+ random chars (`openssl rand -base64 32`):
```
aws ssm put-parameter --type SecureString --name /zerospam/prod/SESSION_SECRET --value "..."
aws ssm put-parameter --type SecureString --name /zerospam/prod/CONNECTION_SECRET --value "..."
aws ssm put-parameter --type SecureString --name /zerospam/prod/DIGEST_SIGNING_SECRET --value "..."
aws ssm put-parameter --type SecureString --name /zerospam/prod/RELAY_USER --value "$(terraform output -raw ses_smtp_username)"
aws ssm put-parameter --type SecureString --name /zerospam/prod/RELAY_PASS --value "$(terraform output -raw ses_smtp_password)"
```
Plus the non-secret vars from `server/.env.production.example` (NODE_ENV, PUBLIC_BASE_URL,
SEND_MODE, RELAY_HOST, etc.) as `String` parameters under the same prefix.

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
- Caddy obtains the cert once the A record resolves. Find the issued cert path under
  the `caddy_data` volume and set `TLS_CERT_PATH`/`TLS_KEY_PATH` SSM params to it, then
  re-render app.env and `docker compose up -d` to enable SMTP STARTTLS.

## Phase 5 — Bootstrap
- Create the owner: `docker compose exec app node server/dist/seed-owner.js --email you@zero-spam.email --password '...'`
  (or run via the app's seed-owner path).
- Ensure system mailboxes exist: postmaster@, abuse@, dmarc@zero-spam.email.

## Phase 6 — Verify
- Web: open https://zero-spam.email (valid TLS).
- Inbound: from Gmail, mail you@zero-spam.email; confirm it appears. `dig MX zero-spam.email`;
  `openssl s_client -starttls smtp -connect <eip>:25`.
- Outbound: sign up a new user; confirm the verification email arrives at an external inbox
  with SPF/DKIM/DMARC = pass (Gmail "Show original"); run a mail-tester.com check.

## Rollback
`terraform destroy` (data persists in EBS snapshots) or point DNS away.
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy-runbook.md
git commit -m "docs(deploy): end-to-end deployment runbook"
```

---

## Final verification

- [ ] `npm test --workspace=server` — all tests pass.
- [ ] `npm run build --workspace=web && npm run build --workspace=server` — both build clean.
- [ ] `docker build -t zerospam:local .` — image builds; container answers `/api/health`.
- [ ] `cd infra/terraform && terraform init -backend=false && terraform validate` — valid.
- [ ] Spec coverage: every section of `2026-06-12-aws-deployment-design.md` maps to a task
      (app changes → Tasks 1-4; packaging → Tasks 6-7; secrets → Task 8; AWS → Task 9;
      DNS/SES/rollout/verify → Task 10).
```
