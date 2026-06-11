import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../src/connection-crypto.js';
import { randomBytes } from 'node:crypto';

const KEY = randomBytes(32);

describe('connection-crypto', () => {
  it('round-trips a token', () => {
    const blob = encryptToken('ya29.secret-access-token', KEY);
    expect(decryptToken(blob, KEY)).toBe('ya29.secret-access-token');
  });

  it('produces different ciphertext each call (random IV)', () => {
    expect(encryptToken('same', KEY)).not.toBe(encryptToken('same', KEY));
  });

  it('returns null for a tampered blob', () => {
    const blob = encryptToken('secret', KEY);
    const tampered = blob.slice(0, -2) + (blob.endsWith('A') ? 'B' : 'A');
    expect(decryptToken(tampered, KEY)).toBeNull();
  });

  it('returns null when decrypted with the wrong key', () => {
    const blob = encryptToken('secret', KEY);
    expect(decryptToken(blob, randomBytes(32))).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(decryptToken('not-base64-!!', KEY)).toBeNull();
    expect(decryptToken('', KEY)).toBeNull();
  });
});
