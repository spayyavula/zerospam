import { describe, it, expect } from 'vitest';
import { assembleDigest } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

describe('assembleDigest', () => {
  it('returns null when nothing is quarantined since last digest', async () => {
    const mailboxId = seedMailbox('alice@example.com', { lastDigestSentAt: Date.now() - 1000 });
    expect(await assembleDigest(mailboxId)).toBeNull();
  });

  it('groups by sender, counts messages, sorts by latest, signs tokens', async () => {
    const mailboxId = seedMailbox('alice@example.com');
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'first' });
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'second' });
    await injectQuarantined({ to: 'alice@example.com', from: 'news@beta.io', subject: 'beta news' });

    const c = await assembleDigest(mailboxId);
    expect(c).not.toBeNull();
    expect(c!.rows).toHaveLength(2);
    const senders = c!.rows.map((r) => r.fromAddress).sort();
    expect(senders).toEqual(['news@beta.io', 'sales@acme.com']);
    const acme = c!.rows.find((r) => r.fromAddress === 'sales@acme.com')!;
    expect(acme.messageCount).toBe(2);
    expect(acme.allowToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(c!.totalSendersInQuarantine).toBe(2);
  });

  it('caps at 30 senders and reports total in totalSendersInQuarantine', async () => {
    const mailboxId = seedMailbox('alice@example.com');
    for (let i = 0; i < 35; i++) {
      await injectQuarantined({
        to: 'alice@example.com',
        from: `sender${i}@x.test`,
        subject: `s${i}`,
      });
    }
    const c = await assembleDigest(mailboxId);
    expect(c!.rows).toHaveLength(30);
    expect(c!.totalSendersInQuarantine).toBe(35);
  });

  it('on first send (last_digest_sent_at IS NULL) selects all currently quarantined', async () => {
    const mailboxId = seedMailbox('alice@example.com', { lastDigestSentAt: null });
    // backdate one quarantined message to before "now-2-days"
    await injectQuarantined({ to: 'alice@example.com', from: 'old@x.test' });
    db.prepare("UPDATE messages SET received_at = received_at - 86400000*7 WHERE from_address = ?")
      .run('old@x.test');
    await injectQuarantined({ to: 'alice@example.com', from: 'new@x.test' });

    const c = await assembleDigest(mailboxId);
    expect(c!.rows.map((r) => r.fromAddress).sort()).toEqual(['new@x.test', 'old@x.test']);
  });

  it('when last_digest_sent_at is set, only shows senders newer than it', async () => {
    const mailboxId = seedMailbox('alice@example.com');
    await injectQuarantined({ to: 'alice@example.com', from: 'old@x.test' });
    // mark as digested
    db.prepare('UPDATE mailboxes SET last_digest_sent_at = ? WHERE id = ?').run(Date.now() + 1, mailboxId);
    await new Promise((r) => setTimeout(r, 5));
    await injectQuarantined({ to: 'alice@example.com', from: 'new@x.test' });

    const c = await assembleDigest(mailboxId);
    expect(c).not.toBeNull();
    expect(c!.rows.map((r) => r.fromAddress)).toEqual(['new@x.test']);
  });

  it('returns null for unknown mailbox id', async () => {
    expect(await assembleDigest(99999)).toBeNull();
  });
});
