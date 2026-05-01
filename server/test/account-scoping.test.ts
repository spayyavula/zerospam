import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { createAccount } from '../src/accounts.js';
import { db } from '../src/db.js';
import { seedMailbox, injectQuarantined } from './helpers.js';

async function setupTwoAccounts() {
  const a1 = await seedOwner({ email: 'a@x.com' });
  // Spawn a second account + user manually
  const acct2 = createAccount('two');
  const u2 = db
    .prepare(
      `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
       VALUES (?, 'x', ?, ?, ?) RETURNING id`,
    )
    .get('b@y.com', acct2.id, Date.now(), Date.now()) as { id: number };
  // Mailbox owned by account 2
  const mb2 = seedMailbox('victim@example.com');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct2.id, mb2);
  await injectQuarantined({ to: 'victim@example.com', from: 'a@b.com' });
  return { account1Cookie: makeSessionCookie(a1.userId), mb2Id: mb2 };
}

describe('account scoping', () => {
  it("GET /api/mailboxes does not leak another account's mailboxes", async () => {
    const app = await startApi();
    try {
      const { account1Cookie } = await setupTwoAccounts();
      const r = await app.inject({ method: 'GET', url: '/api/mailboxes', headers: { cookie: account1Cookie } });
      const list = r.json() as { id: number; address: string }[];
      expect(list.find((x) => x.address === 'victim@example.com')).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("GET /api/messages?mailboxId=<other> returns 404", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/messages?mailboxId=${mb2Id}&folder=quarantine`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("GET /api/whitelist?mailboxId=<other> returns 404", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/whitelist?mailboxId=${mb2Id}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("GET /api/mailboxes/:id/counts returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/mailboxes/${mb2Id}/counts`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
