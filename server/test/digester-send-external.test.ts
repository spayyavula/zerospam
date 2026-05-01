import { describe, it, expect } from 'vitest';
import { sendDigest, assembleDigest } from '../src/digester.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { db } from '../src/db.js';

describe('sendDigest external mode', () => {
  it('sends a digest message to owner_email and records it in Sent', async () => {
    const mailboxId = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: 'alice-personal@gmail.com',
    });
    await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 's' });

    const content = await assembleDigest(mailboxId);
    expect(content).not.toBeNull();
    const r = await sendDigest(mailboxId, content!);
    expect(r.delivered).toBe(true);

    const sent = db
      .prepare("SELECT subject, to_addresses FROM messages WHERE mailbox_id = ? AND folder = 'sent'")
      .all(mailboxId) as { subject: string; to_addresses: string }[];
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/quarantine digest/i);
    expect(JSON.parse(sent[0].to_addresses)).toEqual(['alice-personal@gmail.com']);
  });

  it('throws if external mode lacks owner_email', async () => {
    const mailboxId = seedMailbox('alice@example.com', {
      digestEnabled: true,
      digestRecipientMode: 'external',
      ownerEmail: undefined,
    });
    await injectQuarantined({ to: 'alice@example.com', from: 'a@b.com' });
    const content = await assembleDigest(mailboxId);
    await expect(sendDigest(mailboxId, content!)).rejects.toThrow(/owner_email/);
  });
});
