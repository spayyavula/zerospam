import argon2 from 'argon2';
import { db } from '../db.js';

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const PURPOSES = ['login', 'signup', 'password_set', 'sensitive_op'] as const;
export type OtpPurpose = (typeof PURPOSES)[number];

function generate6(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, '0');
}

export async function issueCode(opts: {
  email: string;
  purpose: OtpPurpose;
  signupPayload?: unknown;
}): Promise<{ code: string; expiresAt: number }> {
  const code = generate6();
  const codeHash = await argon2.hash(code);
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  db.prepare(
    `UPDATE otp_codes SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL`,
  ).run(now, opts.email.toLowerCase(), opts.purpose);
  db.prepare(
    `INSERT INTO otp_codes (email, code_hash, purpose, created_at, expires_at, signup_payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.email.toLowerCase(),
    codeHash,
    opts.purpose,
    now,
    expiresAt,
    opts.signupPayload ? JSON.stringify(opts.signupPayload) : null,
  );
  return { code, expiresAt };
}

type VerifyResult =
  | { ok: true; payload: unknown }
  | { ok: false; reason: 'not-found' | 'expired' | 'bad-code' | 'exhausted' };

export async function verifyCode(opts: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyResult> {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND purpose = ? AND consumed_at IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get(opts.email.toLowerCase(), opts.purpose) as
    | { id: number; code_hash: string; expires_at: number; attempt_count: number; signup_payload: string | null }
    | undefined;
  if (!row) {
    // Check if the most recent row for this (email, purpose) was exhausted —
    // consumed_at was set by exhaustion logic, not expiry or success.
    const exhausted = db
      .prepare(
        `SELECT id FROM otp_codes WHERE email = ? AND purpose = ? AND consumed_at IS NOT NULL
         AND attempt_count >= ? ORDER BY id DESC LIMIT 1`,
      )
      .get(opts.email.toLowerCase(), opts.purpose, MAX_ATTEMPTS) as { id: number } | undefined;
    if (exhausted) return { ok: false, reason: 'exhausted' };
    return { ok: false, reason: 'not-found' };
  }
  if (row.expires_at < Date.now()) {
    db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
    return { ok: false, reason: 'expired' };
  }
  if (row.attempt_count >= MAX_ATTEMPTS) {
    db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
    return { ok: false, reason: 'exhausted' };
  }
  const ok = await argon2.verify(row.code_hash, opts.code);
  if (!ok) {
    db.prepare('UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id=?').run(row.id);
    const next = row.attempt_count + 1;
    if (next >= MAX_ATTEMPTS) {
      db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
      return { ok: false, reason: 'exhausted' };
    }
    return { ok: false, reason: 'bad-code' };
  }
  db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
  return { ok: true, payload: row.signup_payload ? JSON.parse(row.signup_payload) : null };
}
