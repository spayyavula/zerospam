import { describe, it, expect, vi } from 'vitest';
import { tick } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

function setHourBack(mailboxId: number, hour: number) {
  db.prepare('UPDATE mailboxes SET digest_hour = ? WHERE id = ?').run(hour, mailboxId);
}

function setLastDigest(mailboxId: number, ts: number | null) {
  db.prepare('UPDATE mailboxes SET last_digest_sent_at = ? WHERE id = ?').run(ts, mailboxId);
}

describe('digester.tick', () => {
  it('skips disabled mailboxes', async () => {
    const id = seedMailbox('alice@example.com', { digestEnabled: false });
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });
    const r = await tick(new Date('2026-04-29T20:00:00Z'));
    expect(r.sentForMailboxes).toHaveLength(0);
    expect(r.skippedEmpty).toHaveLength(0);
  });

  it('skips mailboxes whose digest_hour has not yet arrived today', async () => {
    const id = seedMailbox('alice@example.com', { digestEnabled: true });
    setHourBack(id, 23);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });
    const r = await tick(new Date('2026-04-29T05:00:00Z')); // before 23:00
    expect(r.sentForMailboxes).toEqual([]);
  });

  it('sends a digest when due and there is content', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    setHourBack(id, 8);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z')); // past 08:00
    expect(r.sentForMailboxes).toEqual([id]);

    const mb = db.prepare('SELECT last_digest_sent_at, digest_consecutive_failures FROM mailboxes WHERE id = ?').get(id) as
      | { last_digest_sent_at: number; digest_consecutive_failures: number }
      | undefined;
    expect(mb?.last_digest_sent_at).toBeGreaterThan(0);
    expect(mb?.digest_consecutive_failures).toBe(0);
  });

  it('updates last_digest_sent_at even when digest is empty', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    setHourBack(id, 8);
    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.skippedEmpty).toEqual([id]);
    const mb = db.prepare('SELECT last_digest_sent_at FROM mailboxes WHERE id = ?').get(id) as
      | { last_digest_sent_at: number }
      | undefined;
    expect(mb?.last_digest_sent_at).toBeGreaterThan(0);
  });

  it('skips when already sent today after the boundary', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    setHourBack(id, 8);
    setLastDigest(id, Date.parse('2026-04-29T08:30:00Z')); // already sent today
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.sentForMailboxes).toEqual([]);
  });

  it('enforces 12h anti-double-send guard when digest_hour is changed mid-day', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'a@gmail.com',
    });
    // User already sent at 08:30 today, then bumped digest_hour to 16.
    // last < today's new 16:00 boundary, AND now is past 16:00,
    // BUT now-last is only ~8h, so the 12h guard should block.
    setHourBack(id, 16);
    setLastDigest(id, Date.parse('2026-04-29T08:30:00Z'));
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T16:30:00Z'));
    expect(r.sentForMailboxes).toEqual([]);
  });

  it('records error and increments failures on send error', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      // missing ownerEmail → sendDigest throws
    });
    setHourBack(id, 8);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.errored).toEqual([id]);
    const mb = db
      .prepare('SELECT digest_consecutive_failures, digest_last_error, digest_enabled FROM mailboxes WHERE id = ?')
      .get(id) as
      | { digest_consecutive_failures: number; digest_last_error: string; digest_enabled: number }
      | undefined;
    expect(mb?.digest_consecutive_failures).toBe(1);
    expect(mb?.digest_last_error).toMatch(/owner_email/);
    expect(mb?.digest_enabled).toBe(1);
  });

  it('auto-disables after 7 consecutive failures', async () => {
    const id = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
    });
    setHourBack(id, 8);
    db.prepare('UPDATE mailboxes SET digest_consecutive_failures = 6 WHERE id = ?').run(id);
    await injectQuarantined({ to: 'alice@example.com', from: 's@x.test' });

    const r = await tick(new Date('2026-04-29T10:00:00Z'));
    expect(r.errored).toEqual([id]);
    expect(r.autoDisabled).toEqual([id]);
    const mb = db.prepare('SELECT digest_enabled FROM mailboxes WHERE id = ?').get(id) as
      | { digest_enabled: number }
      | undefined;
    expect(mb?.digest_enabled).toBe(0);
  });
});
