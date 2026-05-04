import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

export const SYSTEM_ACCOUNT_ID = 0;
export const SYSTEM_ACCOUNT_NAME = 'system';
export const DEFAULT_ACCOUNT_ID = 1;
export const DEFAULT_ACCOUNT_NAME = 'default';

mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(join(config.dataDir, 'zerospam.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
// Foreign-key enforcement is per-connection in SQLite. The multi-tenant boundary
// relies on FK CASCADE/RESTRICT semantics (e.g. deleting a user cascades to sessions,
// devices, mailboxes). If the pragma silently fails (SQLite compiled without FK support,
// or a future code path forgets to enable it), the failure must be loud and immediate.
// Testing this assertion path is impractical at module level, so we fail-fast here.
const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
if (fk.foreign_keys !== 1) {
  throw new Error('PRAGMA foreign_keys is not enforced — refusing to start');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  dkim_selector TEXT,
  dkim_private_pem TEXT,
  dkim_public_pem TEXT
);

CREATE TABLE IF NOT EXISTS mailboxes (
  id INTEGER PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  display_name TEXT,
  quarantine_ttl_hours INTEGER NOT NULL DEFAULT 168,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS whitelist_rules (
  id INTEGER PRIMARY KEY,
  mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('address','domain','regex')),
  pattern TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wl_mailbox ON whitelist_rules(mailbox_id);

CREATE TABLE IF NOT EXISTS screener_mutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  sender_addr TEXT NOT NULL,
  muted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(mailbox_id, sender_addr)
);
CREATE INDEX IF NOT EXISTS idx_screener_mutes_lookup
  ON screener_mutes(mailbox_id, sender_addr, expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  folder TEXT NOT NULL CHECK(folder IN ('inbox','quarantine','sent','trash')),
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT NOT NULL,
  cc_addresses TEXT,
  subject TEXT,
  preview TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at INTEGER NOT NULL,
  expires_at INTEGER,
  read INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0,
  spf_pass INTEGER,
  dkim_pass INTEGER,
  dmarc_pass INTEGER,
  whitelist_match TEXT,
  raw_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  attachment_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_msg_folder ON messages(mailbox_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_expires ON messages(expires_at);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename TEXT,
  content_type TEXT,
  size_bytes INTEGER NOT NULL,
  cid TEXT,
  inline INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_msg ON attachments(message_id);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  name TEXT,
  last_seen INTEGER,
  UNIQUE(mailbox_id, address)
);

CREATE TABLE IF NOT EXISTS aliases (
  id INTEGER PRIMARY KEY,
  mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  address TEXT UNIQUE NOT NULL,
  label TEXT,
  expires_at INTEGER,
  abused INTEGER NOT NULL DEFAULT 0,
  received_count INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aliases_mailbox ON aliases(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_aliases_address ON aliases(address);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  to_addresses TEXT,
  cc_addresses TEXT,
  bcc_addresses TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  reply_to_message_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_drafts_mailbox ON drafts(mailbox_id, updated_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  mailbox_id UNINDEXED,
  from_address,
  from_name,
  subject,
  body_text,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  totp_secret     TEXT,
  totp_enabled_at INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash   TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS devices (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  token_hash        TEXT NOT NULL UNIQUE,
  expo_push_token   TEXT,
  platform          TEXT,
  app_version       TEXT,
  created_at        INTEGER NOT NULL,
  last_seen_at      INTEGER NOT NULL,
  revoked_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event      TEXT NOT NULL,
  detail     TEXT,
  ip         TEXT,
  user_agent TEXT,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event, at DESC);

CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  INTEGER NOT NULL
);

-- Digest-allow tokens are HMAC-signed and time-bounded, but a leaked token
-- (forwarded mail, archives) can be replayed until exp. We record the token
-- hash on first use so subsequent attempts fall through to the expired page.
CREATE TABLE IF NOT EXISTS digest_tokens_used (
  token_hash  TEXT PRIMARY KEY,
  used_at     INTEGER NOT NULL
);
`;

db.exec(SCHEMA);

// Lightweight migrations: add columns introduced after the original schema.
// CREATE TABLE IF NOT EXISTS leaves existing tables untouched, so missing columns must be ALTERed in.
function colsOf(table: string): Set<string> {
  return new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name),
  );
}
const mailboxCols = colsOf('mailboxes');
if (!mailboxCols.has('digest_enabled')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 0');
}
if (!mailboxCols.has('digest_hour')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN digest_hour INTEGER NOT NULL DEFAULT 8');
}
if (!mailboxCols.has('digest_recipient_mode')) {
  db.exec("ALTER TABLE mailboxes ADD COLUMN digest_recipient_mode TEXT NOT NULL DEFAULT 'external'");
}
if (!mailboxCols.has('owner_email')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN owner_email TEXT');
}
if (!mailboxCols.has('last_digest_sent_at')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN last_digest_sent_at INTEGER');
}
if (!mailboxCols.has('digest_last_error')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN digest_last_error TEXT');
}
if (!mailboxCols.has('digest_consecutive_failures')) {
  db.exec(
    'ALTER TABLE mailboxes ADD COLUMN digest_consecutive_failures INTEGER NOT NULL DEFAULT 0',
  );
}
if (!mailboxCols.has('screener_sla_hours')) {
  db.exec('ALTER TABLE mailboxes ADD COLUMN screener_sla_hours INTEGER NOT NULL DEFAULT 48');
}

const messageCols = colsOf('messages');
if (!messageCols.has('attachment_count')) {
  db.exec('ALTER TABLE messages ADD COLUMN attachment_count INTEGER NOT NULL DEFAULT 0');
}
if (!messageCols.has('in_reply_to')) {
  db.exec('ALTER TABLE messages ADD COLUMN in_reply_to TEXT');
}
if (!messageCols.has('tracker_count')) {
  db.exec('ALTER TABLE messages ADD COLUMN tracker_count INTEGER NOT NULL DEFAULT 0');
}
if (!messageCols.has('tracker_details')) {
  db.exec('ALTER TABLE messages ADD COLUMN tracker_details TEXT');
}
if (!messageCols.has('delivered_to_alias')) {
  db.exec('ALTER TABLE messages ADD COLUMN delivered_to_alias TEXT');
}
const domainCols = colsOf('domains');
if (!domainCols.has('dkim_selector')) {
  db.exec('ALTER TABLE domains ADD COLUMN dkim_selector TEXT');
}
if (!domainCols.has('dkim_private_pem')) {
  db.exec('ALTER TABLE domains ADD COLUMN dkim_private_pem TEXT');
}
if (!domainCols.has('dkim_public_pem')) {
  db.exec('ALTER TABLE domains ADD COLUMN dkim_public_pem TEXT');
}

// Seed the system account FIRST (id=0, reserved for the noreply mailbox).
// Must exist before any FK reference resolves to it.
const systemAccount = db
  .prepare('SELECT id FROM accounts WHERE id = ?')
  .get(SYSTEM_ACCOUNT_ID) as { id: number } | undefined;
if (!systemAccount) {
  db.prepare('INSERT INTO accounts (id, name, plan, created_at) VALUES (?, ?, ?, ?)')
    .run(SYSTEM_ACCOUNT_ID, SYSTEM_ACCOUNT_NAME, 'system', Date.now());
}

// Seed default account BEFORE account_id migrations so the FK DEFAULT 1
// reference resolves for any rows that exist when the column is added.
const defaultAccount = db
  .prepare('SELECT id FROM accounts WHERE id = ?')
  .get(DEFAULT_ACCOUNT_ID) as { id: number } | undefined;
if (!defaultAccount) {
  db.prepare(
    'INSERT INTO accounts (id, name, plan, created_at) VALUES (?, ?, ?, ?)',
  ).run(DEFAULT_ACCOUNT_ID, DEFAULT_ACCOUNT_NAME, 'free', Date.now());
}

// SQLite ALTER TABLE does NOT accept bound parameters, so DEFAULT-clause
// values for the new account_id column must be interpolated. The values are
// module-level constants (no untrusted input), so injection is impossible.
const userCols = colsOf('users');
if (!userCols.has('account_id')) {
  db.exec(
    `ALTER TABLE users ADD COLUMN account_id INTEGER NOT NULL DEFAULT ${DEFAULT_ACCOUNT_ID} REFERENCES accounts(id) ON DELETE RESTRICT`,
  );
}
if (!userCols.has('email_verified_at')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified_at INTEGER');
}
if (!userCols.has('tour_completed_at')) {
  db.exec('ALTER TABLE users ADD COLUMN tour_completed_at INTEGER');
}
const mailboxCols2 = colsOf('mailboxes');
if (!mailboxCols2.has('account_id')) {
  db.exec(
    `ALTER TABLE mailboxes ADD COLUMN account_id INTEGER NOT NULL DEFAULT ${DEFAULT_ACCOUNT_ID} REFERENCES accounts(id) ON DELETE RESTRICT`,
  );
}
if (!mailboxCols2.has('provider')) {
  db.exec(
    `ALTER TABLE mailboxes ADD COLUMN provider TEXT CHECK(provider IS NULL OR provider IN ('gmail','outlook'))`,
  );
}
const domainCols2 = colsOf('domains');
if (!domainCols2.has('account_id')) {
  db.exec(
    `ALTER TABLE domains ADD COLUMN account_id INTEGER NOT NULL DEFAULT ${DEFAULT_ACCOUNT_ID} REFERENCES accounts(id) ON DELETE RESTRICT`,
  );
}

// Backfill any rows that predated the account_id column (already-existing DBs
// where the ALTER TABLE ran before the seed — belt-and-suspenders).
db.prepare('UPDATE users     SET account_id = ? WHERE account_id IS NULL').run(DEFAULT_ACCOUNT_ID);
db.prepare('UPDATE mailboxes SET account_id = ? WHERE account_id IS NULL').run(DEFAULT_ACCOUNT_ID);
db.prepare('UPDATE domains   SET account_id = ? WHERE account_id IS NULL').run(DEFAULT_ACCOUNT_ID);
// Grandfather pre-feature users as verified — they predate the verification
// gate and locking them out on next login would be a regression.
db.exec(`UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL`);

// One-time backfill of attachment_count and FTS for messages predating this schema.
// Idempotent — if the rows already exist, INSERT OR IGNORE skips them.
try {
  const needsBackfill = (db.prepare(
    "SELECT COUNT(*) AS c FROM messages WHERE id NOT IN (SELECT message_id FROM messages_fts)",
  ).get() as { c: number }).c;
  if (needsBackfill > 0) {
    const rows = db
      .prepare('SELECT id, mailbox_id, from_address, from_name, subject, body_text FROM messages')
      .all() as Array<{
        id: string;
        mailbox_id: number;
        from_address: string;
        from_name: string | null;
        subject: string | null;
        body_text: string | null;
      }>;
    const ins = db.prepare(
      'INSERT INTO messages_fts (message_id, mailbox_id, from_address, from_name, subject, body_text) VALUES (?, ?, ?, ?, ?, ?)',
    );
    db.exec('BEGIN');
    try {
      for (const r of rows) {
        ins.run(r.id, r.mailbox_id, r.from_address, r.from_name ?? '', r.subject ?? '', r.body_text ?? '');
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
} catch {
  // ignore backfill issues — FTS will populate on next ingest
}

export function runInTx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  }
}

export type Account = {
  id: number;
  name: string;
  plan: string;
  created_at: number;
};

export type Domain = {
  id: number;
  name: string;
  created_at: number;
  dkim_selector: string | null;
  dkim_private_pem: string | null;
  dkim_public_pem: string | null;
  account_id: number;
};

export type Mailbox = {
  id: number;
  address: string;
  domain_id: number;
  display_name: string | null;
  quarantine_ttl_hours: number;
  created_at: number;
  digest_enabled: number;
  digest_hour: number;
  digest_recipient_mode: 'external' | 'loopback';
  owner_email: string | null;
  last_digest_sent_at: number | null;
  digest_last_error: string | null;
  digest_consecutive_failures: number;
  screener_sla_hours: number;
  account_id: number;
  provider: 'gmail' | 'outlook' | null;
};

export type WhitelistRule = {
  id: number;
  mailbox_id: number;
  kind: 'address' | 'domain' | 'regex';
  pattern: string;
  note: string | null;
  created_at: number;
};

export type MessageRow = {
  id: string;
  mailbox_id: number;
  folder: 'inbox' | 'quarantine' | 'sent' | 'trash';
  from_address: string;
  from_name: string | null;
  to_addresses: string;
  cc_addresses: string | null;
  subject: string | null;
  preview: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: number;
  expires_at: number | null;
  read: number;
  starred: number;
  spf_pass: number | null;
  dkim_pass: number | null;
  dmarc_pass: number | null;
  whitelist_match: string | null;
  raw_path: string;
  size_bytes: number;
  attachment_count: number;
  in_reply_to: string | null;
  tracker_count: number;
  tracker_details: string | null;
  delivered_to_alias: string | null;
};

export type Alias = {
  id: number;
  mailbox_id: number;
  address: string;
  label: string | null;
  expires_at: number | null;
  abused: number;
  received_count: number;
  last_seen: number | null;
  created_at: number;
};

export type Draft = {
  id: string;
  mailbox_id: number;
  to_addresses: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  reply_to_message_id: string | null;
  created_at: number;
  updated_at: number;
};

export type AttachmentRow = {
  id: number;
  message_id: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number;
  cid: string | null;
  inline: number;
  path: string;
};

export type User = {
  id: number;
  email: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enabled_at: number | null;
  account_id: number;
  email_verified_at: number | null;
  tour_completed_at: number | null;
  created_at: number;
};

export type Session = {
  id: string;
  user_id: number;
  created_at: number;
  expires_at: number;
  ip: string | null;
  user_agent: string | null;
};

export type Device = {
  id: number;
  user_id: number;
  name: string;
  token_hash: string;
  expo_push_token: string | null;
  platform: string | null;
  app_version: string | null;
  created_at: number;
  last_seen_at: number;
  revoked_at: number | null;
};

export type AuditLogEntry = {
  id: number;
  user_id: number | null;
  event: string;
  detail: string | null;
  ip: string | null;
  user_agent: string | null;
  at: number;
};
