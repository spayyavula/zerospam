import { db } from './db.js';

// Username policy: 3-32 chars, [a-z0-9._-]; must start AND end with an
// alphanumeric character; no consecutive separators. Mirrors common
// local-part rules and avoids RFC 5321 §4.1.2 oddities (.alice, alice., a..b).
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const HAS_BAD_SEPARATORS = /^[._-]|[._-]$|[._-]{2,}/;

// RFC 2142 standard mailboxes (postmaster, abuse, hostmaster, webmaster,
// support, info, mailer-daemon, noreply/no-reply) plus admin-flavored
// reservations (admin, root, help, security, privacy) we don't want
// users to claim. Update both groups deliberately.
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
  return USERNAME_RE.test(s) && !HAS_BAD_SEPARATORS.test(s);
}

export function isReserved(s: string): boolean {
  return RESERVED.has(s.toLowerCase());
}

export function isUsernameAvailable(username: string, domain: string): boolean {
  // Validate before lowercasing so 'Alice' (uppercase) is correctly rejected.
  if (!isValidUsername(username) || isReserved(username)) return false;
  // Lowercase both inputs because seedMailbox/insert normalizes to lowercase
  // (the schema doesn't COLLATE NOCASE, so case-sensitive equality is required).
  const address = `${username.toLowerCase()}@${domain.toLowerCase()}`;
  const existing = db.prepare('SELECT 1 FROM mailboxes WHERE address = ?').get(address);
  return !existing;
}
