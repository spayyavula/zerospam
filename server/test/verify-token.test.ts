import { describe, it, expect } from 'vitest';
import { signVerifyToken, verifyVerifyToken, type VerifyTokenPayload } from '../src/verify-token.js';

const SECRET = 'a'.repeat(64);

describe('verify-token', () => {
  it('round-trips a payload', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() + 60_000 } as const;
    const token = signVerifyToken(payload, SECRET);
    const got = verifyVerifyToken(token, SECRET, Date.now());
    expect(got).toEqual(payload);
  });

  it('returns null for a tampered token', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() + 60_000 } as const;
    const token = signVerifyToken(payload, SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyVerifyToken(tampered, SECRET, Date.now())).toBeNull();
  });

  it('returns null for an expired token', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() - 1 } as const;
    const token = signVerifyToken(payload, SECRET);
    expect(verifyVerifyToken(token, SECRET, Date.now())).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() + 60_000 } as const;
    const token = signVerifyToken(payload, 'other-secret-padded-out-to-32-chars-min');
    expect(verifyVerifyToken(token, SECRET, Date.now())).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(verifyVerifyToken('', SECRET, Date.now())).toBeNull();
    expect(verifyVerifyToken('no-dot-here', SECRET, Date.now())).toBeNull();
    expect(verifyVerifyToken('a.b', SECRET, Date.now())).toBeNull();
  });

  it('returns null for an unknown version', () => {
    const token = signVerifyToken({ v: 2 as 1, userId: 42, exp: Date.now() + 60_000 }, SECRET);
    expect(verifyVerifyToken(token, SECRET, Date.now())).toBeNull();
  });

  it('returns null when the payload segment is tampered', () => {
    const payload = { v: 1, userId: 42, exp: Date.now() + 60_000 } as const;
    const token = signVerifyToken(payload, SECRET);
    const dot = token.indexOf('.');
    const head = token.slice(0, dot);
    const tail = token.slice(dot);
    const tamperedHead = head.slice(0, -1) + (head.endsWith('A') ? 'B' : 'A');
    expect(verifyVerifyToken(tamperedHead + tail, SECRET, Date.now())).toBeNull();
  });

  it('returns null when userId is a string at runtime', () => {
    // Bypass the typed signer to simulate a payload that came from a different code path.
    const bad = { v: 1, userId: '42', exp: Date.now() + 60_000 };
    const token = signVerifyToken(bad as unknown as VerifyTokenPayload, SECRET);
    expect(verifyVerifyToken(token, SECRET, Date.now())).toBeNull();
  });
});
