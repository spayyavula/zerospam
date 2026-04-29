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
} as const;

export type Config = typeof config;
