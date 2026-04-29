import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { getOwnerById, verifyPassword } from '../src/users.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/auth/password')) await requireAuth(req as any, reply as any);
  });
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/password', () => {
  it('updates the hash given the correct current password', async () => {
    const { userId, password } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { currentPassword: password, newPassword: 'NewerPass!12345' },
    });
    expect(r.statusCode).toBe(200);
    const fresh = getOwnerById(userId)!;
    expect(await verifyPassword(fresh.password_hash, 'NewerPass!12345')).toBe(true);
  });

  it('returns 401 if the current password is wrong', async () => {
    const { userId } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { currentPassword: 'WRONG', newPassword: 'whatever1234' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('rejects a too-short new password', async () => {
    const { userId, password } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { currentPassword: password, newPassword: 'short' },
    });
    expect(r.statusCode).toBe(400);
  });
});
