import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}: ${v}`);
  return n;
}

// Default the data dir to <server>/data so the location is stable regardless of cwd
// (matters when scripts are invoked from the monorepo root vs server/).
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDataDir = resolve(SERVER_ROOT, 'data');

// Outbound delivery mode:
//   'loopback' (default, for dev) — submits sent mail back to our own SMTP on localhost,
//                                   so messages to local mailboxes round-trip through ingest.
//   'relay'                       — uses an SMTP relay (RELAY_HOST/PORT/USER/PASS) for real delivery.
const sendMode = (process.env.SEND_MODE ?? 'loopback') as 'loopback' | 'relay';

// In dev/test, persist a random secret to dataDir/.session-secret rather than
// using a known constant. This means the dev secret is stable across restarts
// (sessions survive server restarts) but unpredictable (no known default to exploit).
export function loadOrCreateSessionSecret(input: { value: string | undefined; isProd: boolean; dataDir: string }): string {
  if (input.value) {
    if (input.value.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 chars');
    }
    return input.value;
  }
  if (input.isProd) {
    throw new Error('Missing required env var: SESSION_SECRET');
  }
  // Dev/test: persist a random secret to dataDir/.session-secret
  mkdirSync(input.dataDir, { recursive: true });
  const path = join(input.dataDir, '.session-secret');
  if (existsSync(path)) {
    const persisted = readFileSync(path, 'utf8').trim();
    if (persisted.length >= 32) return persisted;
  }
  const secret = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  writeFileSync(path, secret, { mode: 0o600 });
  return secret;
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084',
      'http://127.0.0.1:8081',
      'http://127.0.0.1:8082',
      'http://127.0.0.1:8083',
      'http://127.0.0.1:8084',
      'http://localhost:19006',
      'http://127.0.0.1:19006',
    ];
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  smtpPort: envInt('SMTP_PORT', 2525),
  apiPort: envInt('API_PORT', 8025),
  dataDir: process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : defaultDataDir,
  quarantineTtlHours: envInt('QUARANTINE_TTL_HOURS', 168),
  sweeperIntervalSec: envInt('SWEEPER_INTERVAL_SEC', 60),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  sendMode,
  relay: {
    host: process.env.RELAY_HOST ?? '',
    port: envInt('RELAY_PORT', 587),
    user: process.env.RELAY_USER ?? '',
    pass: process.env.RELAY_PASS ?? '',
    secure: (process.env.RELAY_SECURE ?? '').toLowerCase() === 'true',
  },
  dkim: {
    selector: process.env.DKIM_SELECTOR ?? 'zs1',
  },
  sessionSecret: loadOrCreateSessionSecret({
    value: process.env.SESSION_SECRET,
    isProd: process.env.NODE_ENV === 'production',
    dataDir: process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : defaultDataDir,
  }),
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  rateLimitLoginPerMin: envInt('RATE_LIMIT_LOGIN_PER_MIN', 10),
  rateLimitSignupPerMin: envInt('RATE_LIMIT_SIGNUP_PER_MIN', 5),
  rateLimitAuthPerMin: envInt('RATE_LIMIT_AUTH_PER_MIN', 30),
  isProd: process.env.NODE_ENV === 'production',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  digestTickIntervalSec: envInt('DIGEST_TICK_INTERVAL_SEC', 60),
  signupDomain: process.env.SIGNUP_DOMAIN ?? 'zero-spam.email',
  verifyTokenExpiryHours: envInt('VERIFY_TOKEN_EXPIRY_HOURS', 24),
} as const;

export type Config = typeof config;

// Lazy-loaded so tests can mutate process.env between calls.
export function loadDigestSigningSecret(): string {
  const fromEnv = process.env.DIGEST_SIGNING_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  mkdirSync(config.dataDir, { recursive: true });
  const path = join(config.dataDir, '.digest-secret');
  if (existsSync(path)) {
    const persisted = readFileSync(path, 'utf8').trim();
    if (persisted.length > 0) return persisted;
  }

  const secret = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  writeFileSync(path, secret, { mode: 0o600 });
  return secret;
}

export function assertPublicBaseUrlIfDigestEnabled(anyMailboxHasDigest: boolean): void {
  if (anyMailboxHasDigest && !config.publicBaseUrl) {
    throw new Error(
      'PUBLIC_BASE_URL is unset but at least one mailbox has digest_enabled=1. Set PUBLIC_BASE_URL in env.',
    );
  }
}
