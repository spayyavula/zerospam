import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import { generateTotpSecret, verifyTotp, provisioningUri } from '../src/totp.js';

describe('totp', () => {
  it('generateTotpSecret returns a base32 string', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(16);
  });

  it('verifyTotp accepts the current code', () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('verifyTotp rejects a wrong code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('provisioningUri builds an otpauth URL', () => {
    const secret = generateTotpSecret();
    const uri = provisioningUri('alice@example.com', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\/ZeroSpam:alice%40example.com\?/);
    expect(uri).toContain(`secret=${secret}`);
  });
});
