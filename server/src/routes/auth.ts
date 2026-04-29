import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getOwnerByEmail, verifyPassword } from '../users.js';
import { verifyTotp } from '../totp.js';
import { createSession, destroySession, SESSION_COOKIE_NAME } from '../sessions.js';
import { config } from '../config.js';
import { recordAudit } from '../audit.js';
import { db } from '../db.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid-body' });
      return;
    }
    const { email, password, totp } = parsed.data;
    const user = getOwnerByEmail(email);
    const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;

    if (!user) {
      recordAudit({ event: 'login.fail', detail: { reason: 'unknown-email', email }, ip, userAgent: ua });
      reply.code(401).send({ error: 'invalid-credentials' });
      return;
    }
    const ok = await verifyPassword(user.password_hash, password);
    if (!ok) {
      recordAudit({ event: 'login.fail', userId: user.id, detail: { reason: 'bad-password' }, ip, userAgent: ua });
      reply.code(401).send({ error: 'invalid-credentials' });
      return;
    }

    if (user.totp_secret) {
      if (!totp) {
        return { needs_totp: true };
      }
      if (!verifyTotp(user.totp_secret, totp)) {
        recordAudit({ event: 'totp.fail', userId: user.id, ip, userAgent: ua });
        reply.code(401).send({ error: 'invalid-credentials' });
        return;
      }
    }

    const { cookieValue } = createSession(user.id, config.sessionSecret, { ip: ip ?? null, userAgent: ua });
    reply.setCookie(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    recordAudit({ event: 'login.ok', userId: user.id, ip, userAgent: ua });
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const cookies = (req as any).cookies as Record<string, string> | undefined;
    const raw = cookies?.[SESSION_COOKIE_NAME];
    if (raw) {
      const dot = raw.indexOf('.');
      const sessionId = dot >= 0 ? raw.slice(0, dot) : raw;
      // Read the user id BEFORE destroying so we can audit who logged out.
      const row = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(sessionId) as { user_id: number } | undefined;
      const userId = row?.user_id ?? null;
      destroySession(sessionId);
      recordAudit({ event: 'logout', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  });
}
