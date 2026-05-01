import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { db } from './db.js';
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
      // Sliding window: refresh expiry on every authenticated request.
      touchSession(v.sessionId);
      const userRow = db
        .prepare('SELECT account_id FROM users WHERE id = ?')
        .get(v.userId) as { account_id: number } | undefined;
      if (userRow) req.account = { id: userRow.account_id };
      return;
    }
  }

  // 2. Bearer token (Phase B+ uses devices; Phase A still validates the table for forward compat)
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token) {
      const row = db
        .prepare(
          `SELECT id, user_id FROM devices WHERE token_hash = ? AND revoked_at IS NULL`,
        )
        .get(hashToken(token)) as { id: number; user_id: number } | undefined;
      if (row) {
        req.user = { id: row.user_id };
        req.device = { id: row.id };
        db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(Date.now(), row.id);
        const userRow = db
          .prepare('SELECT account_id FROM users WHERE id = ?')
          .get(row.user_id) as { account_id: number } | undefined;
        if (userRow) req.account = { id: userRow.account_id };
        return;
      }
    }
  }

  reply.code(401).send({ error: 'unauthorized' });
}
