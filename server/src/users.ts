import argon2 from 'argon2';
import { db, type User } from './db.js';
import { encryptTotpSecret } from './totp.js';

// Explicit argon2id parameters pinned to the OWASP ASVS V2.4 recommended
// baseline (19 MiB memory, 2 iterations, 1 lane) rather than relying on library
// defaults, so the work factor is documented and stable across argon2 bumps.
// argon2.verify reads parameters from the stored hash, so existing hashes keep
// verifying even if these are retuned later.
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export type CreateOwnerInput = { email: string; password: string; verified?: boolean };

export async function createOwner(input: CreateOwnerInput): Promise<number> {
  const hash = await hashPassword(input.password);
  const row = db
    .prepare(
      `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
       VALUES (?, ?, 1, ?, ?) RETURNING id`,
    )
    .get(
      input.email.toLowerCase(),
      hash,
      input.verified === false ? null : Date.now(),
      Date.now(),
    ) as { id: number };
  return row.id;
}

export function getOwnerByEmail(email: string): User | undefined {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase()) as User | undefined;
}

export function getOwnerById(id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export async function updateOwnerPassword(id: number, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
}

export function setTotpSecret(id: number, secret: string | null): void {
  // Store encrypted-at-rest; null clears the seed (TOTP disabled).
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled_at = ? WHERE id = ?').run(
    secret ? encryptTotpSecret(secret) : null,
    secret ? Date.now() : null,
    id,
  );
}
