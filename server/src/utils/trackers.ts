// Tracking-pixel detection + classification.
// Two complementary heuristics scan the message HTML and produce a structured
// report of likely trackers:
//   1. <img> tags with width=1 / height=1 / 1px style (the classic invisible pixel).
//   2. Image URLs that match patterns from common email-tracking services.
// The reading pane shows a per-message dossier ("which provider, what they'd learn")
// — actual blocking happens at render time via the iframe CSP.

export type TrackerHit = {
  url: string;
  provider: string;
  learns: string[];
  invisible: boolean;
};

export type TrackerReport = {
  count: number;
  hits: TrackerHit[];
};

const PROVIDERS: Array<{ re: RegExp; name: string; learns: string[] }> = [
  {
    re: /(^|\.)mailgun\.[a-z]+\/?o\//i,
    name: 'Mailgun',
    learns: ['open', 'click', 'IP', 'user-agent'],
  },
  {
    re: /list-manage\.com|mailchimp\.com.*track|mc\.us\d+\.list-manage\.com/i,
    name: 'Mailchimp',
    learns: ['open', 'click', 'IP', 'user-agent', 'geolocation'],
  },
  {
    re: /sendgrid\.net.*\/(wf|open|click)|sg\.email\/wf\//i,
    name: 'SendGrid',
    learns: ['open', 'click', 'IP', 'user-agent', 'geolocation'],
  },
  {
    re: /hubspotemail\.net|hubspot\.com.*\/_hcms\//i,
    name: 'HubSpot',
    learns: ['open', 'click', 'IP', 'user-agent'],
  },
  {
    re: /doubleclick\.net/i,
    name: 'Google DoubleClick',
    learns: ['open', 'IP', 'cross-site profile'],
  },
  {
    re: /branch\.io\/.+\/email/i,
    name: 'Branch.io',
    learns: ['open', 'IP'],
  },
  {
    re: /campaign-monitor\.com|cmail\d+\.com/i,
    name: 'Campaign Monitor',
    learns: ['open', 'click', 'IP', 'user-agent'],
  },
  {
    re: /klclick\.com|klaviyo\.com/i,
    name: 'Klaviyo',
    learns: ['open', 'click', 'IP', 'user-agent'],
  },
  {
    re: /click\.[a-z0-9.-]+\/.+\/o\//i,
    name: 'Generic ESP click tracker',
    learns: ['open', 'click', 'IP'],
  },
];

const GENERIC_PIXEL_PATTERNS: RegExp[] = [
  /\/(open|track|pixel|beacon)(\?|\/|\.gif|\.png|\.jpg|$)/i,
  /\bet_open\b/i,
  /\bmc_eid\b/i,
];

const IMG_TAG_RE = /<img\b[^>]*>/gi;

function isTinyImg(tag: string): boolean {
  if (/\b(width|height)\s*=\s*["']?\s*1\s*(px)?\s*["']?/i.test(tag)) return true;
  if (/style\s*=\s*["'][^"']*\b(width|height)\s*:\s*1\s*px\b/i.test(tag)) return true;
  return false;
}

function srcOf(tag: string): string | null {
  const m = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function classify(url: string): { provider: string; learns: string[] } | null {
  for (const p of PROVIDERS) {
    if (p.re.test(url)) return { provider: p.name, learns: p.learns };
  }
  if (GENERIC_PIXEL_PATTERNS.some((re) => re.test(url))) {
    return { provider: 'Unknown tracker', learns: ['open', 'IP', 'user-agent'] };
  }
  return null;
}

export function scanTrackers(html: string | null | undefined): TrackerReport {
  if (!html) return { count: 0, hits: [] };
  const tags = html.match(IMG_TAG_RE) ?? [];
  const hits: TrackerHit[] = [];

  for (const tag of tags) {
    const src = srcOf(tag);
    if (!src || src.startsWith('data:') || src.startsWith('cid:')) continue;
    const tiny = isTinyImg(tag);
    const cls = classify(src);
    if (tiny || cls) {
      hits.push({
        url: src,
        provider: cls?.provider ?? 'Invisible 1×1 pixel',
        learns: cls?.learns ?? ['open', 'IP', 'user-agent'],
        invisible: tiny,
      });
    }
  }

  return { count: hits.length, hits };
}

// Back-compat helper for callers that only want the count.
export function countTrackers(html: string | null | undefined): number {
  return scanTrackers(html).count;
}
