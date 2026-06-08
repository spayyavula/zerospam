import { describe, it, expect } from 'vitest';
import { seedMailbox } from './helpers.js';
import { db } from '../src/db.js';
import {
  upsertConnection, listConnectionsForAccount, getDecryptedTokens,
  markNeedsReconnect, recordPollSuccess, recordPollFailure, deleteConnection,
} from '../src/connections-repo.js';

function acct(mailboxId: number): number {
  return (db.prepare('SELECT account_id FROM mailboxes WHERE id = ?').get(mailboxId) as { account_id: number }).account_id;
}

describe('connections-repo', () => {
  it('upserts a connection and round-trips decrypted tokens', () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 123 }, cursor: '100',
    });
    const t = getDecryptedTokens(id);
    expect(t).toEqual({ accessToken: 'A', refreshToken: 'R', expiresAt: 123 });
  });

  it('upsert updates the existing row for the same mailbox in place', () => {
    const mb = seedMailbox('alice@gmail.com');
    const a = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const b = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A2', refreshToken: 'R2', expiresAt: 2 }, cursor: '2',
    });
    expect(b).toBe(a);
    expect(getDecryptedTokens(a)!.accessToken).toBe('A2');
  });

  it('lists connections for an account without exposing encrypted columns', () => {
    const mb = seedMailbox('alice@gmail.com');
    upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const list = listConnectionsForAccount(acct(mb));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ provider: 'gmail', email: 'alice@gmail.com', status: 'active' });
    expect(list[0]).not.toHaveProperty('access_enc');
  });

  it('markNeedsReconnect / recordPollFailure / recordPollSuccess update bookkeeping', () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    recordPollFailure(id, 'boom', 1000);
    let row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.consecutive_failures).toBe(1);
    expect(row.last_error).toBe('boom');

    recordPollSuccess(id, '999', 2000);
    row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.consecutive_failures).toBe(0);
    expect(row.cursor).toBe('999');
    expect(row.last_polled_at).toBe(2000);
    expect(row.last_error).toBeNull();

    markNeedsReconnect(id, 'unauth');
    row = db.prepare('SELECT status FROM connections WHERE id = ?').get(id) as any;
    expect(row.status).toBe('needs_reconnect');
  });

  it('deleteConnection removes the row but keeps the mailbox', () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    deleteConnection(id);
    expect(db.prepare('SELECT 1 FROM connections WHERE id = ?').get(id)).toBeUndefined();
    expect(db.prepare('SELECT 1 FROM mailboxes WHERE id = ?').get(mb)).toBeTruthy();
  });
});
