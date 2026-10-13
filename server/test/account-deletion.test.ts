import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { createAccount } from '../src/accounts.js';
import { hashPassword } from '../src/users.js';
import { setStripeClientForTests, type StripeApi } from '../src/billing.js';
import { injectQuarantined, seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { isUsernameAvailable } from '../src/usernames.js';

const billing = config.billing as { -readonly [K in keyof typeof config.billing]: (typeof config.billing)[K] };
const billingDefaults = { ...config.billing };
afterEach(() => {
  setStripeClientForTests(null);
  Object.assign(billing, billingDefaults);
});

const PASSWORD = 'a-long-enough-password';

async function tenant(email: string, local: string) {
  const accountId = createAccount(`acct-${local}`).id;
  const userId = (db
    .prepare(
      `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(email, await hashPassword(PASSWORD), accountId, Date.now(), Date.now()) as { id: number }).id;
  const mailboxId = seedMailbox(`${local}@zero-spam.email`);
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(accountId, mailboxId);
  return { accountId, userId, mailboxId, cookie: makeSessionCookie(userId) };
}

function stubStripe(onCancel: (id: string) => Promise<unknown>) {
  const api: StripeApi = {
    customers: { create: async () => ({ id: 'cus_1' }) },
    checkout: { sessions: { create: async () => ({ url: null }) } },
    billingPortal: { sessions: { create: async () => ({ url: '' }) } },
    subscriptions: { cancel: onCancel },
  };
  setStripeClientForTests(api);
}

describe('POST /api/account/delete', () => {
  it('deletes the account, its mail on disk, and nothing belonging to anyone else', async () => {
    const app = await startApi();
    try {
      const a = await tenant('alice@example.org', 'alice');
      const b = await tenant('bob@example.org', 'bob');
      // The shared signup domain row happens to be owned by Alice's account.
      db.prepare("UPDATE domains SET account_id = ? WHERE name = 'zero-spam.email'").run(a.accountId);
      const aliceMsg = await injectQuarantined({ to: 'alice@zero-spam.email', from: 'x@example.net', subject: 'hi' });
      const bobMsg = await injectQuarantined({ to: 'bob@zero-spam.email', from: 'y@example.net', subject: 'yo' });
      const alicePath = (db.prepare('SELECT raw_path FROM messages WHERE id = ?').get(aliceMsg) as { raw_path: string }).raw_path;
      db.prepare(`INSERT INTO aliases (mailbox_id, address, created_at, received_count, abused) VALUES (?, 'shop@zero-spam.email', ?, 0, 0)`).run(a.mailboxId, Date.now());
      expect(existsSync(alicePath)).toBe(true);

      const wrong = await app.inject({ method: 'POST', url: '/api/account/delete', headers: { cookie: a.cookie }, payload: { password: 'nope' } });
      expect(wrong.statusCode).toBe(403);
      expect(db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(a.accountId)).toBeTruthy();

      const r = await app.inject({ method: 'POST', url: '/api/account/delete', headers: { cookie: a.cookie }, payload: { password: PASSWORD } });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ ok: true, mailboxes: 1, messages: 1, users: 1 });

      expect(db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(a.accountId)).toBeUndefined();
      expect(db.prepare('SELECT 1 FROM users WHERE id = ?').get(a.userId)).toBeUndefined();
      expect(db.prepare('SELECT 1 FROM mailboxes WHERE id = ?').get(a.mailboxId)).toBeUndefined();
      expect(db.prepare('SELECT 1 FROM messages WHERE id = ?').get(aliceMsg)).toBeUndefined();
      expect(db.prepare("SELECT 1 FROM aliases WHERE address = 'shop@zero-spam.email'").get()).toBeUndefined();
      expect(existsSync(alicePath)).toBe(false);

      // Nobody can claim the deleted addresses and receive Alice's mail.
      expect(isUsernameAvailable('alice', 'zero-spam.email')).toBe(false);
      expect(db.prepare("SELECT 1 FROM retired_addresses WHERE address = 'shop@zero-spam.email'").get()).toBeTruthy();

      // Bob and the shared domain are untouched (domain handed to the operator account).
      expect(db.prepare('SELECT 1 FROM messages WHERE id = ?').get(bobMsg)).toBeTruthy();
      const dom = db.prepare("SELECT account_id FROM domains WHERE name = 'zero-spam.email'").get() as { account_id: number };
      expect(dom.account_id).toBe(1);

      // The old session no longer works.
      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: a.cookie } });
      expect(me.statusCode).toBe(401);
      void b;
    } finally {
      await app.close();
    }
  });

  it('cancels a live subscription first, and deletes nothing if Stripe refuses', async () => {
    const app = await startApi();
    try {
      billing.stripeSecretKey = 'sk_test_x';
      const a = await tenant('carol@example.org', 'carol');
      db.prepare("UPDATE accounts SET stripe_subscription_id = 'sub_1', subscription_status = 'active' WHERE id = ?").run(a.accountId);

      stubStripe(async () => {
        throw new Error('stripe down');
      });
      const fail = await app.inject({ method: 'POST', url: '/api/account/delete', headers: { cookie: a.cookie }, payload: { password: PASSWORD } });
      expect(fail.statusCode).toBe(409);
      expect(db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(a.accountId)).toBeTruthy();

      const cancelled: string[] = [];
      stubStripe(async (id) => cancelled.push(id));
      const ok = await app.inject({ method: 'POST', url: '/api/account/delete', headers: { cookie: a.cookie }, payload: { password: PASSWORD } });
      expect(ok.statusCode).toBe(200);
      expect(cancelled).toEqual(['sub_1']);
    } finally {
      await app.close();
    }
  });

  it('refuses the operator account', async () => {
    const app = await startApi();
    try {
      const { userId, password } = await seedOwner({ email: 'op@example.com' });
      const r = await app.inject({ method: 'POST', url: '/api/account/delete', headers: { cookie: makeSessionCookie(userId) }, payload: { password } });
      expect(r.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it('works while the trial has ended (paywalled)', async () => {
    const app = await startApi();
    try {
      billing.enabled = true;
      const a = await tenant('dave@example.org', 'dave');
      db.prepare('UPDATE accounts SET billing_exempt = 0, trial_ends_at = ? WHERE id = ?').run(Date.now() - 1000, a.accountId);
      const blocked = await app.inject({ method: 'GET', url: `/api/mailboxes`, headers: { cookie: a.cookie } });
      expect(blocked.statusCode).toBe(402);
      const r = await app.inject({ method: 'POST', url: '/api/account/delete', headers: { cookie: a.cookie }, payload: { password: PASSWORD } });
      expect(r.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
