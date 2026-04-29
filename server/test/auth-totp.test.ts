// server/test/auth-totp.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authenticator } from 'otplib';
import { authRoutes } from '../src/routes/auth.js';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { getOwnerById } from '../src/users.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/auth/totp')) await requireAuth(req as any, reply as any);
  });
  await app.register(authRoutes);
  return app;
}

describe('TOTP setup → confirm → disable', () => {
  it('setup returns a secret + otpauth URI but does NOT enable yet', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/totp/setup',
      headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(body.otpauth_url).toMatch(/^otpauth:\/\//);
    // Not enabled yet — the secret is a *candidate*, stored in the user row but only confirmed below
    expect(getOwnerById(userId)!.totp_enabled_at).toBeNull();
  });

  it('confirm enables TOTP given a valid code', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    const setup = await app.inject({
      method: 'POST', url: '/api/auth/totp/setup',
      headers: { cookie: makeSessionCookie(userId) },
    });
    const { secret } = setup.json();
    const code = authenticator.generate(secret);
    const r = await app.inject({
      method: 'POST', url: '/api/auth/totp/confirm',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { code },
    });
    expect(r.statusCode).toBe(200);
    expect(getOwnerById(userId)!.totp_enabled_at).not.toBeNull();
  });

  it('confirm rejects a bad code', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/api/auth/totp/setup',
      headers: { cookie: makeSessionCookie(userId) },
    });
    const r = await app.inject({
      method: 'POST', url: '/api/auth/totp/confirm',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { code: '000000' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('disable requires the password and clears the secret', async () => {
    const { userId, password } = await seedOwner({ totp: true });
    const app = await buildApp();
    const r = await app.inject({
      method: 'DELETE', url: '/api/auth/totp',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { password },
    });
    expect(r.statusCode).toBe(200);
    expect(getOwnerById(userId)!.totp_secret).toBeNull();
  });
});
