import { db } from './db.js';

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

const RESERVED: ReadonlySet<string> = new Set([
  'admin',
  'postmaster',
  'webmaster',
  'support',
  'hostmaster',
  'abuse',
  'noreply',
  'no-reply',
  'mailer-daemon',
  'root',
  'info',
  'help',
  'security',
  'privacy',
]);

export function isValidUsername(s: string): boolean {
  return USERNAME_RE.test(s);
}

export function isReserved(s: string): boolean {
  return RESERVED.has(s.toLowerCase());
}

export function isUsernameAvailable(username: string, domain: string): boolean {
  const address = `${username.toLowerCase()}@${domain.toLowerCase()}`;
  const r = db.prepare('SELECT 1 FROM mailboxes WHERE address = ?').get(address);
  return !r;
}
