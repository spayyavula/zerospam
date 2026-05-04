import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { createAccount } from '../src/accounts.js';
import { db } from '../src/db.js';
import { seedMailbox, injectQuarantined } from './helpers.js';

async function setupTwoAccounts() {
  const a1 = await seedOwner({ email: 'a@x.com' });
  const acct2 = createAccount('two');
  db.prepare(
    `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
     VALUES (?, 'x', ?, ?, ?)`,
  ).run('b@y.com', acct2.id, Date.now(), Date.now());

  const mb2 = seedMailbox('victim@example.com');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct2.id, mb2);

  await injectQuarantined({ to: 'victim@example.com', from: 'sender@elsewhere.dev', text: 'a' });
  return { account1Cookie: makeSessionCookie(a1.userId), mb2Id: mb2 };
}

describe('screener account scoping', () => {
  it('GET /api/screener returns 404 for another account mailbox', async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/screener?mailbox_id=${mb2Id}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('POST allow/allow-domain/reject return 404 for another account mailbox', async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();

      const allow = await app.inject({
        method: 'POST',
        url: '/api/screener/allow',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mb2Id, sender_address: 'sender@elsewhere.dev' },
      });
      expect(allow.statusCode).toBe(404);

      const allowDomain = await app.inject({
        method: 'POST',
        url: '/api/screener/allow-domain',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mb2Id, domain: 'elsewhere.dev' },
      });
      expect(allowDomain.statusCode).toBe(404);

      const reject = await app.inject({
        method: 'POST',
        url: '/api/screener/reject',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mb2Id, sender_address: 'sender@elsewhere.dev' },
      });
      expect(reject.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
