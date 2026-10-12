import { describe, it, expect } from 'vitest';
import { isFromAuthenticated } from '../src/mailauth.js';

// Shapes mirror real mailauth 7 output (captured from authenticate()).
function result(o: {
  dmarc?: string;
  from?: string;
  dkim?: Array<{ d: string; res: string; aligned?: string | false }>;
  spf?: { res: string; domain: string };
}) {
  return {
    dmarc: { status: { result: o.dmarc ?? 'none', header: { from: o.from ?? 'saalr.io' } }, domain: o.from ?? 'saalr.io' },
    dkim: { results: (o.dkim ?? []).map((k) => ({ signingDomain: k.d, status: { result: k.res, aligned: k.aligned } })) },
    spf: o.spf ? { status: { result: o.spf.res }, domain: o.spf.domain } : undefined,
  };
}

describe('isFromAuthenticated (DMARC-equivalent alignment)', () => {
  it('accepts a DMARC pass', () => {
    expect(isFromAuthenticated(result({ dmarc: 'pass' }))).toBe(true);
  });

  it('accepts an aligned DKIM pass when the domain has no DMARC record', () => {
    expect(isFromAuthenticated(result({ dkim: [{ d: 'saalr.io', res: 'pass', aligned: 'saalr.io' }] }))).toBe(true);
  });

  it('accepts a DKIM pass from a subdomain (relaxed alignment)', () => {
    expect(isFromAuthenticated(result({ dkim: [{ d: 'mail.saalr.io', res: 'pass' }] }))).toBe(true);
  });

  it('accepts an aligned SPF pass when DKIM is absent', () => {
    expect(isFromAuthenticated(result({ spf: { res: 'pass', domain: 'saalr.io' } }))).toBe(true);
  });

  it('rejects a DKIM pass from an unrelated domain (e.g. a provider default signature)', () => {
    expect(
      isFromAuthenticated(
        result({ dkim: [{ d: 'saalr-io.20230601.gappssmtp.com', res: 'pass', aligned: false }], spf: { res: 'pass', domain: 'evil.example' } }),
      ),
    ).toBe(false);
  });

  it('rejects when nothing authenticates, and on an explicit DMARC fail', () => {
    expect(isFromAuthenticated(result({}))).toBe(false);
    expect(isFromAuthenticated(result({ dkim: [{ d: 'saalr.io', res: 'fail' }] }))).toBe(false);
    expect(isFromAuthenticated(result({ dmarc: 'fail', dkim: [{ d: 'saalr.io', res: 'pass', aligned: 'saalr.io' }] }))).toBe(false);
    expect(isFromAuthenticated(undefined)).toBe(false);
  });

  it('does not treat a lookalike suffix as aligned', () => {
    expect(isFromAuthenticated(result({ dkim: [{ d: 'notsaalr.io', res: 'pass' }] }))).toBe(false);
  });
});
