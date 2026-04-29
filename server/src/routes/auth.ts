import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getOwnerByEmail, getOwnerById, verifyPassword, updateOwnerPassword, setTotpSecret } from '../users.js';
import { verifyTotp, generateTotpSecret, provisioningUri } from '../totp.js';
import { createSession, destroySession, SESSION_COOKIE_NAME } from '../sessions.js';
import { config } from '../config.js';
import { recordAudit } from '../audit.js';
import { db } from '../db.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'password must be >=12 chars'),
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

    if (user.totp_enabled_at) {
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

  app.get('/api/auth/me', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    return { user: { id: u.id, email: u.email, totp_enabled: !!u.totp_enabled_at } };
  });

  app.post('/api/auth/password', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const ok = await verifyPassword(u.password_hash, parsed.data.currentPassword);
    if (!ok) { reply.code(401).send({ error: 'invalid-credentials' }); return; }
    await updateOwnerPassword(userId, parsed.data.newPassword);
    recordAudit({ event: 'password.changed', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { ok: true };
  });

  app.post('/api/auth/totp/setup', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const secret = generateTotpSecret();
    // Store as candidate — totp_enabled_at stays null until /confirm
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled_at = NULL WHERE id = ?').run(secret, userId);
    return { secret, otpauth_url: provisioningUri(u.email, secret) };
  });

  const totpConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
  app.post('/api/auth/totp/confirm', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const parsed = totpConfirmSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
    const u = getOwnerById(userId);
    if (!u || !u.totp_secret) { reply.code(400).send({ error: 'no-pending-totp' }); return; }
    if (!verifyTotp(u.totp_secret, parsed.data.code)) {
      recordAudit({ event: 'totp.fail', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
      reply.code(401).send({ error: 'invalid-code' });
      return;
    }
    db.prepare('UPDATE users SET totp_enabled_at = ? WHERE id = ?').run(Date.now(), userId);
    recordAudit({ event: 'totp.enabled', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { ok: true };
  });

  const totpDisableSchema = z.object({ password: z.string().min(1) });
  app.delete('/api/auth/totp', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const parsed = totpDisableSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    if (!(await verifyPassword(u.password_hash, parsed.data.password))) {
      reply.code(401).send({ error: 'invalid-credentials' }); return;
    }
    setTotpSecret(userId, null);
    recordAudit({ event: 'totp.disabled', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { ok: true };
  });
}
