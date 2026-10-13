import { isEmail, splitAddresses } from './format';

/** Same rule as the server (usernames.ts): 3–32 of a-z 0-9 . _ -, no separator at the ends or doubled. */
export function usernameProblem(u: string): string | null {
  if (u.length < 3 || u.length > 32) return 'Use 3 to 32 characters.';
  if (!/^[a-z0-9._-]+$/.test(u)) return 'Use lowercase letters, numbers, and . _ - only.';
  if (/^[._-]|[._-]$/.test(u)) return 'Can’t start or end with . _ or -';
  if (/[._-]{2}/.test(u)) return 'Can’t have two of . _ - in a row.';
  return null;
}

export function validateRecipients(to: string, cc: string, bcc: string): { ok: true; to: string[]; cc: string[]; bcc: string[] } | { ok: false; error: string } {
  const lists = { to: splitAddresses(to), cc: splitAddresses(cc), bcc: splitAddresses(bcc) };
  if (lists.to.length === 0) return { ok: false, error: 'Add at least one recipient.' };
  const bad = [...lists.to, ...lists.cc, ...lists.bcc].find((a) => !isEmail(a));
  if (bad) return { ok: false, error: `“${bad}” isn’t a valid email address.` };
  return { ok: true, ...lists };
}

/** Same rule as POST /api/aliases `localPart`. Empty means "pick a random one". */
export function localPartProblem(s: string): string | null {
  if (!s) return null;
  if (!/^[a-z0-9][a-z0-9._-]{0,40}$/i.test(s)) return 'Start with a letter or number; then letters, numbers, . _ - (up to 41).';
  if (s.toLowerCase().startsWith('rv.')) return 'Aliases can’t start with “rv.”';
  return null;
}
