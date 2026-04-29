import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createOwner, getOwnerByEmail, getOwnerById, updateOwnerPassword } from '../src/users.js';
import { db } from '../src/db.js';

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

describe('user CRUD', () => {
  it('createOwner inserts a row and rejects duplicates', async () => {
    const id = await createOwner({ email: 'alice@example.com', password: 'hunter2' });
    expect(typeof id).toBe('number');
    await expect(createOwner({ email: 'alice@example.com', password: 'x' })).rejects.toThrow();
  });

  it('getOwnerByEmail is case-insensitive on lookup', async () => {
    await createOwner({ email: 'alice@example.com', password: 'hunter2' });
    const row = getOwnerByEmail('ALICE@example.com');
    expect(row?.email).toBe('alice@example.com');
  });

  it('getOwnerById returns the row', async () => {
    const id = await createOwner({ email: 'alice@example.com', password: 'hunter2' });
    expect(getOwnerById(id)?.id).toBe(id);
  });

  it('updateOwnerPassword changes the hash', async () => {
    const id = await createOwner({ email: 'alice@example.com', password: 'old' });
    const oldHash = getOwnerById(id)!.password_hash;
    await updateOwnerPassword(id, 'new');
    expect(getOwnerById(id)!.password_hash).not.toBe(oldHash);
  });
});
