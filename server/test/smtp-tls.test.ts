import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildSmtpTlsOptions } from '../src/smtp.js';

describe('buildSmtpTlsOptions', () => {
  it('returns empty (plaintext) when cert/key are not configured', () => {
    expect(buildSmtpTlsOptions({ certPath: '', keyPath: '' })).toEqual({});
  });

  it('returns secure:false + key/cert when both paths exist', () => {
    // Use this test file itself as stand-in PEM files (existence is all we check).
    const here = fileURLToPath(import.meta.url);
    const opts = buildSmtpTlsOptions({ certPath: here, keyPath: here });
    expect(opts.secure).toBe(false); // STARTTLS, not implicit TLS
    expect(Buffer.isBuffer(opts.key)).toBe(true);
    expect(Buffer.isBuffer(opts.cert)).toBe(true);
  });

  it('throws a clear error if a configured path is missing', () => {
    expect(() => buildSmtpTlsOptions({ certPath: '/no/such/cert.pem', keyPath: '/no/such/key.pem' }))
      .toThrow(/TLS_CERT_PATH/);
  });
});
