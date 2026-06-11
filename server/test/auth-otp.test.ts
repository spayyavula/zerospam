import { describe, it, expect } from 'vitest';
import { issueCode, verifyCode } from '../src/auth/otp.js';
import { db } from '../src/db.js';

describe('otp.issueCode', () => {
  it('inserts a row, hashes the code, returns plaintext code', async () => {
    const { code } = await issueCode({ email: 'a@b.com', purpose: 'login' });
    expect(code).toMatch(/^\d{6}$/);
    const row = db.prepare('SELECT * FROM otp_codes WHERE email=?').get('a@b.com') as any;
    expect(row.code_hash).not.toBe(code);
    expect(row.purpose).toBe('login');
    expect(row.expires_at).toBeGreaterThan(row.created_at);
  });
  it('invalidates a previous active code for same (email, purpose)', async () => {
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    const active = db
      .prepare("SELECT COUNT(*) c FROM otp_codes WHERE email=? AND purpose='login' AND consumed_at IS NULL")
      .get('a@b.com') as { c: number };
    expect(active.c).toBe(1);
  });
});

describe('otp.verifyCode', () => {
  it('returns ok and consumes the row on the right code', async () => {
    const { code } = await issueCode({ email: 'a@b.com', purpose: 'login' });
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code });
    expect(r.ok).toBe(true);
    const row = db.prepare('SELECT consumed_at FROM otp_codes WHERE email=?').get('a@b.com') as any;
    expect(row.consumed_at).toBeTruthy();
  });
  it('rejects wrong code and increments attempt_count', async () => {
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code: '000000' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bad-code');
    const row = db.prepare('SELECT attempt_count FROM otp_codes WHERE email=?').get('a@b.com') as any;
    expect(row.attempt_count).toBe(1);
  });
  it('invalidates code after 5 failed attempts', async () => {
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    for (let i = 0; i < 5; i++) await verifyCode({ email: 'a@b.com', purpose: 'login', code: '000000' });
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code: '000000' });
    expect(r.reason).toBe('exhausted');
  });
  it('rejects expired code', async () => {
    const { code } = await issueCode({ email: 'a@b.com', purpose: 'login' });
    db.prepare('UPDATE otp_codes SET expires_at=? WHERE email=?').run(Date.now() - 1, 'a@b.com');
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code });
    expect(r.reason).toBe('expired');
  });
  it('rejects unknown email', async () => {
    const r = await verifyCode({ email: 'nobody@x.com', purpose: 'login', code: '111111' });
    expect(r.reason).toBe('not-found');
  });
});
