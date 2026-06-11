import { describe, it, expect } from 'vitest';
import { signState, verifyState } from '../src/oauth-state.js';

const SECRET = 'a'.repeat(64);

describe('oauth-state', () => {
  it('round-trips a payload', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() + 600_000 }, SECRET);
    expect(verifyState(t, SECRET, Date.now())).toEqual({
      v: 1, userId: 7, accountId: 3, exp: expect.any(Number),
    });
  });

  it('returns null for a tampered token', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() + 600_000 }, SECRET);
    const bad = t.slice(0, -2) + (t.endsWith('A') ? 'B' : 'A');
    expect(verifyState(bad, SECRET, Date.now())).toBeNull();
  });

  it('returns null for an expired token', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() - 1 }, SECRET);
    expect(verifyState(t, SECRET, Date.now())).toBeNull();
  });

  it('returns null for the wrong secret', () => {
    const t = signState({ v: 1, userId: 7, accountId: 3, exp: Date.now() + 600_000 }, SECRET);
    expect(verifyState(t, 'b'.repeat(64), Date.now())).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(verifyState('nope', SECRET, Date.now())).toBeNull();
  });
});
