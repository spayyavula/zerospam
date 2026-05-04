import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

async function authedApp() {
  const app = await startApi();
  const { userId } = await seedOwner();
  return { app, cookie: makeSessionCookie(userId) };
}

describe('PATCH /api/mailboxes/:id screener SLA', () => {
  it('rejects screener_sla_hours=0 with 422', async () => {
    const { app, cookie } = await authedApp();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { screenerSlaHours: 0 },
      });
      expect(r.statusCode).toBe(422);
    } finally {
      await app.close();
    }
  });

  it('rejects screener_sla_hours=721 with 422', async () => {
    const { app, cookie } = await authedApp();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { screenerSlaHours: 721 },
      });
      expect(r.statusCode).toBe(422);
    } finally {
      await app.close();
    }
  });

  it('accepts screener_sla_hours=24 and persists it', async () => {
    const { app, cookie } = await authedApp();
    try {
      const id = seedMailbox('alice@example.com');
      const patch = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { screenerSlaHours: 24 },
      });
      expect(patch.statusCode).toBe(200);

      const list = await app.inject({
        method: 'GET',
        url: '/api/mailboxes',
        headers: { cookie },
      });
      const rows = list.json() as Array<{ id: number; screener_sla_hours: number }>;
      const mailbox = rows.find((x) => x.id === id);
      expect(mailbox?.screener_sla_hours).toBe(24);
    } finally {
      await app.close();
    }
  });
});
