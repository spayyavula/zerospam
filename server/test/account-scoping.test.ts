import { describe, it, expect, vi } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { createAccount } from '../src/accounts.js';
import { db } from '../src/db.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import * as sender from '../src/sender.js';

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

  it("PATCH /api/mailboxes/:id returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const before = db.prepare('SELECT display_name FROM mailboxes WHERE id = ?').get(mb2Id);
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${mb2Id}`,
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { displayName: 'PWNED' },
      });
      expect(r.statusCode).toBe(404);
      const after = db.prepare('SELECT display_name FROM mailboxes WHERE id = ?').get(mb2Id);
      expect(after).toEqual(before);
    } finally {
      await app.close();
    }
  });

  it("DELETE /api/mailboxes/:id returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'DELETE',
        url: `/api/mailboxes/${mb2Id}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
      const stillExists = db.prepare('SELECT id FROM mailboxes WHERE id = ?').get(mb2Id);
      expect(stillExists).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it("POST /api/quarantine/:mailboxId/purge returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const before = db.prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND folder = 'quarantine'"
      ).get(mb2Id) as { c: number };
      expect(before.c).toBeGreaterThan(0);
      const r = await app.inject({
        method: 'POST',
        url: `/api/quarantine/${mb2Id}/purge`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
      const after = db.prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND folder = 'quarantine'"
      ).get(mb2Id) as { c: number };
      expect(after.c).toBe(before.c);
    } finally {
      await app.close();
    }
  });

  it("POST /api/send returns 404 for another account's mailboxId without sending", async () => {
    const sendSpy = vi.spyOn(sender, 'sendMessage');
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'POST',
        url: '/api/send',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: {
          mailboxId: mb2Id,
          to: ['target@example.com'],
          subject: 'phish',
          text: 'phish body',
        },
      });
      expect(r.statusCode).toBe(404);
      expect(sendSpy).not.toHaveBeenCalled();
    } finally {
      await app.close();
      sendSpy.mockRestore();
    }
  });

  it("POST /api/drafts/:id/send returns 404 for another account's draft without sending", async () => {
    const sendSpy = vi.spyOn(sender, 'sendMessage');
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      // Create a draft owned by account-2's mailbox (raw insert)
      const draftId = 'd_test_draft_xyz';
      db.prepare(
        `INSERT INTO drafts (id, mailbox_id, to_addresses, subject, body_text, body_html, created_at, updated_at)
         VALUES (?, ?, '[]', '', '', '', ?, ?)`,
      ).run(draftId, mb2Id, Date.now(), Date.now());

      const r = await app.inject({
        method: 'POST',
        url: `/api/drafts/${draftId}/send`,
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: {},
      });
      expect(r.statusCode).toBe(404);
      expect(sendSpy).not.toHaveBeenCalled();
    } finally {
      await app.close();
      sendSpy.mockRestore();
    }
  });
});
