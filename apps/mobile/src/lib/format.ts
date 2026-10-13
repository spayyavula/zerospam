// Pure formatting helpers (unit-tested in __tests__/format.test.ts).

/** "9:41", "Tue", "Mar 4", or "Mar 4, 2024" depending on age. */
export function shortDate(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const sixDays = 6 * 24 * 60 * 60 * 1000;
  if (now - ts < sixDays && now >= ts) return d.toLocaleDateString([], { weekday: 'short' });
  if (d.getFullYear() === n.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function longDate(ts: number): string {
  return new Date(ts).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "in 3 days", "in 5 hours", "in 12 min", "soon". */
export function expiresIn(ts: number, now = Date.now()): string {
  const ms = ts - now;
  if (ms <= 60_000) return 'soon';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} hour${h === 1 ? '' : 's'}`;
  const days = Math.round(h / 24);
  return `in ${days} days`;
}

export function senderLabel(m: { from_name: string | null; from_address: string }): string {
  return m.from_name?.trim() || m.from_address;
}

/** Address lists are stored as JSON arrays; tolerate plain comma-separated text too. */
export function parseAddressList(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // fall through
  }
  return splitAddresses(v);
}

/** Split user-typed recipients on commas, semicolons, or whitespace. */
export function splitAddresses(input: string): string[] {
  return input
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Initials for an avatar: "Ada Lovelace" → "AL", "news@x.com" → "N". */
export function initials(label: string): string {
  const words = label.replace(/[<>"@].*$/, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return label.charAt(0).toUpperCase() || '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

const NUMBER_WORDS = ['No one', 'One person', 'Two people', 'Three people', 'Four people', 'Five people', 'Six people', 'Seven people', 'Eight people', 'Nine people'];

/** Screener headline: "Three people want in." */
export function wantInHeadline(n: number): string {
  return `${NUMBER_WORDS[n] ?? `${n} people`} ${n === 1 ? 'wants' : 'want'} in.`;
}

/** Stable bucket for a string, used to pick a sender's avatar tint. */
export function tintIndex(key: string, buckets = 6): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % buckets;
}
