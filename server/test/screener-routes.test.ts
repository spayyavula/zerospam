import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { injectQuarantined, seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { FREE_MAIL_DOMAINS } from '../src/screener-domains.js';

async function authedApp() {
  const app = await startApi();
  const { userId } = await seedOwner();
  return { app, cookie: makeSessionCookie(userId) };
}

function setMsgMeta(
  id: string,
  fields: { receivedAt?: number; read?: number; subject?: string; preview?: string },
) {
  const parts: string[] = [];
  const values: unknown[] = [];
  if (fields.receivedAt !== undefined) {
    parts.push('received_at = ?');
    values.push(fields.receivedAt);
  }
  if (fields.read !== undefined) {
    parts.push('read = ?');
    values.push(fields.read);
  }
  if (fields.subject !== undefined) {
    parts.push('subject = ?');
    values.push(fields.subject);
  }
  if (fields.preview !== undefined) {
    parts.push('preview = ?');
    values.push(fields.preview);
  }
  values.push(id);
  db.prepare(`UPDATE messages SET ${parts.join(', ')} WHERE id = ?`).run(...(values as any[]));
}

describe('screener routes', () => {
  it('GET groups by sender, sorted desc, and applies screener filters', async () => {
    const { app, cookie } = await authedApp();
    try {
      const mailboxId = seedMailbox('alice@example.com');
      const now = Date.now();

      const a1 = await injectQuarantined({ to: 'alice@example.com', from: 'sarah@work.dev', subject: 'A1', text: 'aa' });
      const a2 = await injectQuarantined({ to: 'alice@example.com', from: 'sarah@work.dev', subject: 'A2', text: 'bb' });
      const b1 = await injectQuarantined({ to: 'alice@example.com', from: 'boss@other.dev', subject: 'B1', text: 'cc' });
      const old = await injectQuarantined({ to: 'alice@example.com', from: 'old@other.dev', subject: 'old', text: 'dd' });
      const muted = await injectQuarantined({ to: 'alice@example.com', from: 'mute@other.dev', subject: 'mute', text: 'ee' });
      const trusted = await injectQuarantined({ to: 'alice@example.com', from: 'trusted@other.dev', subject: 'trusted', text: 'ff' });

      setMsgMeta(a1, { receivedAt: now - 60_000, read: 0, subject: 'Newest Sarah', preview: 'hello world from sarah' });
      setMsgMeta(a2, { receivedAt: now - 3_600_000, read: 1, subject: 'Older Sarah', preview: 'older one' });
      setMsgMeta(b1, { receivedAt: now - 120_000, read: 1, subject: 'Boss ping', preview: 'boss note' });
      setMsgMeta(old, { receivedAt: now - 49 * 3_600_000, read: 0 });
      setMsgMeta(muted, { receivedAt: now - 100_000 });
      setMsgMeta(trusted, { receivedAt: now - 100_000 });

      db.prepare(
        'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(mailboxId, 'address', 'trusted@other.dev', 'test', now);
      db.prepare(
        'INSERT INTO screener_mutes (mailbox_id, sender_addr, muted_at, expires_at) VALUES (?, ?, ?, ?)',
      ).run(mailboxId, 'mute@other.dev', now, now + 86_400_000);

      const r = await app.inject({
        method: 'GET',
        url: `/api/screener?mailbox_id=${mailboxId}`,
        headers: { cookie },
      });

      expect(r.statusCode).toBe(200);
      const rows = r.json() as Array<{
        address: string;
        message_count: number;
        latest_subject: string;
        latest_preview: string;
        messages: Array<{ id: string; received_at: number }>;
      }>;

      expect(rows.map((x) => x.address)).toEqual(['sarah@work.dev', 'boss@other.dev']);
      expect(rows[0]?.message_count).toBe(2);
      expect(rows[0]?.latest_subject).toBe('Newest Sarah');
      expect(rows[0]?.latest_preview).toContain('hello world');
      expect(rows[0]?.messages.map((m) => m.id)).toEqual([a1, a2]);
      expect(rows[1]?.message_count).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('GET excludes active mute and re-includes after expiry', async () => {
    const { app, cookie } = await authedApp();
    try {
      const mailboxId = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'mute-me@work.dev', text: 'x' });
      const now = Date.now();
      db.prepare(
        'INSERT INTO screener_mutes (mailbox_id, sender_addr, muted_at, expires_at) VALUES (?, ?, ?, ?)',
      ).run(mailboxId, 'mute-me@work.dev', now, now + 10_000);

      const hidden = await app.inject({
        method: 'GET',
        url: `/api/screener?mailbox_id=${mailboxId}`,
        headers: { cookie },
      });
      expect((hidden.json() as Array<{ address: string }>).length).toBe(0);

      db.prepare('UPDATE screener_mutes SET expires_at = ? WHERE mailbox_id = ? AND sender_addr = ?').run(
        now - 1,
        mailboxId,
        'mute-me@work.dev',
      );
      const visible = await app.inject({
        method: 'GET',
        url: `/api/screener?mailbox_id=${mailboxId}`,
        headers: { cookie },
      });
      const rows = visible.json() as Array<{ address: string }>;
      expect(rows.map((x) => x.address)).toEqual(['mute-me@work.dev']);
    } finally {
      await app.close();
    }
  });

  it('POST /api/screener/allow whitelists exact address and moves messages', async () => {
    const { app, cookie } = await authedApp();
    try {
      const mailboxId = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@work.dev', text: 'x' });
      await injectQuarantined({ to: 'alice@example.com', from: 'sarah@work.dev', text: 'y' });

      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'sarah@work.dev' },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { moved: number; sender_address: string; domain: string; suggest_domain_expand: boolean };
      expect(body.moved).toBe(2);
      expect(body.sender_address).toBe('sarah@work.dev');
      expect(body.domain).toBe('work.dev');
      expect(body.suggest_domain_expand).toBe(true);

      const inbox = db
        .prepare("SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND from_address = ? AND folder = 'inbox'")
        .get(mailboxId, 'sarah@work.dev') as { c: number };
      expect(inbox.c).toBe(2);

      const rule = db
        .prepare('SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?')
        .get(mailboxId, 'address', 'sarah@work.dev');
      expect(rule).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it('POST /api/screener/allow-domain rejects free-mail domains', async () => {
    const { app, cookie } = await authedApp();
    try {
      const mailboxId = seedMailbox('alice@example.com');
      for (const domain of FREE_MAIL_DOMAINS) {
        const r = await app.inject({
          method: 'POST',
          url: '/api/screener/allow-domain',
          headers: { cookie, 'content-type': 'application/json' },
          payload: { mailbox_id: mailboxId, domain },
        });
        expect(r.statusCode).toBe(422);
      }
    } finally {
      await app.close();
    }
  });

  it('POST /api/screener/allow-domain accepts custom domain and moves all matching senders', async () => {
    const { app, cookie } = await authedApp();
    try {
      const mailboxId = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'a@team.dev', text: 'x' });
      await injectQuarantined({ to: 'alice@example.com', from: 'b@team.dev', text: 'y' });
      await injectQuarantined({ to: 'alice@example.com', from: 'c@other.dev', text: 'z' });

      const r = await app.inject({
        method: 'POST',
        url: '/api/screener/allow-domain',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, domain: 'team.dev' },
      });
      expect(r.statusCode).toBe(200);
      expect((r.json() as { moved: number }).moved).toBe(2);

      const moved = db
        .prepare("SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND folder = 'inbox' AND from_address LIKE ?")
        .get(mailboxId, '%@team.dev') as { c: number };
      expect(moved.c).toBe(2);
    } finally {
      await app.close();
    }
  });

  it('POST /api/screener/reject trashes and is idempotent with mute refresh', async () => {
    const { app, cookie } = await authedApp();
    try {
      const mailboxId = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'nope@work.dev', text: 'x' });

      const first = await app.inject({
        method: 'POST',
        url: '/api/screener/reject',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'nope@work.dev' },
      });
      expect(first.statusCode).toBe(200);
      expect((first.json() as { trashed: number }).trashed).toBe(1);

      const firstMute = db
        .prepare('SELECT muted_at, expires_at FROM screener_mutes WHERE mailbox_id = ? AND sender_addr = ?')
        .get(mailboxId, 'nope@work.dev') as { muted_at: number; expires_at: number };

      await injectQuarantined({ to: 'alice@example.com', from: 'nope@work.dev', text: 'y' });
      const second = await app.inject({
        method: 'POST',
        url: '/api/screener/reject',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { mailbox_id: mailboxId, sender_address: 'nope@work.dev' },
      });
      expect(second.statusCode).toBe(200);
      expect((second.json() as { trashed: number }).trashed).toBe(1);

      const secondMute = db
        .prepare('SELECT muted_at, expires_at FROM screener_mutes WHERE mailbox_id = ? AND sender_addr = ?')
        .get(mailboxId, 'nope@work.dev') as { muted_at: number; expires_at: number };
      expect(secondMute.muted_at).toBeGreaterThanOrEqual(firstMute.muted_at);
      expect(secondMute.expires_at).toBeGreaterThanOrEqual(firstMute.expires_at);
    } finally {
      await app.close();
    }
  });

  it('SLA is respected: 24h drops 25h-old messages from screener', async () => {
    const { app, cookie } = await authedApp();
    try {
      const mailboxId = seedMailbox('alice@example.com');
      const msgId = await injectQuarantined({ to: 'alice@example.com', from: 'aged@work.dev', text: 'x' });
      await app.inject({
        method: 'PATCH',
        url: `/api/mailboxes/${mailboxId}`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { screenerSlaHours: 24 },
      });
      db.prepare('UPDATE messages SET received_at = ? WHERE id = ?').run(Date.now() - 25 * 3_600_000, msgId);

      const r = await app.inject({
        method: 'GET',
        url: `/api/screener?mailbox_id=${mailboxId}`,
        headers: { cookie },
      });
      expect(r.statusCode).toBe(200);
      expect((r.json() as Array<{ address: string }>).length).toBe(0);
    } finally {
      await app.close();
    }
  });
});
