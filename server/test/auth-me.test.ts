import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  // /me path needs requireAuth
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/auth/me')) await requireAuth(req as any, reply as any);
  });
  await app.register(authRoutes);
  return app;
}

describe('GET /api/auth/me', () => {
  it('returns the user when authenticated', async () => {
    const { userId, email } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET', url: '/api/auth/me', headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      user: { id: userId, email, totp_enabled: false, tour_completed_at: null },
    });
  });

  it('returns 401 without a session', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(r.statusCode).toBe(401);
  });
});
