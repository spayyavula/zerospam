import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { signupRoutes } from '../src/routes/signup.js';
import { db } from '../src/db.js';
import { signVerifyToken } from '../src/verify-token.js';
import { config } from '../src/config.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(signupRoutes);
  return app;
}

async function signUp(app: Awaited<ReturnType<typeof buildApp>>, username: string, email: string) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/signup',
    headers: { 'content-type': 'application/json' },
    payload: { email, password: 'correct-horse-battery-staple', username },
  });
  return r.json() as { userId: number; accountId: number };
}

describe('GET /auth/verify', () => {
  it('flips email_verified_at on a valid token', async () => {
    const app = await buildApp();
    try {
      const { userId } = await signUp(app, 'alice', 'alice@example.com');
      const token = signVerifyToken(
        { v: 1, userId, exp: Date.now() + 60_000 },
        config.sessionSecret,
      );
      const r = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      expect(r.statusCode).toBe(200);
      expect(r.body).toMatch(/verified/i);
      const u = db.prepare('SELECT email_verified_at FROM users WHERE id = ?').get(userId) as
        | { email_verified_at: number | null }
        | undefined;
      expect(u?.email_verified_at).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it('renders an error page for an invalid token', async () => {
    const app = await buildApp();
    try {
      const r = await app.inject({ method: 'GET', url: `/auth/verify?t=BOGUS` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toMatch(/invalid|expired/);
    } finally {
      await app.close();
    }
  });

  it('renders an error page for an expired token', async () => {
    const app = await buildApp();
    try {
      const { userId } = await signUp(app, 'bob', 'bob@example.com');
      const token = signVerifyToken(
        { v: 1, userId, exp: Date.now() - 1 },
        config.sessionSecret,
      );
      const r = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toMatch(/invalid|expired/);
    } finally {
      await app.close();
    }
  });

  it('is idempotent: a second click is still a success page', async () => {
    const app = await buildApp();
    try {
      const { userId } = await signUp(app, 'carol', 'carol@example.com');
      const token = signVerifyToken(
        { v: 1, userId, exp: Date.now() + 60_000 },
        config.sessionSecret,
      );
      const r1 = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      const r2 = await app.inject({ method: 'GET', url: `/auth/verify?t=${encodeURIComponent(token)}` });
      expect(r1.statusCode).toBe(200);
      expect(r2.statusCode).toBe(200);
      expect(r2.body).toMatch(/verified/i);
    } finally {
      await app.close();
    }
  });
});
