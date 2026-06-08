import { db } from './db.js';
import type { Connection } from './db.js';
import { encryptToken, decryptToken } from './connection-crypto.js';
import { loadConnectionSecret } from './config.js';
import type { OAuthTokens } from './connectors/types.js';

export type ConnectionSummary = {
  id: number;
  provider: 'gmail' | 'outlook';
  email: string;
  status: 'active' | 'needs_reconnect' | 'paused';
  lastPolledAt: number | null;
  lastError: string | null;
  createdAt: number;
};

export type UpsertArgs = {
  accountId: number;
  mailboxId: number;
  provider: 'gmail' | 'outlook';
  tokens: OAuthTokens;
  cursor: string;
};

export function upsertConnection(args: UpsertArgs): number {
  const key = loadConnectionSecret();
  const access = encryptToken(args.tokens.accessToken, key);
  const refresh = encryptToken(args.tokens.refreshToken, key);
  const existing = db
    .prepare('SELECT id FROM connections WHERE mailbox_id = ?')
    .get(args.mailboxId) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE connections
         SET access_enc = ?, refresh_enc = ?, expires_at = ?, cursor = ?,
             status = 'active', last_error = NULL, consecutive_failures = 0
       WHERE id = ?`,
    ).run(access, refresh, args.tokens.expiresAt, args.cursor, existing.id);
    return existing.id;
  }
  const r = db
    .prepare(
      `INSERT INTO connections
         (account_id, mailbox_id, provider, access_enc, refresh_enc, expires_at,
          cursor, status, last_polled_at, consecutive_failures, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL, 0, ?) RETURNING id`,
    )
    .get(
      args.accountId, args.mailboxId, args.provider, access, refresh,
      args.tokens.expiresAt, args.cursor, Date.now(),
    ) as { id: number };
  return r.id;
}

export function getDecryptedTokens(id: number): OAuthTokens | null {
  const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as Connection | undefined;
  if (!row) return null;
  const key = loadConnectionSecret();
  const accessToken = decryptToken(row.access_enc, key);
  const refreshToken = decryptToken(row.refresh_enc, key);
  if (accessToken == null || refreshToken == null) return null;
  return { accessToken, refreshToken, expiresAt: row.expires_at };
}

export function persistTokens(id: number, tokens: OAuthTokens): void {
  const key = loadConnectionSecret();
  db.prepare('UPDATE connections SET access_enc = ?, refresh_enc = ?, expires_at = ? WHERE id = ?').run(
    encryptToken(tokens.accessToken, key),
    encryptToken(tokens.refreshToken, key),
    tokens.expiresAt,
    id,
  );
}

export function listConnectionsForAccount(accountId: number): ConnectionSummary[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.provider, c.status, c.last_polled_at, c.last_error, c.created_at, m.address
         FROM connections c JOIN mailboxes m ON m.id = c.mailbox_id
        WHERE c.account_id = ? ORDER BY c.created_at DESC`,
    )
    .all(accountId) as Array<{
      id: number; provider: 'gmail' | 'outlook'; status: ConnectionSummary['status'];
      last_polled_at: number | null; last_error: string | null; created_at: number; address: string;
    }>;
  return rows.map((r) => ({
    id: r.id, provider: r.provider, email: r.address, status: r.status,
    lastPolledAt: r.last_polled_at, lastError: r.last_error, createdAt: r.created_at,
  }));
}

export function recordPollSuccess(id: number, cursor: string, now: number): void {
  db.prepare(
    `UPDATE connections
       SET cursor = ?, last_polled_at = ?, consecutive_failures = 0, last_error = NULL
     WHERE id = ?`,
  ).run(cursor, now, id);
}

export function recordPollFailure(id: number, error: string, now: number): void {
  db.prepare(
    `UPDATE connections
       SET consecutive_failures = consecutive_failures + 1, last_error = ?, last_polled_at = ?
     WHERE id = ?`,
  ).run(error, now, id);
}

export function markNeedsReconnect(id: number, error: string): void {
  db.prepare("UPDATE connections SET status = 'needs_reconnect', last_error = ? WHERE id = ?").run(error, id);
}

export function deleteConnection(id: number): void {
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
}
