import { describe, it, expect } from 'vitest';
import { isValidUsername, isReserved, isUsernameAvailable } from '../src/usernames.js';
import { seedMailbox } from './helpers.js';

describe('usernames', () => {
  it('accepts plain lowercase usernames between 3 and 32 chars', () => {
    expect(isValidUsername('alice')).toBe(true);
    expect(isValidUsername('a.b-c_d')).toBe(true);
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('a'.repeat(32))).toBe(true);
  });

  it('rejects too short, too long, uppercase, and bad characters', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(33))).toBe(false);
    expect(isValidUsername('Alice')).toBe(false);
    expect(isValidUsername('alice@')).toBe(false);
    expect(isValidUsername('alice space')).toBe(false);
    expect(isValidUsername('')).toBe(false);
  });

  it('flags reserved names', () => {
    for (const r of ['admin', 'postmaster', 'webmaster', 'support', 'hostmaster', 'abuse', 'noreply', 'no-reply', 'mailer-daemon']) {
      expect(isReserved(r)).toBe(true);
    }
    expect(isReserved('alice')).toBe(false);
  });

  it('isUsernameAvailable returns true when no mailbox exists at the address', () => {
    expect(isUsernameAvailable('alice', 'zero-spam.email')).toBe(true);
  });

  it('isUsernameAvailable returns false when a mailbox already exists', () => {
    seedMailbox('alice@zero-spam.email');
    expect(isUsernameAvailable('alice', 'zero-spam.email')).toBe(false);
  });
});
