// server/test/auth-signup.test.ts
//
// We verify email dispatch by spying on sendMessage from sender.ts directly.
// This avoids fragile nodemailer transport patching and works regardless of
// whether the transport is cached at module load time or not.
// The nodemailer mock in setup.ts still prevents real SMTP; the spy just lets
// us assert that sendMessage was called with the right subject/text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { signupRoutes } from '../src/routes/signup.js';
import { db } from '../src/db.js';
import * as sender from '../src/sender.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(signupRoutes);
  return app;
}

describe('POST /api/auth/signup', () => {
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendSpy = vi.spyOn(sender, 'sendMessage').mockResolvedValue({
      messageId: 'test-msg-id',
      envelopeFrom: 'alice@zero-spam.email',
      recipients: ['alice@example.com'],
      signed: true,
      whitelistAdded: 0,
    });
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  it('happy path: creates account+user+mailbox, dispatches verify email, returns userId+accountId, email_verified_at is NULL', async () => {
    const app = await buildApp();

    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'alice@example.com', password: 'correct-horse-battery-staple', username: 'alice' },
    });

    expect(r.statusCode).toBe(201);
    const body = r.json();
    expect(typeof body.userId).toBe('number');
    expect(typeof body.accountId).toBe('number');

    // account row exists
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(body.accountId) as any;
    expect(account).toBeTruthy();

    // user row exists with email_verified_at = NULL
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(body.userId) as any;
    expect(user).toBeTruthy();
    expect(user.email).toBe('alice@example.com');
    expect(user.email_verified_at).toBeNull();
    expect(user.account_id).toBe(body.accountId);

    // mailbox row exists
    const mailbox = db.prepare('SELECT * FROM mailboxes WHERE address = ?').get('alice@zero-spam.email') as any;
    expect(mailbox).toBeTruthy();
    expect(mailbox.account_id).toBe(body.accountId);

    // verify email dispatched with correct content
    expect(sendSpy).toHaveBeenCalledOnce();
    const sendCall = sendSpy.mock.calls[0][0];
    expect(sendCall.subject).toMatch(/verify/i);
    expect(sendCall.text).toContain('/auth/verify?t=');
    expect(sendCall.to).toContain('alice@example.com');
  });

  it('rejects invalid username (uppercase)', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'bob@example.com', password: 'correct-horse-battery-staple', username: 'AL' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/username/i);
  });

  it('rejects reserved username', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'bob@example.com', password: 'correct-horse-battery-staple', username: 'admin' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/username/i);
  });

  it('rejects duplicate username (409)', async () => {
    const app = await buildApp();
    // First signup
    await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'first@example.com', password: 'correct-horse-battery-staple', username: 'carol' },
    });
    // Second signup with same username
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'second@example.com', password: 'correct-horse-battery-staple', username: 'carol' },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/username/i);
  });

  it('rejects duplicate email (409)', async () => {
    const app = await buildApp();
    // First signup
    await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'dave@example.com', password: 'correct-horse-battery-staple', username: 'dave' },
    });
    // Second signup with same email, different username
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'dave@example.com', password: 'correct-horse-battery-staple', username: 'dave2' },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/email/i);
  });

  it('rejects too-short password (400)', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'eve@example.com', password: 'short', username: 'eve' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/password/i);
  });
});
