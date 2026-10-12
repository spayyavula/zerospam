// SPF/DKIM/DMARC verification via mailauth.
// In dev (test injector) auth is usually inconclusive because there's no real DNS — that's fine.
// The whitelist is the source of truth; auth is only a *spoof guard* that overrides whitelist
// when DMARC explicitly fails (i.e. sender domain published DMARC and message didn't pass).

import { authenticate } from 'mailauth';

export type AuthResult = {
  spfPass: boolean | null;
  dkimPass: boolean | null;
  dmarcPass: boolean | null;
  /**
   * The header-From domain is authenticated the way DMARC defines it: a passing DKIM
   * signature or SPF check whose domain aligns (relaxed) with the From domain. True even
   * when the domain publishes no DMARC record (dmarcPass is then null), which is common
   * for small/custom domains whose mail is otherwise properly signed.
   */
  fromAuthenticated: boolean;
  raw?: unknown;
};

function tri(s: string | undefined): boolean | null {
  if (!s) return null;
  if (s === 'pass') return true;
  if (s === 'fail') return false;
  // 'none' (no policy published), 'neutral', 'softfail', 'temperror', 'permerror' → inconclusive
  return null;
}

/** Relaxed DMARC alignment: same domain, or one is a subdomain of the other. */
function relaxedAligned(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/\.$/, '');
  const y = b.toLowerCase().replace(/\.$/, '');
  if (!x || !y) return false;
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

/**
 * Pure: decide from a mailauth result whether the header-From domain is authenticated
 * (DMARC pass, or an aligned DKIM/SPF pass when no DMARC policy is published).
 */
export function isFromAuthenticated(result: any): boolean {
  if (!result) return false;
  const dmarc = result.dmarc?.status?.result;
  if (dmarc === 'pass') return true;
  if (dmarc === 'fail') return false; // policy published and not met
  const fromDomain: string | undefined = result.dmarc?.domain ?? result.dmarc?.status?.header?.from;
  if (!fromDomain) return false;
  const dkimAligned = (result.dkim?.results ?? []).some(
    (r: any) =>
      r?.status?.result === 'pass' &&
      (r.status.aligned ? relaxedAligned(r.status.aligned, fromDomain) : relaxedAligned(r.signingDomain ?? '', fromDomain)),
  );
  if (dkimAligned) return true;
  return result.spf?.status?.result === 'pass' && relaxedAligned(result.spf?.domain ?? '', fromDomain);
}

/**
 * @param sender envelope MAIL FROM, when known (SMTP). Lets SPF be evaluated against
 *               the real envelope domain instead of a header guess.
 */
export async function checkAuth(raw: Buffer, clientIp?: string, sender?: string): Promise<AuthResult> {
  try {
    const result: any = await authenticate(raw, {
      ip: clientIp,
      ...(sender ? { sender } : {}),
      trustReceived: false,
    });
    return {
      spfPass: tri(result?.spf?.status?.result),
      dkimPass: tri(result?.dkim?.results?.[0]?.status?.result),
      dmarcPass: tri(result?.dmarc?.status?.result),
      fromAuthenticated: isFromAuthenticated(result),
      raw: result,
    };
  } catch {
    return { spfPass: null, dkimPass: null, dmarcPass: null, fromAuthenticated: false };
  }
}

// Block only on an explicit DMARC fail. Inconclusive (null) does not block —
// otherwise dev injection and senders without DMARC would always quarantine.
export function authBlocks(a: AuthResult): boolean {
  return a.dmarcPass === false;
}
