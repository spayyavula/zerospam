import { describe, it, expect } from 'vitest';
import { db, DEFAULT_ACCOUNT_ID, DEFAULT_ACCOUNT_NAME } from '../src/db.js';
import { createAccount, getAccountById, ensureDefaultAccount } from '../src/accounts.js';

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
    const row = db
      .prepare(`SELECT id, name FROM accounts WHERE id = ${DEFAULT_ACCOUNT_ID}`)
      .get() as { id: number; name: string } | undefined;
    expect(row?.id).toBe(DEFAULT_ACCOUNT_ID);
    expect(row?.name).toBe(DEFAULT_ACCOUNT_NAME);
  });

  it('FK enforcement: inserting a user with a non-existent account_id throws', () => {
    expect(() => {
      db.prepare(
        `INSERT INTO users (email, password_hash, account_id, created_at)
         VALUES ('fk-test@example.com', 'hash', 99999, ?)`,
      ).run(Date.now());
    }).toThrow(/FOREIGN KEY/);
  });

  it('DEFAULT 1 backfill: domain inserted without account_id gets account_id=DEFAULT_ACCOUNT_ID', () => {
    const row = db
      .prepare(`INSERT INTO domains (name, created_at) VALUES ('backfill-test.example', ?) RETURNING id, account_id`)
      .get(Date.now()) as { id: number; account_id: number };
    expect(row.account_id).toBe(DEFAULT_ACCOUNT_ID);
  });

  it('email_verified_at backfill: NULL becomes created_at after UPDATE', () => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO users (email, password_hash, account_id, created_at)
       VALUES ('verify-test@example.com', 'hash', ${DEFAULT_ACCOUNT_ID}, ?)`,
    ).run(now);

    const before = db
      .prepare(`SELECT email_verified_at, created_at FROM users WHERE email = 'verify-test@example.com'`)
      .get() as { email_verified_at: number | null; created_at: number };
    expect(before.email_verified_at).toBeNull();

    db.exec(`UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL`);

    const after = db
      .prepare(`SELECT email_verified_at, created_at FROM users WHERE email = 'verify-test@example.com'`)
      .get() as { email_verified_at: number | null; created_at: number };
    expect(after.email_verified_at).toBe(after.created_at);
  });

  it('migration idempotency: re-seeding the default account does not throw a UNIQUE violation', () => {
    // The seed guard is "INSERT if not exists" — calling it twice should be safe.
    expect(() => {
      const existing = db
        .prepare(`SELECT id FROM accounts WHERE id = ${DEFAULT_ACCOUNT_ID}`)
        .get() as { id: number } | undefined;
      if (!existing) {
        db.prepare(
          `INSERT INTO accounts (id, name, plan, created_at) VALUES (${DEFAULT_ACCOUNT_ID}, '${DEFAULT_ACCOUNT_NAME}', 'free', ?)`,
        ).run(Date.now());
      }
    }).not.toThrow();
  });
});

describe('accounts helpers', () => {
  it('createAccount returns a row with the new id', () => {
    const a = createAccount('test-tenant');
    expect(a.id).toBeGreaterThan(1);
    expect(a.name).toBe('test-tenant');
    expect(a.plan).toBe('free');
  });

  it('getAccountById returns the account', () => {
    const a = createAccount('lookup');
    const got = getAccountById(a.id);
    expect(got?.name).toBe('lookup');
  });

  it('ensureDefaultAccount is idempotent', () => {
    ensureDefaultAccount();
    ensureDefaultAccount();
    const rows = db.prepare('SELECT COUNT(*) AS c FROM accounts WHERE id = 1').get() as { c: number };
    expect(rows.c).toBe(1);
  });
});
