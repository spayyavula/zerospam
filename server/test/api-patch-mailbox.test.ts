import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

async function authedApp() {
  const app = await startApi();
  const { userId } = await seedOwner();
  return { app, cookie: makeSessionCookie(userId) };
}

describe('PATCH /api/mailboxes/:id digest fields', () => {
  it('accepts digestEnabled + digestHour + recipient mode', async () => {
    const { app, cookie } = await authedApp();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: {
          digestEnabled: true,
          digestHour: 7,
          digestRecipientMode: 'external',
          ownerEmail: 'alice-personal@gmail.com',
        },
      });
      expect(r.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('rejects external digest enable without owner_email', async () => {
    const { app, cookie } = await authedApp();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { digestEnabled: true, digestRecipientMode: 'external' },
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().error).toMatch(/owner_email/i);
    } finally {
      await app.close();
    }
  });

  it('seeds the digest-self whitelist when switching to loopback enabled', async () => {
    const { app, cookie } = await authedApp();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${id}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { digestEnabled: true, digestRecipientMode: 'loopback' },
      });
      expect(r.statusCode).toBe(200);
      const list = await app.inject({
        method: 'GET',
        url: `/api/whitelist?mailboxId=${id}`,
        headers: { cookie },
      });
      const rules = list.json() as Array<{ pattern: string; note: string }>;
      expect(rules.some((x) => x.note === 'self:digest' && x.pattern === 'digest-system@example.com'))
        .toBe(true);
    } finally {
      await app.close();
    }
  });
});
