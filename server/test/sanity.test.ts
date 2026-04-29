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
