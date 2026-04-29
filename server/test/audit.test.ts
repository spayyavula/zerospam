import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';
import { recordAudit } from '../src/audit.js';

describe('recordAudit', () => {
  it('inserts a row with normalized fields', () => {
    recordAudit({
      event: 'login.fail',
      userId: null,
      detail: { reason: 'bad-password', email: 'alice@example.com' },
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });
    const row = db.prepare('SELECT * FROM audit_log').get() as any;
    expect(row.event).toBe('login.fail');
    expect(row.user_id).toBeNull();
    expect(row.ip).toBe('127.0.0.1');
    expect(row.user_agent).toBe('vitest');
    expect(JSON.parse(row.detail)).toEqual({ reason: 'bad-password', email: 'alice@example.com' });
    expect(typeof row.at).toBe('number');
  });

  it('accepts a missing detail', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(1, 'test@example.com', 'hash', Date.now());
    recordAudit({ event: 'login.ok', userId: 1 });
    const row = db.prepare('SELECT * FROM audit_log').get() as any;
    expect(row.user_id).toBe(1);
    expect(row.detail).toBeNull();
  });
});
