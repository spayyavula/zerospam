import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

describe('requireAuth attaches account_id', () => {
  it('attaches req.account.id from the authenticated user', async () => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    app.addHook('preHandler', requireAuth);
    app.get('/echo', async (req) => ({
      userId: (req as any).user?.id,
      accountId: (req as any).account?.id,
    }));
    const { userId } = await seedOwner();
    const r = await app.inject({
      method: 'GET',
      url: '/echo',
      headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().accountId).toBe(1);
  });
});
