import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/users.js';

describe('password hashing', () => {
  it('hash + verify roundtrips', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'hunter2')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('returns false for malformed hashes (does not throw)', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });
});
