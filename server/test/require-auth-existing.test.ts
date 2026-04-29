import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';

describe('existing routes are gated', () => {
  it('GET /api/mailboxes returns 401 without auth', async () => {
    const app = await startApi({ inject: true });
    const r = await app.inject({ method: 'GET', url: '/api/mailboxes' });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('GET /api/health stays public', async () => {
    const app = await startApi({ inject: true });
    const r = await app.inject({ method: 'GET', url: '/api/health' });
    expect(r.statusCode).toBe(200);
    await app.close();
  });
});
