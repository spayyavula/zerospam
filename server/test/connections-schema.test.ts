import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('connections schema', () => {
  it('has all expected columns', () => {
    const cols = new Set(
      (db.prepare('PRAGMA table_info(connections)').all() as { name: string }[]).map((c) => c.name),
    );
    for (const c of [
      'id', 'account_id', 'mailbox_id', 'provider', 'access_enc', 'refresh_enc',
      'expires_at', 'cursor', 'status', 'last_polled_at', 'last_error',
      'consecutive_failures', 'created_at',
    ]) {
      expect(cols.has(c), `missing column: ${c}`).toBe(true);
    }
  });
});
