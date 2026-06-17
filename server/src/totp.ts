import { authenticator } from 'otplib';
import { encryptToken, decryptToken } from './connection-crypto.js';
import { loadConnectionSecret } from './config.js';

// Allow ±1 30-second window for clock drift. Replay protection is *not* implemented;
// the OTP step is short-lived and behind the password gate, so a one-time replay
// inside the 90-second window is acceptable for a single-owner system.
authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

// ---- TOTP secret encryption at rest (ASVS V2.8 / V6.2) ----
// Seeds are stored AES-256-GCM-encrypted under the connection vault key, tagged
// with a version prefix. decrypt* tolerates legacy plaintext rows so existing
// enrollments keep working; they're migrated to ciphertext on next good verify.
const ENC_PREFIX = 'enc:v1:';
let cachedKey: Buffer | null = null;
function vaultKey(): Buffer {
  if (!cachedKey) cachedKey = loadConnectionSecret();
  return cachedKey;
}

export function encryptTotpSecret(secret: string): string {
  return ENC_PREFIX + encryptToken(secret, vaultKey());
}

export function isEncryptedTotpSecret(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(ENC_PREFIX);
}

export function decryptTotpSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext seed
  return decryptToken(stored.slice(ENC_PREFIX.length), vaultKey());
}

// Verify a 6-digit code against a stored seed (encrypted or legacy plaintext).
export function verifyStoredTotp(stored: string | null | undefined, code: string): boolean {
  const secret = decryptTotpSecret(stored);
  if (!secret) return false;
  return verifyTotp(secret, code);
}

export function provisioningUri(accountName: string, secret: string): string {
  return authenticator.keyuri(accountName, 'ZeroSpam', secret);
}
