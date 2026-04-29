// Detects display-name spoofing — a real "Outlook killer with zero spam" feature.
// Two heuristics:
//   1. Display name embeds a different email address than the actual From.
//   2. Display name claims a known brand whose domain doesn't appear in the actual From.
// Returns a human-readable reason string when suspicious, else null.

const BRANDS = [
  'paypal',
  'apple',
  'amazon',
  'google',
  'microsoft',
  'netflix',
  'github',
  'stripe',
  'dhl',
  'fedex',
  'usps',
  'ups',
  'bank',
  'irs',
  'docusign',
  'dropbox',
  'meta',
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'x.com',
  'whatsapp',
  'venmo',
  'zelle',
  'coinbase',
];

export function senderRisk(
  fromName: string | null | undefined,
  fromAddress: string,
): string | null {
  if (!fromName) return null;
  const domain = fromAddress.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return null;

  // 1) embedded email in display name
  const m = fromName.match(/[\w.+-]+@([\w.-]+\.[a-z]{2,})/i);
  if (m) {
    const claimed = m[1].toLowerCase();
    if (claimed !== domain && !domain.endsWith('.' + claimed) && !claimed.endsWith('.' + domain)) {
      return `display name shows ${claimed} but actually sent from ${domain}`;
    }
  }

  // 2) brand claim mismatch
  const lowerName = fromName.toLowerCase();
  for (const b of BRANDS) {
    if (lowerName.includes(b) && !domain.includes(b)) {
      return `claims to be "${b}" but domain is ${domain}`;
    }
  }

  return null;
}
