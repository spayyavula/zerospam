import { describe, it, expect } from 'vitest';
import { runSeedOwner } from '../src/seed-owner.js';
import { db } from '../src/db.js';

describe('seed:owner', () => {
  it('creates the owner row from CLI flags (non-interactive)', async () => {
    await runSeedOwner({
      argv: ['--email', 'alice@example.com', '--password', 'hunter2-correct-horse'],
    });
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get('alice@example.com') as any;
    expect(u).toBeTruthy();
  });

  it('refuses to overwrite an existing owner', async () => {
    await runSeedOwner({ argv: ['--email', 'alice@example.com', '--password', 'pass-one-12345'] });
    await expect(
      runSeedOwner({ argv: ['--email', 'alice@example.com', '--password', 'pass-two-12345'] }),
    ).rejects.toThrow(/already exists/i);
  });
});
