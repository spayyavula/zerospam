import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createHash, randomBytes } from 'node:crypto';
import { requireAuth } from '../src/requireAuth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db } from '../src/db.js';

describe('requireAuth attaches account_id', () => {
  it('attaches req.account.id from the authenticated user (cookie)', async () => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    app.addHook('preHandler', requireAuth);
    app.get('/echo', async (req) => ({
      userId: (req as any).user?.id,
      accountId: (req as any).account?.id,
    }));
    const { userId, accountId } = await seedOwner();
    const r = await app.inject({
      method: 'GET',
      url: '/echo',
      headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().accountId).toBe(accountId);
  });

  it('attaches req.account.id from a bearer token', async () => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    app.addHook('preHandler', requireAuth);
    app.get('/echo', async (req) => ({
      accountId: (req as any).account?.id,
    }));
    const { userId, accountId } = await seedOwner({ email: 'bearer@example.com' });
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    db.prepare(
      'INSERT INTO devices (user_id, token_hash, name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, tokenHash, 'test-device', now, now);
    const r = await app.inject({
      method: 'GET',
      url: '/echo',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().accountId).toBe(accountId);
  });
});
