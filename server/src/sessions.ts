import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type CreateSessionResult = {
  sessionId: string;
  cookieValue: string;
  expiresAt: number;
};

export type SessionValidation = {
  sessionId: string;
  userId: number;
  expiresAt: number;
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
  const expiresAt = now + SESSION_TTL_MS;
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
    .prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?')
    .get(sessionId) as { user_id: number; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  return { sessionId, userId: row.user_id, expiresAt: row.expires_at };
}

export function destroySession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function touchSession(sessionId: string): void {
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(
    Date.now() + SESSION_TTL_MS,
    sessionId,
  );
}

export const SESSION_COOKIE_NAME = 'zs_sid';
