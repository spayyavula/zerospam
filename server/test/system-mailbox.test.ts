import { describe, it, expect } from 'vitest';
import { getOrCreateSystemMailboxId } from '../src/system-mailbox.js';
import { db, DEFAULT_ACCOUNT_ID } from '../src/db.js';
import { config } from '../src/config.js';

describe('system mailbox', () => {
  it('creates noreply@<signupDomain> on first call', () => {
    const id = getOrCreateSystemMailboxId();
    const row = db.prepare('SELECT address, account_id FROM mailboxes WHERE id = ?').get(id) as
      | { address: string; account_id: number }
      | undefined;
    expect(row?.address).toBe(`noreply@${config.signupDomain}`);
    expect(row?.account_id).toBe(DEFAULT_ACCOUNT_ID);
  });

  it('returns the same id on subsequent calls (idempotent)', () => {
    const a = getOrCreateSystemMailboxId();
    const b = getOrCreateSystemMailboxId();
    expect(a).toBe(b);
  });

  it('re-creates after the table is wiped (per-test cleanup tolerance)', () => {
    const a = getOrCreateSystemMailboxId();
    // Simulate per-test cleanup
    db.exec('DELETE FROM mailboxes; DELETE FROM domains;');
    const b = getOrCreateSystemMailboxId();
    expect(b).toBeTypeOf('number');
    // ids may differ since we deleted and re-inserted
    const row = db.prepare('SELECT address FROM mailboxes WHERE id = ?').get(b) as { address: string };
    expect(row.address).toBe(`noreply@${config.signupDomain}`);
  });
});
