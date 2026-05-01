import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { db, SYSTEM_ACCOUNT_ID } from '../src/db.js';
import { config } from '../src/config.js';

describe('system mailbox isolation', () => {
  it('account_id=1 user cannot read system mailbox messages via cross-tenant attack', async () => {
    const app = await startApi({ inject: true });
    try {
      // 1. Seed an "admin" owner (account_id=1, same as system mailbox WAS)
      const owner = await seedOwner({ email: 'admin@local' });
      expect(owner.accountId).toBe(1);

      // 2. Trigger a signup which will dispatch a verification email through
      //    the system mailbox (with the verify token in the message body)
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'victim@example.com', password: 'correct-horse-battery-staple', username: 'victim' },
      });
      expect(signupRes.statusCode).toBe(201);

      // 3. Look up the system mailbox id (it's now under SYSTEM_ACCOUNT_ID, not 1)
      const systemMb = db
        .prepare('SELECT id, account_id FROM mailboxes WHERE address = ?')
        .get(`noreply@${config.signupDomain}`) as { id: number; account_id: number } | undefined;
      expect(systemMb).toBeTruthy();
      expect(systemMb!.account_id).not.toBe(1);  // CRITICAL: must NOT be 1
      expect(systemMb!.account_id).toBe(SYSTEM_ACCOUNT_ID);

      // 4. Admin tries GET /api/mailboxes — should not include system mailbox
      const cookieValue = makeSessionCookie(owner.userId);
      const list = await app.inject({
        method: 'GET',
        url: '/api/mailboxes',
        headers: { cookie: cookieValue },
      });
      const mailboxes = JSON.parse(list.body) as { id: number; address: string }[];
      expect(mailboxes.find((m) => m.address.startsWith('noreply@'))).toBeUndefined();

      // 5. Admin guesses the system mailbox id and tries GET /api/messages
      const peek = await app.inject({
        method: 'GET',
        url: `/api/messages?mailboxId=${systemMb!.id}&folder=sent`,
        headers: { cookie: cookieValue },
      });
      expect(peek.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('login is rejected for sessions where user account_id = SYSTEM_ACCOUNT_ID', async () => {
    // Defense-in-depth: even if some path created a user with account_id=0,
    // requireAuth must reject their session.
    const app = await startApi({ inject: true });
    try {
      // Manually create a user at SYSTEM_ACCOUNT_ID
      const userRow = db.prepare(
        `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      ).get('rogue@local', 'x'.repeat(40), SYSTEM_ACCOUNT_ID, Date.now(), Date.now()) as { id: number };

      const cookieValue = makeSessionCookie(userRow.id);
      const r = await app.inject({
        method: 'GET',
        url: '/api/mailboxes',
        headers: { cookie: cookieValue },
      });
      expect(r.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
