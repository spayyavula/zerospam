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
