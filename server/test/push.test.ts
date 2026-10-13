import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { injectQuarantined, seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { buildNotification, notifyNewMail, setPushSenderForTests, type PushMessage } from '../src/push.js';

const TOKEN = 'ExponentPushToken[abcDEF1234567890]';
const billing = config.billing as { -readonly [K in keyof typeof config.billing]: (typeof config.billing)[K] };
const billingDefaults = { ...config.billing };

let calls: PushMessage[][] = [];
let tickets: (msgs: PushMessage[]) => { status: 'ok' | 'error'; details?: { error?: string } }[] = (m) => m.map(() => ({ status: 'ok' }));

beforeEach(() => {
  calls = [];
  tickets = (m) => m.map(() => ({ status: 'ok' }));
  setPushSenderForTests(async (msgs) => {
    calls.push(msgs);
    return tickets(msgs);
  });
});
afterEach(() => {
  setPushSenderForTests(null);
  Object.assign(billing, billingDefaults);
});

async function setup() {
  const { userId, accountId } = await seedOwner({ email: 'owner@example.com' });
  const mailboxId = seedMailbox('owner@zero-spam.email');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(accountId, mailboxId);
  db.prepare(`INSERT INTO whitelist_rules (mailbox_id, kind, pattern, created_at) VALUES (?, 'address', 'friend@example.org', ?)`).run(mailboxId, Date.now());
  return { userId, accountId, mailboxId };
}

function addDevice(userId: number, opts: { push?: string | null; preview?: 0 | 1; revoked?: boolean } = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  const row = db
    .prepare(
      `INSERT INTO devices (user_id, name, token_hash, platform, expo_push_token, push_preview, created_at, last_seen_at, revoked_at)
       VALUES (?, 'Pixel', ?, 'android', ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      userId,
      crypto.createHash('sha256').update(token).digest('hex'),
      opts.push === undefined ? TOKEN : opts.push,
      opts.preview ?? 1,
      Date.now(),
      Date.now(),
      opts.revoked ? Date.now() : null,
    ) as { id: number };
  return { id: row.id, bearer: token };
}

describe('buildNotification', () => {
  const msg = { from_name: 'Ada Lovelace', from_address: 'ada@example.org', subject: '  Notes on   the engine ' };
  it('shows sender and subject when previews are on', () => {
    expect(buildNotification(msg, 'me@zero-spam.email', true)).toEqual({ title: 'Ada Lovelace', body: 'Notes on the engine' });
  });
  it('is generic when previews are off', () => {
    expect(buildNotification(msg, 'me@zero-spam.email', false)).toEqual({ title: 'New message', body: 'In me@zero-spam.email' });
  });
  it('falls back to the address and clips long subjects', () => {
    const r = buildNotification({ from_name: null, from_address: 'x@y.z', subject: 'a'.repeat(300) }, 'm', true);
    expect(r.title).toBe('x@y.z');
    expect(r.body.length).toBe(140);
  });
});

describe('notifyNewMail', () => {
  it('notifies every live device of the account for Inbox mail', async () => {
    const { userId, mailboxId } = await setup();
    addDevice(userId);
    addDevice(userId, { push: 'ExponentPushToken[secondDevice0001]', preview: 0 });
    addDevice(userId, { push: 'ExponentPushToken[revokedDevice001]', revoked: true });
    addDevice(userId, { push: null });
    const id = await injectQuarantined({ to: 'owner@zero-spam.email', from: 'friend@example.org', fromName: 'Friend', subject: 'Lunch?' });
    expect((db.prepare('SELECT folder FROM messages WHERE id = ?').get(id) as { folder: string }).folder).toBe('inbox');

    calls = [];
    const sent = await notifyNewMail(mailboxId, id);
    expect(sent).toBe(2);
    expect(calls).toHaveLength(1);
    const byToken = Object.fromEntries(calls[0].map((m) => [m.to, m]));
    expect(byToken[TOKEN]).toMatchObject({ title: 'Friend', body: 'Lunch?', data: { messageId: id, mailboxId }, channelId: 'mail' });
    expect(byToken['ExponentPushToken[secondDevice0001]']).toMatchObject({ title: 'New message' });
  });

  it('stays quiet for quarantined mail', async () => {
    const { userId, mailboxId } = await setup();
    addDevice(userId);
    const id = await injectQuarantined({ to: 'owner@zero-spam.email', from: 'stranger@example.net', subject: 'hi' });
    calls = [];
    expect(await notifyNewMail(mailboxId, id)).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('stays quiet for an account whose trial ended', async () => {
    billing.enabled = true;
    const { userId, accountId, mailboxId } = await setup();
    db.prepare('UPDATE accounts SET billing_exempt = 0, trial_ends_at = ? WHERE id = ?').run(Date.now() - 1000, accountId);
    try {
      addDevice(userId);
      const id = await injectQuarantined({ to: 'owner@zero-spam.email', from: 'friend@example.org', subject: 'x' });
      calls = [];
      expect(await notifyNewMail(mailboxId, id)).toBe(0);
      expect(calls).toHaveLength(0);
    } finally {
      // seedOwner uses the shared default account, which other test files expect exempt.
      db.prepare('UPDATE accounts SET billing_exempt = 1, trial_ends_at = NULL WHERE id = ?').run(accountId);
    }
  });

  it('forgets tokens Expo reports as unregistered', async () => {
    const { userId, mailboxId } = await setup();
    const dev = addDevice(userId);
    const id = await injectQuarantined({ to: 'owner@zero-spam.email', from: 'friend@example.org', subject: 'x' });
    tickets = (m) => m.map(() => ({ status: 'error', details: { error: 'DeviceNotRegistered' } }));
    await notifyNewMail(mailboxId, id);
    expect((db.prepare('SELECT expo_push_token FROM devices WHERE id = ?').get(dev.id) as { expo_push_token: string | null }).expo_push_token).toBeNull();
  });

  it('never throws when the push service fails', async () => {
    const { userId, mailboxId } = await setup();
    addDevice(userId);
    const id = await injectQuarantined({ to: 'owner@zero-spam.email', from: 'friend@example.org', subject: 'x' });
    setPushSenderForTests(async () => {
      throw new Error('boom');
    });
    await expect(notifyNewMail(mailboxId, id)).resolves.toBe(0);
  });
});

describe('PUT /api/auth/devices/me/push', () => {
  it('stores the token and preview choice for the calling device', async () => {
    const app = await startApi();
    try {
      const { userId } = await setup();
      const dev = addDevice(userId, { push: null });
      const other = addDevice(userId);
      const auth = { authorization: `Bearer ${dev.bearer}` };

      const r = await app.inject({ method: 'PUT', url: '/api/auth/devices/me/push', headers: auth, payload: { token: TOKEN, showPreview: false } });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ enabled: true, showPreview: false });
      // The same install's token moves off the old device row.
      expect((db.prepare('SELECT expo_push_token FROM devices WHERE id = ?').get(other.id) as { expo_push_token: string | null }).expo_push_token).toBeNull();

      const g = await app.inject({ method: 'GET', url: '/api/auth/devices/me/push', headers: auth });
      expect(g.json()).toEqual({ enabled: true, showPreview: false });

      const bad = await app.inject({ method: 'PUT', url: '/api/auth/devices/me/push', headers: auth, payload: { token: 'not-a-token' } });
      expect(bad.statusCode).toBe(422);

      const off = await app.inject({ method: 'PUT', url: '/api/auth/devices/me/push', headers: auth, payload: { token: null } });
      expect(off.json()).toMatchObject({ enabled: false });
    } finally {
      await app.close();
    }
  });

  it('needs a device token, not a browser session', async () => {
    const app = await startApi();
    try {
      const { userId } = await setup();
      const r = await app.inject({ method: 'PUT', url: '/api/auth/devices/me/push', headers: { cookie: makeSessionCookie(userId) }, payload: { token: TOKEN } });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('signing the device out clears its push token', async () => {
    const app = await startApi();
    try {
      const { userId } = await setup();
      const dev = addDevice(userId);
      await app.inject({ method: 'DELETE', url: '/api/auth/devices/me', headers: { authorization: `Bearer ${dev.bearer}` } });
      expect((db.prepare('SELECT expo_push_token FROM devices WHERE id = ?').get(dev.id) as { expo_push_token: string | null }).expo_push_token).toBeNull();
    } finally {
      await app.close();
    }
  });
});
