import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { requireAuth } from '../src/requireAuth.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/sessions.js';
import { db } from '../src/db.js';
import { config } from '../src/config.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  app.addHook('preHandler', requireAuth);
  app.get('/secret', async (req: any) => ({ userId: req.user?.id }));
  return app;
}

describe('requireAuth', () => {
  it('returns 401 with no cookie and no bearer', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'GET', url: '/secret' });
    expect(r.statusCode).toBe(401);
  });

  it('returns 200 with a valid session cookie and exposes req.user', async () => {
    const userId = (db.prepare(
      'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
    ).get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue } = createSession(userId, config.sessionSecret);
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/secret',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ userId });
  });

  it('returns 401 for a revoked-/expired session', async () => {
    const userId = (db.prepare(
      'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
    ).get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue, sessionId } = createSession(userId, config.sessionSecret);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() - 1, sessionId);
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/secret',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(r.statusCode).toBe(401);
  });

  it('returns 401 for a bearer token in Phase A (no devices yet)', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/secret',
      headers: { authorization: 'Bearer aabbccdd' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('returns 401 for a lowercase-scheme bearer token (RFC-7235 case-insensitive)', async () => {
    // RFC 7235 §2.1: auth-scheme is case-insensitive. "bearer" must reach the
    // token-lookup branch; Phase A has no device rows so it still 401s.
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET',
      url: '/secret',
      headers: { authorization: 'bearer aabbccdd' },
    });
    expect(r.statusCode).toBe(401);
  });
});
