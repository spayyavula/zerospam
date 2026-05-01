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

  it('rejects leading, trailing, and consecutive separators', () => {
    // leading separators
    expect(isValidUsername('.alice')).toBe(false);
    expect(isValidUsername('-alice')).toBe(false);
    expect(isValidUsername('_alice')).toBe(false);
    // trailing separators
    expect(isValidUsername('alice.')).toBe(false);
    expect(isValidUsername('alice-')).toBe(false);
    expect(isValidUsername('alice_')).toBe(false);
    // consecutive separators
    expect(isValidUsername('a..b')).toBe(false);
    expect(isValidUsername('a--b')).toBe(false);
    expect(isValidUsername('a__b')).toBe(false);
  });

  it('flags reserved names', () => {
    for (const r of ['admin', 'postmaster', 'webmaster', 'support', 'hostmaster', 'abuse', 'noreply', 'no-reply', 'mailer-daemon']) {
      expect(isReserved(r)).toBe(true);
    }
    expect(isReserved('alice')).toBe(false);
    expect(isReserved('Postmaster')).toBe(true);
    expect(isReserved('ADMIN')).toBe(true);
    expect(isReserved('Mailer-Daemon')).toBe(true);
  });

  it('isUsernameAvailable returns true when no mailbox exists at the address', () => {
    expect(isUsernameAvailable('alice', 'zero-spam.email')).toBe(true);
  });

  it('isUsernameAvailable returns false when a mailbox already exists', () => {
    seedMailbox('alice@zero-spam.email');
    expect(isUsernameAvailable('alice', 'zero-spam.email')).toBe(false);
  });

  it('isUsernameAvailable rejects invalid usernames', () => {
    expect(isUsernameAvailable('ab', 'zero-spam.email')).toBe(false);
    expect(isUsernameAvailable('Alice', 'zero-spam.email')).toBe(false);
    expect(isUsernameAvailable('alice space', 'zero-spam.email')).toBe(false);
    expect(isUsernameAvailable('.alice', 'zero-spam.email')).toBe(false);
  });

  it('isUsernameAvailable rejects reserved usernames', () => {
    expect(isUsernameAvailable('admin', 'zero-spam.email')).toBe(false);
    expect(isUsernameAvailable('postmaster', 'zero-spam.email')).toBe(false);
  });
});
