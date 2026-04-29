import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db } from '../src/db.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/logout', () => {
  it('clears the cookie and deletes the session row', async () => {
    const { userId } = await seedOwner();
    const cookieHeader = makeSessionCookie(userId);
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: cookieHeader },
    });
    expect(r.statusCode).toBe(200);
    const setCookie = r.headers['set-cookie'];
    expect(String(setCookie)).toContain('zs_sid=;');
    expect(db.prepare('SELECT count(*) AS c FROM sessions').get()).toEqual({ c: 0 });
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'logout'").get() as any;
    expect(audit.user_id).toBe(userId);
  });

  it('is idempotent without a cookie', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(r.statusCode).toBe(200);
  });
});
