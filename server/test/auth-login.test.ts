// server/test/auth-login.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authenticator } from 'otplib';
import { authRoutes } from '../src/routes/auth.js';
import { seedOwner } from './fixtures/owner.js';
import { db } from '../src/db.js';
import { SESSION_COOKIE_NAME } from '../src/sessions.js';
import * as sender from '../src/sender.js';
import { seedMailbox } from './helpers.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/login', () => {
  it('returns 200 + sets a session cookie on correct credentials', async () => {
    const { email, password, userId } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    const setCookie = r.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const setCookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie!;
    expect(setCookieStr).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookieStr).toContain('HttpOnly');
    // Audit row recorded
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'login.ok'").get() as any;
    expect(audit.user_id).toBe(userId);
  });

  it('returns 401 on wrong password (with audit row)', async () => {
    const { email } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: 'WRONG' },
    });
    expect(r.statusCode).toBe(401);
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'login.fail'").get() as any;
    expect(JSON.parse(audit.detail).reason).toBe('bad-password');
  });

  it('returns 401 on unknown email (same shape as wrong password)', async () => {
    await seedOwner();
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'nobody@example.com', password: 'whatever' },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ error: 'invalid-credentials' });
    const audit = db.prepare("SELECT * FROM audit_log WHERE event = 'login.fail'").get() as any;
    expect(JSON.parse(audit.detail).reason).toBe('unknown-email');
  });
});

describe('login + TOTP', () => {
  it('returns needs_totp:true when TOTP is enabled and the code is missing', async () => {
    const { email, password } = await seedOwner({ totp: true });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ needs_totp: true });
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('accepts the correct TOTP code and issues a cookie', async () => {
    const { email, password, totpSecret } = await seedOwner({ totp: true });
    const code = authenticator.generate(totpSecret!);
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password, totp: code },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    expect(r.headers['set-cookie']).toBeTruthy();
  });

  it('rejects a wrong TOTP code', async () => {
    const { email, password } = await seedOwner({ totp: true });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password, totp: '000000' },
    });
    expect(r.statusCode).toBe(401);
  });
});

describe('login is blocked until verified', () => {
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Seed a mailbox for account_id=1 so dispatchVerificationEmail can send from it.
    seedMailbox('pending@zero-spam.email');
    sendSpy = vi.spyOn(sender, 'sendMessage').mockResolvedValue({
      messageId: 'test-msg-id',
      envelopeFrom: 'noreply@zero-spam.email',
      recipients: ['pending@example.com'],
      signed: true,
      whitelistAdded: 0,
    });
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  it('returns generic 401 for unverified user and dispatches a verification-resend email', async () => {
    const { email, password } = await seedOwner({ email: 'pending@example.com', verified: false });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password },
    });
    // Allow the fire-and-forget verification-resend microtask to run before asserting
    await new Promise((resolve) => setImmediate(resolve));
    expect(r.statusCode).toBe(401);
    expect(r.json().error).toBe('invalid-credentials');
    // Verification-resend email was dispatched
    expect(sendSpy).toHaveBeenCalledOnce();
    const sendCall = sendSpy.mock.calls[0][0];
    expect(sendCall.subject.toLowerCase()).toMatch(/verify/);
    expect(sendCall.to).toContain(email);
  });
});
