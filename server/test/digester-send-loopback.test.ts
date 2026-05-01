import { describe, it, expect } from 'vitest';
import { sendDigest, assembleDigest, ensureDigestSelfWhitelist } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

describe('sendDigest loopback mode', () => {
  it('inserts self-whitelist rule on enable', () => {
    const mailboxId = seedMailbox('alice@example.com', { digestRecipientMode: 'loopback' });
    ensureDigestSelfWhitelist(mailboxId);
    const rule = db
      .prepare(
        "SELECT pattern FROM whitelist_rules WHERE mailbox_id = ? AND note = 'self:digest'",
      )
      .get(mailboxId) as { pattern: string } | undefined;
    expect(rule?.pattern).toBe('digest-system@example.com');
  });

  it('is idempotent — calling twice does not duplicate the rule', () => {
    const mailboxId = seedMailbox('alice@example.com', { digestRecipientMode: 'loopback' });
    ensureDigestSelfWhitelist(mailboxId);
    ensureDigestSelfWhitelist(mailboxId);
    const rows = db
      .prepare(
        "SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND note = 'self:digest'",
      )
      .all(mailboxId);
    expect(rows).toHaveLength(1);
  });

  it('delivers loopback digest to the mailbox inbox', async () => {
    const mailboxId = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'loopback',
    });
    ensureDigestSelfWhitelist(mailboxId);
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 's' });

    const content = await assembleDigest(mailboxId);
    const r = await sendDigest(mailboxId, content!);
    expect(r.delivered).toBe(true);
    expect(r.recipientMode).toBe('loopback');

    const inboxDigest = db
      .prepare(
        "SELECT subject FROM messages WHERE mailbox_id = ? AND folder = 'inbox' AND from_address = ?",
      )
      .get(mailboxId, 'digest-system@example.com') as { subject: string } | undefined;
    expect(inboxDigest?.subject).toMatch(/quarantine digest/i);
  });
});
