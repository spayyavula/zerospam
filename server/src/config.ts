import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// SESSION_SECRET is required ONLY in production. In dev and test we fall back to
// a stable known value so `npm run dev`, `npm run seed:owner`, and the test suite
// all work out-of-the-box. The fail-fast in production guards against accidentally
// shipping with no secret configured.
export function parseSessionSecret(input: { value: string | undefined; isProd: boolean }): string {
  if (!input.value) {
    if (!input.isProd) return 'a'.repeat(64);
    throw new Error('Missing required env var: SESSION_SECRET');
  }
  if (input.value.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 chars');
  }
  return input.value;
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return ['http://localhost:5173'];
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
  sessionSecret: parseSessionSecret({
    value: process.env.SESSION_SECRET,
    isProd: process.env.NODE_ENV === 'production',
  }),
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  rateLimitLoginPerMin: envInt('RATE_LIMIT_LOGIN_PER_MIN', 10),
  rateLimitAuthPerMin: envInt('RATE_LIMIT_AUTH_PER_MIN', 30),
  isProd: process.env.NODE_ENV === 'production',
} as const;

export type Config = typeof config;
