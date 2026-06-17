import { describe, it, expect } from 'vitest';
import { db } from '../src/db.js';
import { createSession, validateCookie, destroySession, touchSession } from '../src/sessions.js';

const SECRET = 'a'.repeat(64);

describe('sessions', () => {
  it('createSession inserts a row and returns a signed cookie value', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('alice@example.com', 'hash', Date.now()) as { id: number }).id;
    const { cookieValue, sessionId, expiresAt } = createSession(userId, SECRET);
    expect(cookieValue).toMatch(/^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    expect(expiresAt).toBeGreaterThan(Date.now());
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    expect(row).toBeTruthy();
  });

  it('validateCookie returns the user id for a valid cookie', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue } = createSession(userId, SECRET);
    const result = validateCookie(cookieValue, SECRET);
    expect(result?.userId).toBe(userId);
  });

  it('validateCookie returns null for a tampered cookie', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue } = createSession(userId, SECRET);
    const tampered = cookieValue.replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    expect(validateCookie(tampered, SECRET)).toBeNull();
  });

  it('validateCookie returns null for an expired session', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue, sessionId } = createSession(userId, SECRET);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, sessionId);
    expect(validateCookie(cookieValue, SECRET)).toBeNull();
  });

  it('destroySession removes the row', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { sessionId } = createSession(userId, SECRET);
    destroySession(sessionId);
    expect(db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)).toBeUndefined();
  });

  it('validateCookie returns null past the absolute lifetime cap even when not idle', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { cookieValue, sessionId } = createSession(userId, SECRET);
    // Backdate creation beyond the 90-day cap while keeping expires_at in the
    // future, so only the absolute cap (not idle) can reject it.
    const ninetyOneDays = 91 * 24 * 60 * 60 * 1000;
    db.prepare('UPDATE sessions SET created_at = ?, expires_at = ? WHERE id = ?').run(
      Date.now() - ninetyOneDays,
      Date.now() + 60_000,
      sessionId,
    );
    expect(validateCookie(cookieValue, SECRET)).toBeNull();
  });

  it('touchSession never extends expires_at past the absolute cap', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { sessionId } = createSession(userId, SECRET);
    const cap = 90 * 24 * 60 * 60 * 1000;
    const created = Date.now() - 89 * 24 * 60 * 60 * 1000; // 89 days old
    db.prepare('UPDATE sessions SET created_at = ? WHERE id = ?').run(created, sessionId);
    touchSession(sessionId); // idle slide would push ~30d out; cap clamps to created+90d
    const after = (db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(sessionId) as any)
      .expires_at;
    expect(after).toBe(created + cap);
    expect(after).toBeGreaterThan(Date.now()); // still ~1 day of life left
  });

  it('touchSession extends expires_at', () => {
    const userId = (db
      .prepare(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id`)
      .get('a@x.com', 'h', Date.now()) as { id: number }).id;
    const { sessionId } = createSession(userId, SECRET);
    const before = (db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(sessionId) as any).expires_at;
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(before - 60_000, sessionId);
    touchSession(sessionId);
    const after = (db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(sessionId) as any).expires_at;
    expect(after).toBeGreaterThan(before - 60_000);
  });
});
