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

// Local parts starting with this prefix are reverse aliases minted by alias forwarding
// (see forwarding.ts). Kept as a literal here to avoid importing the mail stack.
const REVERSE_ALIAS_PREFIX = 'rv.';

export function isReserved(s: string): boolean {
  const lower = s.toLowerCase();
  return RESERVED.has(lower) || lower.startsWith(REVERSE_ALIAS_PREFIX);
}

export function isUsernameAvailable(username: string, domain: string): boolean {
  // Validate before lowercasing so 'Alice' (uppercase) is correctly rejected.
  if (!isValidUsername(username) || isReserved(username)) return false;
  // Lowercase both inputs because seedMailbox/insert normalizes to lowercase
  // (the schema doesn't COLLATE NOCASE, so case-sensitive equality is required).
  const address = `${username.toLowerCase()}@${domain.toLowerCase()}`;
  // A username must not shadow an existing alias or reverse alias either — RCPT TO
  // resolves mailboxes first, so the alias would silently stop receiving mail.
  const existing =
    db.prepare('SELECT 1 FROM mailboxes WHERE address = ?').get(address) ||
    db.prepare('SELECT 1 FROM aliases WHERE address = ?').get(address) ||
    db.prepare('SELECT 1 FROM reverse_aliases WHERE address = ?').get(address);
  return !existing;
}
