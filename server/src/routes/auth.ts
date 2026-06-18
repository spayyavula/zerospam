import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getOwnerByEmail, getOwnerById, verifyPassword, updateOwnerPassword, setTotpSecret } from '../users.js';
import {
  verifyStoredTotp,
  generateTotpSecret,
  provisioningUri,
  encryptTotpSecret,
  isEncryptedTotpSecret,
} from '../totp.js';
import { createSession, destroySession, SESSION_COOKIE_NAME } from '../sessions.js';
import { config } from '../config.js';
import { recordAudit } from '../audit.js';
import { db } from '../db.js';
import { signVerifyToken } from '../verify-token.js';
import { getOrCreateSystemMailboxId } from '../system-mailbox.js';
import { renderVerifyEmailHtml, renderVerifyEmailText } from '../verify-email-template.js';
import { sendMessage } from '../sender.js';
import { requireAuth } from '../requireAuth.js';

async function dispatchVerificationEmail(app: FastifyInstance, userId: number, recipientEmail: string): Promise<void> {
  const mailboxId = getOrCreateSystemMailboxId();
  const expHours = config.verifyTokenExpiryHours;
  const exp = Date.now() + expHours * 3600 * 1000;
  const token = signVerifyToken({ v: 1, userId, exp }, config.sessionSecret);
  const verifyUrl = `${config.publicBaseUrl}/auth/verify?t=${encodeURIComponent(token)}`;
  const username = recipientEmail.split('@')[0];

  await sendMessage({
    mailboxId,
    to: [recipientEmail],
    subject: 'Verify your ZeroSpam email',
    text: renderVerifyEmailText({ username, verifyUrl, expiresHours: expHours }),
    html: renderVerifyEmailHtml({ username, verifyUrl, expiresHours: expHours }),
  });
}

// The owner "email" is a credential identifier, not a delivery address — accept
// any non-empty string containing '@' (e.g. me@local for dev) instead of zod's
// strict RFC-5322 email validator. Seed-owner uses the same loose policy.
const loginSchema = z.object({
  email: z.string().min(3).regex(/.+@.+/),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'password must be >=12 chars'),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', {
    config: {
      rateLimit: { max: config.rateLimitLoginPerMin, timeWindow: '1 minute' },
    },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid-body' });
      return;
    }
    const { email, password, totp } = parsed.data;
    const user = getOwnerByEmail(email);
    // req.ip is derived from X-Forwarded-For only when behind the trusted proxy
    // (config.trustProxy); never read the raw header, which clients can spoof.
    const ip = req.ip as string | undefined;
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

    if (!user.email_verified_at) {
      recordAudit({ event: 'login.fail', userId: user.id, detail: { reason: 'email-not-verified' }, ip, userAgent: ua });
      // Fire-and-forget verification-resend: do not await it. Awaiting would create
      // a timing oracle (this branch becomes measurably slower than bad-password),
      // recreating the email-existence leak the generic 401 was meant to close.
      void dispatchVerificationEmail(app, user.id, email).catch((e) => {
        app.log.warn({ err: e, userId: user.id }, 'login: verification-resend dispatch failed');
      });
      reply.code(401).send({ error: 'invalid-credentials' });
      return;
    }

    if (user.totp_enabled_at) {
      if (!totp) {
        return { needs_totp: true };
      }
      if (!user.totp_secret || !verifyStoredTotp(user.totp_secret, totp)) {
        recordAudit({ event: 'totp.fail', userId: user.id, ip, userAgent: ua });
        reply.code(401).send({ error: 'invalid-credentials' });
        return;
      }
      // Lazily migrate a legacy plaintext seed to encrypted-at-rest on first good verify.
      if (!isEncryptedTotpSecret(user.totp_secret)) {
        db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(
          encryptTotpSecret(user.totp_secret),
          user.id,
        );
      }
    }

    const { cookieValue } = createSession(user.id, config.sessionSecret, { ip: ip ?? null, userAgent: ua });
    reply.setCookie(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      path: '/',
      // Retain client-side up to the absolute cap; the server enforces the
      // sliding idle timeout and the hard cap on each request.
      maxAge: Math.floor(config.sessionAbsoluteTtlMs / 1000),
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
    return {
      user: {
        id: u.id,
        email: u.email,
        totp_enabled: !!u.totp_enabled_at,
        tour_completed_at: u.tour_completed_at ?? null,
      },
    };
  });

  app.post('/api/users/me/tour-complete', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    db.prepare('UPDATE users SET tour_completed_at = COALESCE(tour_completed_at, ?) WHERE id = ?').run(
      Date.now(),
      userId,
    );
    return { ok: true };
  });

  app.post('/api/auth/password', {
    config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
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

  app.post('/api/auth/totp/setup', {
    config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const u = getOwnerById(userId);
    if (!u) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const secret = generateTotpSecret();
    // Store the candidate seed encrypted-at-rest — totp_enabled_at stays null
    // until /confirm. The plaintext secret is returned once, here, for enrollment.
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled_at = NULL WHERE id = ?').run(
      encryptTotpSecret(secret),
      userId,
    );
    return { secret, otpauth_url: provisioningUri(u.email, secret) };
  });

  const totpConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
  app.post('/api/auth/totp/confirm', {
    config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) { reply.code(401).send({ error: 'unauthorized' }); return; }
    const parsed = totpConfirmSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
    const u = getOwnerById(userId);
    if (!u || !u.totp_secret) { reply.code(400).send({ error: 'no-pending-totp' }); return; }
    if (!verifyStoredTotp(u.totp_secret, parsed.data.code)) {
      recordAudit({ event: 'totp.fail', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
      reply.code(401).send({ error: 'invalid-code' });
      return;
    }
    db.prepare('UPDATE users SET totp_enabled_at = ? WHERE id = ?').run(Date.now(), userId);
    recordAudit({ event: 'totp.enabled', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { ok: true };
  });

  const totpDisableSchema = z.object({ password: z.string().min(1) });
  app.delete('/api/auth/totp', {
    config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
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

  // ── Device / bearer token management ───────────────────────────────────────
  // Mobile apps exchange a short-lived cookie session (established by /login)
  // for a long-lived per-device bearer token stored in SecureStore.

  const deviceRegisterSchema = z.object({
    name: z.string().min(1).max(120),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    appVersion: z.string().max(40).optional(),
  });

  app.post('/api/auth/devices', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.user!.id;
    const parsed = deviceRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(422).send({ error: 'invalid-body' });
      return;
    }
    const { name, platform, appVersion } = parsed.data;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = Date.now();
    db.prepare(
      `INSERT INTO devices (user_id, name, token_hash, platform, app_version, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, name, tokenHash, platform ?? null, appVersion ?? null, now, now);
    recordAudit({ event: 'device.register', userId, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    return { token: rawToken };
  });

  app.delete('/api/auth/devices/me', { preHandler: requireAuth }, async (req) => {
    const deviceId = req.device?.id;
    if (deviceId != null) {
      db.prepare('UPDATE devices SET revoked_at = ? WHERE id = ?').run(Date.now(), deviceId);
      recordAudit({ event: 'device.revoke', userId: req.user!.id, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });
    }
    return { ok: true };
  });
}
