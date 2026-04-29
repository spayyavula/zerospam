// server/test/e2e-auth.test.ts
import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { runSeedOwner } from '../src/seed-owner.js';

describe('e2e: bootstrap → login → protected → logout', () => {
  it('walks the complete path', async () => {
    await runSeedOwner({ argv: ['--email', 'e2e@example.com', '--password', 'hunter-correct-horse'] });
    const app = await startApi({ inject: true });

    // Protected route is 401
    let r = await app.inject({ method: 'GET', url: '/api/mailboxes' });
    expect(r.statusCode).toBe(401);

    // Login
    r = await app.inject({
      method: 'POST', url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'e2e@example.com', password: 'hunter-correct-horse' },
    });
    expect(r.statusCode).toBe(200);
    const setCookie = (r.headers['set-cookie'] as string | string[] | undefined);
    const cookieHeader = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(';')[0];

    // /me returns the user
    r = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);
    expect(r.json().user.email).toBe('e2e@example.com');

    // Protected route now succeeds
    r = await app.inject({ method: 'GET', url: '/api/mailboxes', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);

    // Logout
    r = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);

    // Now protected route is 401 again
    r = await app.inject({ method: 'GET', url: '/api/mailboxes', headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(401);

    await app.close();
  });
});
