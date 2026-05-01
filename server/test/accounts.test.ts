import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('accounts schema', () => {
  it('accounts table has the required columns', () => {
    const cols = db.prepare('PRAGMA table_info(accounts)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    for (const c of ['id', 'name', 'plan', 'created_at']) {
      expect(names.has(c), `accounts missing: ${c}`).toBe(true);
    }
  });

  it('users has account_id and email_verified_at', () => {
    const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    expect(names.has('account_id')).toBe(true);
    expect(names.has('email_verified_at')).toBe(true);
  });

  it('mailboxes has account_id and provider', () => {
    const cols = db.prepare('PRAGMA table_info(mailboxes)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    expect(names.has('account_id')).toBe(true);
    expect(names.has('provider')).toBe(true);
  });

  it('domains has account_id', () => {
    const cols = db.prepare('PRAGMA table_info(domains)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    expect(names.has('account_id')).toBe(true);
  });

  it('the default account exists with id=1', () => {
    const row = db.prepare('SELECT id, name FROM accounts WHERE id = 1').get() as
      | { id: number; name: string }
      | undefined;
    expect(row?.id).toBe(1);
    expect(row?.name).toBe('default');
  });
});
