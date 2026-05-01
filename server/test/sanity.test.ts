import { describe, it, expect } from 'vitest';
import { seedMailbox } from './helpers.js';
import { db } from '../src/db.js';

describe('sanity', () => {
  it('seeds a mailbox and reads it back', () => {
    const id = seedMailbox('alice@example.com');
    const row = db.prepare('SELECT address FROM mailboxes WHERE id = ?').get(id) as
      | { address: string }
      | undefined;
    expect(row?.address).toBe('alice@example.com');
  });
});

describe('schema', () => {
  it('mailboxes has all digest columns', () => {
    const cols = db.prepare('PRAGMA table_info(mailboxes)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    for (const c of [
      'digest_enabled',
      'digest_hour',
      'digest_recipient_mode',
      'owner_email',
      'last_digest_sent_at',
      'digest_last_error',
      'digest_consecutive_failures',
    ]) {
      expect(names.has(c), `missing column: ${c}`).toBe(true);
    }
  });
});
