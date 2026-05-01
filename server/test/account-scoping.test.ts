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
  const mb2MsgId = await injectQuarantined({ to: 'victim@example.com', from: 'a@b.com' });
  // Insert a dummy attachment on that message so we have an integer attachment id to attack
  const attRow = db
    .prepare(
      `INSERT INTO attachments (message_id, filename, content_type, size_bytes, path)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(mb2MsgId, 'a.txt', 'text/plain', 5, '/tmp/x') as { id: number };
  const mb2AttId = attRow.id;
  return { account1Cookie: makeSessionCookie(a1.userId), mb2Id: mb2, mb2MsgId, mb2AttId };
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

  // ---- message-level cross-tenant tests ----

  it("GET /api/messages/:id returns 404 for another account's message", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2MsgId } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/messages/${mb2MsgId}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("GET /api/attachments/:id/download returns 404 for another account's attachment", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2AttId } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/attachments/${mb2AttId}/download`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("POST /api/messages/:id/move returns 404 for another account's message; folder unchanged", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2MsgId } = await setupTwoAccounts();
      const before = db.prepare('SELECT folder FROM messages WHERE id = ?').get(mb2MsgId) as { folder: string };
      const r = await app.inject({
        method: 'POST',
        url: `/api/messages/${mb2MsgId}/move`,
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { folder: 'inbox' },
      });
      expect(r.statusCode).toBe(404);
      const after = db.prepare('SELECT folder FROM messages WHERE id = ?').get(mb2MsgId) as { folder: string };
      expect(after.folder).toBe(before.folder);
    } finally {
      await app.close();
    }
  });

  it("DELETE /api/messages/:id returns 404 for another account's message; row still present", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2MsgId } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'DELETE',
        url: `/api/messages/${mb2MsgId}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
      const stillExists = db.prepare('SELECT id FROM messages WHERE id = ?').get(mb2MsgId);
      expect(stillExists).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it('POST /api/messages/bulk filters to only owned IDs; unowned message untouched', async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2MsgId } = await setupTwoAccounts();
      // Get account-1's account_id from the seeded user
      const acct1Id = (db.prepare('SELECT account_id FROM users WHERE email = ?').get('a@x.com') as { account_id: number }).account_id;
      // Create a mailbox owned by account-1 and inject a message into it
      const mb1own = seedMailbox('bulk_a1own@example.com');
      db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(acct1Id, mb1own);
      const a1MsgId = await injectQuarantined({ to: 'bulk_a1own@example.com', from: 'sender@test.com' });

      const beforeMb2 = db.prepare('SELECT read FROM messages WHERE id = ?').get(mb2MsgId) as { read: number };

      const r = await app.inject({
        method: 'POST',
        url: '/api/messages/bulk',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { ids: [a1MsgId, mb2MsgId], action: 'mark-read' },
      });
      expect(r.statusCode).toBe(200);

      // account-1's own message should be marked read
      const a1Msg = db.prepare('SELECT read FROM messages WHERE id = ?').get(a1MsgId) as { read: number };
      expect(a1Msg.read).toBe(1);

      // account-2's message must be untouched
      const afterMb2 = db.prepare('SELECT read FROM messages WHERE id = ?').get(mb2MsgId) as { read: number };
      expect(afterMb2.read).toBe(beforeMb2.read);
    } finally {
      await app.close();
    }
  });

  it("GET /api/search returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/search?mailboxId=${mb2Id}&q=test&folder=quarantine`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("POST /api/whitelist returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const before = db.prepare('SELECT COUNT(*) AS c FROM whitelist_rules WHERE mailbox_id = ?').get(mb2Id) as { c: number };
      const r = await app.inject({
        method: 'POST',
        url: '/api/whitelist',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailboxId: mb2Id, kind: 'address', pattern: 'attacker@evil.com' },
      });
      expect(r.statusCode).toBe(404);
      const after = db.prepare('SELECT COUNT(*) AS c FROM whitelist_rules WHERE mailbox_id = ?').get(mb2Id) as { c: number };
      expect(after.c).toBe(before.c);  // No rule was inserted
    } finally {
      await app.close();
    }
  });

  it("DELETE /api/whitelist/:id returns 404 for another account's whitelist rule", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      // Seed a rule on account-2's mailbox
      const rule = db.prepare(
        `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, created_at) VALUES (?, ?, ?, ?) RETURNING id`,
      ).get(mb2Id, 'address', 'allowed@example.com', Date.now()) as { id: number };
      const r = await app.inject({
        method: 'DELETE',
        url: `/api/whitelist/${rule.id}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
      const stillExists = db.prepare('SELECT id FROM whitelist_rules WHERE id = ?').get(rule.id);
      expect(stillExists).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  // ---- draft cross-tenant tests ----

  async function setupTwoAccountsWithDraft() {
    const base = await setupTwoAccounts();
    const draftId = 'd_test_' + Math.random().toString(36).slice(2, 10);
    db.prepare(
      `INSERT INTO drafts (id, mailbox_id, to_addresses, subject, body_text, body_html, created_at, updated_at)
       VALUES (?, ?, '[]', '', '', '', ?, ?)`,
    ).run(draftId, base.mb2Id, Date.now(), Date.now());
    return { ...base, mb2DraftId: draftId };
  }

  it("GET /api/drafts returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const r = await app.inject({
        method: 'GET',
        url: `/api/drafts?mailboxId=${mb2Id}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("GET /api/drafts/:id returns 404 for another account's draft", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2DraftId } = await setupTwoAccountsWithDraft();
      const r = await app.inject({
        method: 'GET',
        url: `/api/drafts/${mb2DraftId}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("POST /api/drafts returns 404 for another account's mailbox", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2Id } = await setupTwoAccounts();
      const before = db.prepare('SELECT COUNT(*) AS c FROM drafts WHERE mailbox_id = ?').get(mb2Id) as { c: number };
      const r = await app.inject({
        method: 'POST',
        url: '/api/drafts',
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { mailboxId: mb2Id, subject: 'phish', text: 'x' },
      });
      expect(r.statusCode).toBe(404);
      const after = db.prepare('SELECT COUNT(*) AS c FROM drafts WHERE mailbox_id = ?').get(mb2Id) as { c: number };
      expect(after.c).toBe(before.c);
    } finally {
      await app.close();
    }
  });

  it("PATCH /api/drafts/:id returns 404 for another account's draft", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2DraftId } = await setupTwoAccountsWithDraft();
      const before = db.prepare('SELECT subject FROM drafts WHERE id = ?').get(mb2DraftId);
      const r = await app.inject({
        method: 'PATCH',
        url: `/api/drafts/${mb2DraftId}`,
        headers: { cookie: account1Cookie, 'content-type': 'application/json' },
        payload: { subject: 'PWNED' },
      });
      expect(r.statusCode).toBe(404);
      const after = db.prepare('SELECT subject FROM drafts WHERE id = ?').get(mb2DraftId);
      expect(after).toEqual(before);
    } finally {
      await app.close();
    }
  });

  it("DELETE /api/drafts/:id returns 404 for another account's draft", async () => {
    const app = await startApi();
    try {
      const { account1Cookie, mb2DraftId } = await setupTwoAccountsWithDraft();
      const r = await app.inject({
        method: 'DELETE',
        url: `/api/drafts/${mb2DraftId}`,
        headers: { cookie: account1Cookie },
      });
      expect(r.statusCode).toBe(404);
      const stillExists = db.prepare('SELECT id FROM drafts WHERE id = ?').get(mb2DraftId);
      expect(stillExists).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});
