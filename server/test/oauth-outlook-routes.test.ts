import { describe, it, expect, beforeEach } from 'vitest';
import { startApi } from '../src/api.js';
import { __setOutlookOAuthDeps } from '../src/routes/oauth-outlook.js';
import { signState } from '../src/oauth-state.js';
import { config } from '../src/config.js';
import { db } from '../src/db.js';
import { seedMailbox } from './helpers.js';
import type { FastifyInstance } from 'fastify';

function seedUser(): { userId: number; accountId: number } {
  seedMailbox('owner@zero-spam.email'); // ensures account 1 + domain exist
  return { userId: 1, accountId: 1 };
}

let app: FastifyInstance;
beforeEach(async () => {
  __setOutlookOAuthDeps({
    authUrl: async (state) => `https://login.microsoftonline.com/common/authorize?state=${state}`,
    exchanger: {
      authUrl: () => {
        throw new Error('use authUrlAsync');
      },
      exchangeCode: async () => ({ accessToken: 'A', refreshToken: 'CACHE', expiresAt: Date.now() + 3600_000 }),
      refresh: async () => ({ accessToken: 'A', refreshToken: 'CACHE', expiresAt: Date.now() + 3600_000 }),
    },
    apiFor: () => ({
      getProfile: async () => ({ email: 'alice@outlook.com' }),
      seedCursor: async () => 'delta-0',
      listDelta: async () => ({ addedMessageIds: [], nextCursor: 'delta-0' }),
      getRawMessage: async () => Buffer.from(''),
    }),
  });
  app = await startApi({ inject: true });
});

describe('outlook oauth callback', () => {
  it('creates an outlook mailbox + active connection from a valid callback', async () => {
    const { userId, accountId } = seedUser();
    const state = signState({ v: 1, userId, accountId, exp: Date.now() + 600_000 }, config.sessionSecret);
    const res = await app.inject({
      method: 'GET',
      url: `/api/oauth/outlook/callback?code=xyz&state=${encodeURIComponent(state)}`,
    });
    expect(res.statusCode).toBe(302);

    const mb = db.prepare("SELECT * FROM mailboxes WHERE address = 'alice@outlook.com'").get() as any;
    expect(mb.provider).toBe('outlook');
    expect(mb.account_id).toBe(accountId);
    const conn = db.prepare('SELECT * FROM connections WHERE mailbox_id = ?').get(mb.id) as any;
    expect(conn.status).toBe('active');
    expect(conn.cursor).toBe('delta-0');
  });

  it('rejects a tampered state', async () => {
    seedUser();
    const res = await app.inject({ method: 'GET', url: `/api/oauth/outlook/callback?code=xyz&state=bad` });
    expect(res.statusCode).toBe(400);
  });
});
