import { db, DEFAULT_ACCOUNT_ID, DEFAULT_ACCOUNT_NAME, type Account } from './db.js';

export function ensureDefaultAccount(): void {
  const row = db.prepare(`SELECT id FROM accounts WHERE id = ${DEFAULT_ACCOUNT_ID}`).get();
  if (row) return;
  db.prepare(
    `INSERT INTO accounts (id, name, plan, created_at) VALUES (${DEFAULT_ACCOUNT_ID}, '${DEFAULT_ACCOUNT_NAME}', 'free', ?)`,
  ).run(Date.now());
}

export function createAccount(name: string, plan = 'free'): Account {
  const r = db
    .prepare(
      `INSERT INTO accounts (name, plan, created_at) VALUES (?, ?, ?) RETURNING id, name, plan, created_at`,
    )
    .get(name, plan, Date.now()) as Account;
  return r;
}

export function getAccountById(id: number): Account | null {
  const r = db
    .prepare('SELECT id, name, plan, created_at FROM accounts WHERE id = ?')
    .get(id) as Account | undefined;
  return r ?? null;
}
