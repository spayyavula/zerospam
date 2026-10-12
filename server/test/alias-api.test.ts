import { describe, it, expect, afterEach } from 'vitest';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { isUsernameAvailable, isReserved } from '../src/usernames.js';
import { seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { createAccount } from '../src/accounts.js';

const sent = (): any[] => (globalThis as any).__sentMail;
const limits = config.aliases as { -readonly [K in keyof typeof config.aliases]: (typeof config.aliases)[K] };
const defaults = { ...config.aliases };
afterEach(() => {
  Object.assign(limits, defaults);
});

async function authed(email = 'owner@example.com', opts: { separateAccount?: boolean } = {}) {
  const app = await startApi();
  let userId: number;
  let accountId: number;
  if (opts.separateAccount) {
    // seedOwner always lands in the default account; a second tenant needs its own.
    accountId = createAccount(`acct-${email}`).id;
    userId = (db
      .prepare(
        `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
         VALUES (?, 'x', ?, ?, ?) RETURNING id`,
      )
      .get(email, accountId, Date.now(), Date.now()) as { id: number }).id;
  } else {
    ({ userId, accountId } = await seedOwner({ email }));
  }
  const mailboxId = seedMailbox(`${email.split('@')[0]}@zero-spam.email`);
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(accountId, mailboxId);
  const cookie = makeSessionCookie(userId);
  const call = (method: string, url: string, payload?: unknown) =>
    app.inject({ method: method as any, url, payload: payload as any, headers: { cookie } });
  return { app, accountId, mailboxId, call };
}

function tokenFromLastMail(): string {
  const text: string = sent()[sent().length - 1].text;
  const m = text.match(/\/public\/forward\/verify\?t=([A-Za-z0-9_%-]+)/);
  if (!m) throw new Error('no verify link in mail');
  return decodeURIComponent(m[1]);
}

describe('forward targets API', () => {
  it('auto-verifies the account\'s own verified login email without sending mail', async () => {
    const { app, call } = await authed();
    try {
      const r = await call('POST', '/api/forward-targets', { email: 'Owner@Example.com' });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ email: 'owner@example.com', verified: true });
      expect(sent()).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('verifies other addresses by emailed link: GET confirms only, POST verifies once', async () => {
    const { app, call } = await authed();
    try {
      const r = await call('POST', '/api/forward-targets', { email: 'me@gmail.com' });
      expect(r.json()).toMatchObject({ email: 'me@gmail.com', verified: false });
      expect(sent()).toHaveLength(1);
      expect(sent()[0].to).toEqual(['me@gmail.com']);
      const t = tokenFromLastMail();

      const page = await app.inject({ method: 'GET', url: `/public/forward/verify?t=${encodeURIComponent(t)}` });
      expect(page.statusCode).toBe(200);
      expect(page.body).toContain('me@gmail.com');
      expect(page.body).toContain('method="POST"');
      const stillPending = db.prepare('SELECT verified_at FROM forward_targets').get() as any;
      expect(stillPending.verified_at).toBeNull(); // pre-fetchers can't verify

      const post = await app.inject({
        method: 'POST',
        url: '/public/forward/verify',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: `t=${encodeURIComponent(t)}`,
      });
      expect(post.body).toContain('Forwarding address confirmed');
      const list = (await call('GET', '/api/forward-targets')).json();
      expect(list[0].verified_at).toBeTypeOf('number');
      expect(list[0]).not.toHaveProperty('verify_token_hash');

      const replay = await app.inject({
        method: 'POST',
        url: '/public/forward/verify',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: `t=${encodeURIComponent(t)}`,
      });
      expect(replay.body).toContain('expired or invalid');
    } finally {
      await app.close();
    }
  });

  it('rejects expired tokens and lets the user resend', async () => {
    const { app, call } = await authed();
    try {
      const { id } = (await call('POST', '/api/forward-targets', { email: 'me@gmail.com' })).json();
      const t = tokenFromLastMail();
      db.prepare('UPDATE forward_targets SET verify_expires_at = ?').run(Date.now() - 1);
      const page = await app.inject({ method: 'GET', url: `/public/forward/verify?t=${encodeURIComponent(t)}` });
      expect(page.body).toContain('expired or invalid');

      const resend = await call('POST', `/api/forward-targets/${id}/resend`);
      expect(resend.json()).toEqual({ ok: true });
      const t2 = tokenFromLastMail();
      expect(t2).not.toBe(t);
      const ok = await app.inject({ method: 'GET', url: `/public/forward/verify?t=${encodeURIComponent(t2)}` });
      expect(ok.body).toContain('Confirm');
    } finally {
      await app.close();
    }
  });

  it('rejects hosted domains, duplicates, and more than the per-account cap', async () => {
    limits.forwardTargetsMaxPerAccount = 2;
    const { app, call } = await authed();
    try {
      expect((await call('POST', '/api/forward-targets', { email: 'x@zero-spam.email' })).statusCode).toBe(400);
      expect((await call('POST', '/api/forward-targets', { email: 'not-an-email' })).statusCode).toBe(400);
      expect((await call('POST', '/api/forward-targets', { email: 'a@gmail.com' })).statusCode).toBe(200);
      expect((await call('POST', '/api/forward-targets', { email: 'a@gmail.com' })).statusCode).toBe(409);
      expect((await call('POST', '/api/forward-targets', { email: 'b@gmail.com' })).statusCode).toBe(200);
      const over = await call('POST', '/api/forward-targets', { email: 'c@gmail.com' });
      expect(over.statusCode).toBe(403);
      expect(over.json().error).toContain('limit');
    } finally {
      await app.close();
    }
  });

  it('deleting a target turns forwarding aliases back into storing ones', async () => {
    const { app, call, mailboxId } = await authed();
    try {
      const { id: targetId } = (await call('POST', '/api/forward-targets', { email: 'owner@example.com' })).json();
      const alias = (await call('POST', '/api/aliases', { mailboxId, mode: 'forward', forwardTargetId: targetId })).json();
      expect((await call('DELETE', `/api/forward-targets/${targetId}`)).json()).toEqual({ ok: true });
      const row = db.prepare('SELECT forward_target_id FROM aliases WHERE id = ?').get(alias.id) as any;
      expect(row.forward_target_id).toBeNull();
    } finally {
      await app.close();
    }
  });
});

describe('aliases API with forwarding', () => {
  it('creates aliases with a mode and lists the target email', async () => {
    const { app, call, mailboxId } = await authed();
    try {
      const { id: targetId } = (await call('POST', '/api/forward-targets', { email: 'owner@example.com' })).json();
      const created = await call('POST', '/api/aliases', { mailboxId, mode: 'both', forwardTargetId: targetId });
      expect(created.statusCode).toBe(200);
      expect(created.json()).toMatchObject({ mode: 'both', forward_target_id: targetId });
      const list = (await call('GET', `/api/aliases?mailboxId=${mailboxId}`)).json();
      expect(list[0]).toMatchObject({ mode: 'both', forward_target_email: 'owner@example.com', forwarded_count: 0 });
    } finally {
      await app.close();
    }
  });

  it('refuses forwarding modes without a verified target', async () => {
    const { app, call, mailboxId } = await authed();
    try {
      expect((await call('POST', '/api/aliases', { mailboxId, mode: 'forward' })).statusCode).toBe(400);
      const { id: pending } = (await call('POST', '/api/forward-targets', { email: 'me@gmail.com' })).json();
      const r = await call('POST', '/api/aliases', { mailboxId, mode: 'forward', forwardTargetId: pending });
      expect(r.statusCode).toBe(400);
      expect(r.json().error).toContain('not verified');
    } finally {
      await app.close();
    }
  });

  it('PATCH switches mode and target, validating both', async () => {
    const { app, call, mailboxId } = await authed();
    try {
      const alias = (await call('POST', '/api/aliases', { mailboxId, label: 'shop' })).json();
      expect((await call('PATCH', `/api/aliases/${alias.id}`, { mode: 'forward' })).statusCode).toBe(400);
      const { id: targetId } = (await call('POST', '/api/forward-targets', { email: 'owner@example.com' })).json();
      const ok = await call('PATCH', `/api/aliases/${alias.id}`, { mode: 'forward', forwardTargetId: targetId, label: 'store' });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ mode: 'forward', forward_target_email: 'owner@example.com', label: 'store' });
      const back = await call('PATCH', `/api/aliases/${alias.id}`, { mode: 'store' });
      expect(back.json()).toMatchObject({ mode: 'store' });
      expect((await call('PATCH', `/api/aliases/${alias.id}`, { mode: 'nope' })).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('scopes aliases and targets to the owning account', async () => {
    const a = await authed('owner@example.com');
    const b = await authed('other@example.org', { separateAccount: true });
    try {
      const { id: bTarget } = (await b.call('POST', '/api/forward-targets', { email: 'other@example.org' })).json();
      const aAlias = (await a.call('POST', '/api/aliases', { mailboxId: a.mailboxId })).json();
      // B cannot touch A's alias.
      expect((await b.call('PATCH', `/api/aliases/${aAlias.id}`, { mode: 'store' })).statusCode).toBe(404);
      // A cannot point an alias at B's target.
      const steal = await a.call('PATCH', `/api/aliases/${aAlias.id}`, { mode: 'forward', forwardTargetId: bTarget });
      expect(steal.statusCode).toBe(400);
      expect(steal.json().error).toContain('not found');
      // A cannot see or delete B's targets.
      expect((await a.call('GET', '/api/forward-targets')).json()).toEqual([]);
      expect((await a.call('DELETE', `/api/forward-targets/${bTarget}`)).statusCode).toBe(404);
    } finally {
      await a.app.close();
      await b.app.close();
    }
  });

  it('enforces the per-account alias cap and reports usage', async () => {
    limits.maxPerAccount = 2;
    const { app, call, mailboxId } = await authed();
    try {
      expect((await call('POST', '/api/aliases', { mailboxId })).statusCode).toBe(200);
      expect((await call('POST', '/api/aliases', { mailboxId })).statusCode).toBe(200);
      const over = await call('POST', '/api/aliases', { mailboxId });
      expect(over.statusCode).toBe(403);
      expect(over.json().error).toContain('alias limit');
      expect((await call('GET', '/api/aliases/usage')).json()).toEqual({ count: 2, max: 2 });
    } finally {
      await app.close();
    }
  });

  it('reserves the rv. namespace for reverse aliases', async () => {
    const { app, call, mailboxId } = await authed();
    try {
      const r = await call('POST', '/api/aliases', { mailboxId, localPart: 'rv.abc' });
      expect(r.statusCode).toBe(400);
      expect(isReserved('rv.anything')).toBe(true);
    } finally {
      await app.close();
    }
  });
});

describe('username availability', () => {
  it('a signup username cannot shadow an existing alias or reverse alias', async () => {
    const { call, app, mailboxId } = await authed();
    try {
      await call('POST', '/api/aliases', { mailboxId, localPart: 'shopping' });
      expect(isUsernameAvailable('shopping', 'zero-spam.email')).toBe(false);
      expect(isUsernameAvailable('shopping2', 'zero-spam.email')).toBe(true);
    } finally {
      await app.close();
    }
  });
});
