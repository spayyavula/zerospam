import { describe, it, expect, beforeEach } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox } from './helpers.js';
import { upsertConnection } from '../src/connections-repo.js';
import { db } from '../src/db.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeEach(async () => {
  app = await startApi({ inject: true });
});

function acct(mb: number): number {
  return (db.prepare('SELECT account_id FROM mailboxes WHERE id = ?').get(mb) as { account_id: number }).account_id;
}

describe('connections routes', () => {
  it('GET /api/connections lists the account connections', async () => {
    const mb = seedMailbox('alice@gmail.com');
    upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const res = await app.inject({
      method: 'GET', url: '/api/connections',
      headers: { 'x-test-account': String(acct(mb)), 'x-test-user': String(acct(mb)) },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ provider: 'gmail', email: 'alice@gmail.com' });
  });

  it('DELETE /api/connections/:id removes the row, keeps the mailbox', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const res = await app.inject({
      method: 'DELETE', url: `/api/connections/${id}`,
      headers: { 'x-test-account': String(acct(mb)), 'x-test-user': String(acct(mb)) },
    });
    expect(res.statusCode).toBe(200);
    expect(db.prepare('SELECT 1 FROM connections WHERE id = ?').get(id)).toBeUndefined();
    expect(db.prepare('SELECT 1 FROM mailboxes WHERE id = ?').get(mb)).toBeTruthy();
  });

  it('DELETE returns 404 for a connection on another account', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 1 }, cursor: '1',
    });
    const res = await app.inject({
      method: 'DELETE', url: `/api/connections/${id}`,
      headers: { 'x-test-account': '999', 'x-test-user': '999' },
    });
    expect(res.statusCode).toBe(404);
  });
});
