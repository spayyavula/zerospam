import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

describe('tour routes', () => {
  it('POST /api/users/me/tour-complete sets timestamp and is idempotent', async () => {
    const app = await startApi();
    try {
      const { userId } = await seedOwner();
      const cookie = makeSessionCookie(userId);

      const first = await app.inject({
        method: 'POST',
        url: '/api/users/me/tour-complete',
        headers: { cookie },
      });
      expect(first.statusCode).toBe(200);

      const meAfterFirst = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });
      expect(meAfterFirst.statusCode).toBe(200);
      const firstTs = (meAfterFirst.json() as { user: { tour_completed_at: number | null } }).user.tour_completed_at;
      expect(typeof firstTs).toBe('number');

      const second = await app.inject({
        method: 'POST',
        url: '/api/users/me/tour-complete',
        headers: { cookie },
      });
      expect(second.statusCode).toBe(200);

      const meAfterSecond = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });
      const secondTs = (meAfterSecond.json() as { user: { tour_completed_at: number | null } }).user.tour_completed_at;
      expect(secondTs).toBe(firstTs);
    } finally {
      await app.close();
    }
  });

  it('GET /api/auth/me returns tour_completed_at', async () => {
    const app = await startApi();
    try {
      const { userId } = await seedOwner();
      const cookie = makeSessionCookie(userId);
      const r = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(r.statusCode).toBe(200);
      const body = r.json() as {
        user: { id: number; email: string; totp_enabled: boolean; tour_completed_at: number | null };
      };
      expect(body.user.tour_completed_at).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('POST /api/users/me/tour-complete returns 401 unauthenticated', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({ method: 'POST', url: '/api/users/me/tour-complete' });
      expect(r.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
