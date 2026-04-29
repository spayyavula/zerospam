import { describe, it, expect } from 'vitest';
import { sign, verify, type DigestTokenPayload } from '../src/digest-token.js';

const SECRET = 'test-secret-thirty-two-bytes-min-padpadpadpad';

function payload(over: Partial<DigestTokenPayload> = {}): DigestTokenPayload {
  return {
    v: 1,
    mailboxId: 42,
    sender: 'sales@acme.com',
    action: 'allow-forever',
    exp: Date.now() + 86_400_000,
    ...over,
  };
}

describe('digest-token', () => {
  it('round-trips a valid payload', () => {
    // Pin `exp` so the assertion compares the same payload that was signed.
    // Calling payload() twice with default exp = Date.now() + N would race.
    const exp = Date.now() + 86_400_000;
    const p = payload({ exp });
    const t = sign(p, SECRET);
    expect(verify(t, SECRET, Date.now())).toEqual(p);
  });

  it('returns null for a tampered signature', () => {
    const t = sign(payload(), SECRET);
    const tampered = t.slice(0, -2) + (t.endsWith('A') ? 'B' : 'A');
    expect(verify(tampered, SECRET, Date.now())).toBeNull();
  });

  it('returns null for an expired token', () => {
    const t = sign(payload({ exp: Date.now() - 1000 }), SECRET);
    expect(verify(t, SECRET, Date.now())).toBeNull();
  });

  it('returns null for malformed input (no separator)', () => {
    expect(verify('not-a-token', SECRET, Date.now())).toBeNull();
  });

  it('returns null for non-base64url segments', () => {
    expect(verify('!!!!.????', SECRET, Date.now())).toBeNull();
  });

  it('returns null for non-JSON payload', () => {
    expect(verify('aGVsbG8.aGVsbG8', SECRET, Date.now())).toBeNull();
  });

  it('returns null for unknown version', () => {
    const t = sign(payload({ v: 2 as 1 }), SECRET);
    expect(verify(t, SECRET, Date.now())).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const t = sign(payload(), SECRET);
    expect(verify(t, 'other-secret-thirty-two-bytes-min-padpadpadpadx', Date.now())).toBeNull();
  });
});
