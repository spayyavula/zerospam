import crypto from 'node:crypto';
import { db } from './db.js';
import { config } from './config.js';

export type CreateSessionResult = {
  sessionId: string;
  cookieValue: string;
  expiresAt: number;
};

export type SessionValidation = {
  sessionId: string;
  userId: number;
  expiresAt: number;
  accountId: number;
};

function hmac(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function createSession(
  userId: number,
  secret: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): CreateSessionResult {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + config.sessionIdleTtlMs;
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(sessionId, userId, now, expiresAt, meta.ip ?? null, meta.userAgent ?? null);
  return { sessionId, cookieValue: `${sessionId}.${hmac(secret, sessionId)}`, expiresAt };
}

export function validateCookie(cookieValue: string, secret: string): SessionValidation | null {
  const dot = cookieValue.indexOf('.');
  if (dot < 0) return null;
  const sessionId = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!/^[a-f0-9]{64}$/.test(sessionId) || !/^[a-f0-9]{64}$/.test(sig)) return null;
  const expected = hmac(secret, sessionId);
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  const row = db
    .prepare(
      `SELECT s.user_id, s.created_at, s.expires_at, u.account_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(sessionId) as
    | { user_id: number; created_at: number; expires_at: number; account_id: number }
    | undefined;
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at < now) return null; // idle timeout (sliding)
  if (row.created_at + config.sessionAbsoluteTtlMs < now) return null; // absolute cap
  return { sessionId, userId: row.user_id, expiresAt: row.expires_at, accountId: row.account_id };
}

export function destroySession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function touchSession(sessionId: string): void {
  // Slide the idle window forward, but never past the absolute cap
  // (created_at + sessionAbsoluteTtlMs). SQLite MIN() returns the smaller arg.
  db.prepare('UPDATE sessions SET expires_at = MIN(?, created_at + ?) WHERE id = ?').run(
    Date.now() + config.sessionIdleTtlMs,
    config.sessionAbsoluteTtlMs,
    sessionId,
  );
}

export const SESSION_COOKIE_NAME = 'zs_sid';
