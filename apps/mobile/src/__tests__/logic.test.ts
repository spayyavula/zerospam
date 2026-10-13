import { buildMessageHtml, buildTextHtml, hasRemoteImages, rewriteImages } from '../lib/messageHtml';
import { expiresIn, initials, parseAddressList, shortDate, splitAddresses, tintIndex, wantInHeadline } from '../lib/format';
import { localPartProblem, usernameProblem, validateRecipients } from '../lib/validation';
import { aliasStatus } from '../features/aliases/aliasStatus';
import { light } from '../theme/tokens';

describe('message HTML', () => {
  const html = '<p>Hi</p><img src="https://track.example/p.gif?u=1&amp;m=2"><img src=\'https://cdn.example/logo.png\'>';

  it('blocks every network load by default', () => {
    const doc = buildMessageHtml(html, { colors: light });
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain('img-src data:;');
    expect(doc).toContain("script-src 'none'");
    // Original URLs stay in the markup but the CSP forbids fetching them.
    expect(doc).toContain('https://track.example/p.gif');
  });

  it('swaps image sources for signed proxy URLs and allows only that origin', () => {
    const map = {
      'https://track.example/p.gif?u=1&m=2': 'https://zero-spam.email/public/img?u=a&e=1&s=x',
      'https://cdn.example/logo.png': 'https://zero-spam.email/public/img?u=b&e=1&s=y',
    };
    const doc = buildMessageHtml(html, { colors: light, images: { map, origin: 'https://zero-spam.email' } });
    expect(doc).toContain('img-src https://zero-spam.email data:');
    expect(doc).not.toContain('track.example');
    expect(doc).not.toContain('cdn.example');
    expect(doc).toContain('src="https://zero-spam.email/public/img?u=a&amp;e=1&amp;s=x"');
  });

  it('leaves images without a signed URL untouched', () => {
    expect(rewriteImages('<img src="https://x.example/a.png">', {})).toBe('<img src="https://x.example/a.png">');
  });

  it('detects remote images', () => {
    expect(hasRemoteImages(html)).toBe(true);
    expect(hasRemoteImages('<img src="data:image/png;base64,AA">')).toBe(false);
    expect(hasRemoteImages(null)).toBe(false);
  });

  it('escapes plain text and links URLs', () => {
    const doc = buildTextHtml('a <b> & https://example.com/x?y=1', light);
    expect(doc).toContain('a &lt;b&gt; &amp; <a href="https://example.com/x?y=1">');
  });
});

describe('format', () => {
  it('parses stored address lists', () => {
    expect(parseAddressList('["a@x.com","b@y.com"]')).toEqual(['a@x.com', 'b@y.com']);
    expect(parseAddressList('a@x.com, b@y.com')).toEqual(['a@x.com', 'b@y.com']);
    expect(parseAddressList(null)).toEqual([]);
  });

  it('splits typed recipients', () => {
    expect(splitAddresses(' a@x.com;b@y.com  c@z.com,')).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
  });

  it('formats expiry', () => {
    const now = 1_000_000_000;
    expect(expiresIn(now + 30_000, now)).toBe('soon');
    expect(expiresIn(now + 5 * 60_000, now)).toBe('in 5 min');
    expect(expiresIn(now + 3 * 3_600_000, now)).toBe('in 3 hours');
    expect(expiresIn(now + 7 * 86_400_000, now)).toBe('in 7 days');
  });

  it('short dates show time today', () => {
    const now = new Date(2026, 9, 12, 15, 0).getTime();
    expect(shortDate(new Date(2026, 9, 12, 9, 41).getTime(), now)).toMatch(/9:41/);
  });

  it('initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('news@example.com')).toBe('N');
    expect(initials('Prince')).toBe('P');
  });
});

describe('validation', () => {
  it('mirrors the server username rule', () => {
    expect(usernameProblem('ab')).not.toBeNull();
    expect(usernameProblem('Abc')).not.toBeNull();
    expect(usernameProblem('.abc')).not.toBeNull();
    expect(usernameProblem('a..bc')).not.toBeNull();
    expect(usernameProblem('a.b-c_d')).toBeNull();
  });

  it('checks recipients', () => {
    expect(validateRecipients('', '', '')).toEqual({ ok: false, error: 'Add at least one recipient.' });
    expect(validateRecipients('a@x.com', 'nope', '')).toMatchObject({ ok: false });
    expect(validateRecipients('a@x.com, b@y.org', '', 'c@z.net')).toEqual({ ok: true, to: ['a@x.com', 'b@y.org'], cc: [], bcc: ['c@z.net'] });
  });
});

describe('aliases', () => {
  const base = { abused: 0, expires_at: null, mode: 'store' as const, forward_target_verified_at: null };

  it('status', () => {
    expect(aliasStatus(base).label).toBe('Active');
    expect(aliasStatus({ ...base, abused: 1 })).toMatchObject({ label: 'Off', off: true });
    expect(aliasStatus({ ...base, expires_at: 5 }, 10)).toMatchObject({ label: 'Expired', off: true });
    expect(aliasStatus({ ...base, mode: 'forward', forward_target_verified_at: 1 }).label).toBe('Forwards');
    expect(aliasStatus({ ...base, mode: 'both', forward_target_verified_at: null }).label).toBe('Not forwarding');
  });

  it('local part rule', () => {
    expect(localPartProblem('')).toBeNull();
    expect(localPartProblem('shop.2026')).toBeNull();
    expect(localPartProblem('-bad')).not.toBeNull();
    expect(localPartProblem('rv.abc')).not.toBeNull();
  });
});

describe('design helpers', () => {
  it('screener headline reads naturally', () => {
    expect(wantInHeadline(1)).toBe('One person wants in.');
    expect(wantInHeadline(3)).toBe('Three people want in.');
    expect(wantInHeadline(14)).toBe('14 people want in.');
  });
  it('avatar tint is stable per address', () => {
    expect(tintIndex('a@x.com')).toBe(tintIndex('a@x.com'));
    expect(tintIndex('a@x.com')).toBeGreaterThanOrEqual(0);
  });
});
