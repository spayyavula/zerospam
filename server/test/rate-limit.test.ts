import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from '../src/routes/auth.js';
import { config } from '../src/config.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(authRoutes);
  return app;
}

describe('rate limit', () => {
  it('limits /api/auth/login to RATE_LIMIT_LOGIN_PER_MIN per IP', async () => {
    const app = await buildApp();
    const max = config.rateLimitLoginPerMin;
    let lastStatus = 0;
    for (let i = 0; i < max + 2; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@x.com', password: 'whatever' },
      });
      lastStatus = r.statusCode;
    }
    expect(lastStatus).toBe(429);
  });
});
