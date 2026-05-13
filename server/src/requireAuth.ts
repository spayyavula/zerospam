import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { db, SYSTEM_ACCOUNT_ID } from './db.js';
import { validateCookie, touchSession, SESSION_COOKIE_NAME } from './sessions.js';
import { config } from './config.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: number };
    session?: { id: string };
    device?: { id: number };
    account?: { id: number };
  }
}

function hashToken(t: string): string {
  return crypto.createHash('sha256').update(t).digest('hex');
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 1. Cookie session
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const cookieValue = cookies?.[SESSION_COOKIE_NAME];
  if (cookieValue) {
    const v = validateCookie(cookieValue, config.sessionSecret);
    if (v) {
      req.user = { id: v.userId };
      req.session = { id: v.sessionId };
      req.account = { id: v.accountId };
      // Sliding window: refresh expiry on every authenticated request.
      touchSession(v.sessionId);
    }
  }

  // 2. Bearer token (Phase B+ uses devices; Phase A still validates the table for forward compat)
  if (!req.account) {
    const auth = req.headers.authorization;
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice('bearer '.length).trim();
      if (token) {
        const row = db
          .prepare(
            `SELECT d.id, d.user_id, u.account_id
             FROM devices d
             JOIN users u ON u.id = d.user_id
             WHERE d.token_hash = ? AND d.revoked_at IS NULL`,
          )
          .get(hashToken(token)) as { id: number; user_id: number; account_id: number } | undefined;
        if (row) {
          req.user = { id: row.user_id };
          req.device = { id: row.id };
          req.account = { id: row.account_id };
          db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(Date.now(), row.id);
        }
      }
    }
  }

  // Defense-in-depth: SYSTEM_ACCOUNT_ID=0 is reserved for the noreply mailbox.
  // No real user should ever reside there. Reject any session that resolves to it.
  if (!req.account || req.account.id === SYSTEM_ACCOUNT_ID) {
    reply.code(401).send({ error: 'unauthorized' });
    return;
  }
}
