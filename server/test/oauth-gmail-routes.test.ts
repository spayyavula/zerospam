import { describe, it, expect, beforeEach } from 'vitest';
import { startApi } from '../src/api.js';
import { __setGmailOAuthDeps } from '../src/routes/oauth-gmail.js';
import { signState } from '../src/oauth-state.js';
import { config } from '../src/config.js';
import { db } from '../src/db.js';
import { seedMailbox } from './helpers.js';
import type { FastifyInstance } from 'fastify';

// A test user/account with a native mailbox.
function seedUser(): { userId: number; accountId: number } {
  seedMailbox('owner@zero-spam.email'); // ensures account 1 + domain exist
  return { userId: 1, accountId: 1 };
}

let app: FastifyInstance;
beforeEach(async () => {
  __setGmailOAuthDeps({
    exchanger: {
      authUrl: (state) => `https://consent.example/?state=${state}`,
      exchangeCode: async () => ({ accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }),
      refresh: async () => ({ accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }),
    },
    apiFor: () => ({
      getProfile: async () => ({ emailAddress: 'alice@gmail.com', historyId: '500' }),
      listHistory: async () => ({ addedMessageIds: [], historyId: '500' }),
      getRawMessage: async () => Buffer.from(''),
    }),
  });
  app = await startApi({ inject: true });
});

describe('gmail oauth callback', () => {
  it('creates a gmail mailbox + active connection from a valid callback', async () => {
    const { userId, accountId } = seedUser();
    const state = signState({ v: 1, userId, accountId, exp: Date.now() + 600_000 }, config.sessionSecret);

    const res = await app.inject({
      method: 'GET',
      url: `/api/oauth/gmail/callback?code=xyz&state=${encodeURIComponent(state)}`,
    });
    expect(res.statusCode).toBe(302); // redirect back to app

    const mb = db.prepare("SELECT * FROM mailboxes WHERE address = 'alice@gmail.com'").get() as any;
    expect(mb.provider).toBe('gmail');
    expect(mb.account_id).toBe(accountId);
    const conn = db.prepare('SELECT * FROM connections WHERE mailbox_id = ?').get(mb.id) as any;
    expect(conn.status).toBe('active');
    expect(conn.cursor).toBe('500');
  });

  it('rejects a tampered state', async () => {
    seedUser();
    const res = await app.inject({ method: 'GET', url: `/api/oauth/gmail/callback?code=xyz&state=bad` });
    expect(res.statusCode).toBe(400);
  });
});
