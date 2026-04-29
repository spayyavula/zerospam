import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';

describe('db schema', () => {
  it('has the auth/device/audit tables', () => {
    const names = (db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]).map((r) => r.name);
    for (const t of ['users', 'sessions', 'pairing_codes', 'devices', 'audit_log']) {
      expect(names).toContain(t);
    }
  });
});
