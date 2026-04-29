// SPF/DKIM/DMARC verification via mailauth.
// In dev (test injector) auth is usually inconclusive because there's no real DNS — that's fine.
// The whitelist is the source of truth; auth is only a *spoof guard* that overrides whitelist
// when DMARC explicitly fails (i.e. sender domain published DMARC and message didn't pass).

import { authenticate } from 'mailauth';

export type AuthResult = {
  spfPass: boolean | null;
  dkimPass: boolean | null;
  dmarcPass: boolean | null;
  raw?: unknown;
};

function tri(s: string | undefined): boolean | null {
  if (!s) return null;
  if (s === 'pass') return true;
  if (s === 'fail') return false;
  // 'none' (no policy published), 'neutral', 'softfail', 'temperror', 'permerror' → inconclusive
  return null;
}

export async function checkAuth(raw: Buffer, clientIp?: string): Promise<AuthResult> {
  try {
    const result: any = await authenticate(raw, {
      ip: clientIp,
      trustReceived: false,
    });
    return {
      spfPass: tri(result?.spf?.status?.result),
      dkimPass: tri(result?.dkim?.results?.[0]?.status?.result),
      dmarcPass: tri(result?.dmarc?.status?.result),
      raw: result,
    };
  } catch {
    return { spfPass: null, dkimPass: null, dmarcPass: null };
  }
}

// Block only on an explicit DMARC fail. Inconclusive (null) does not block —
// otherwise dev injection and senders without DMARC would always quarantine.
export function authBlocks(a: AuthResult): boolean {
  return a.dmarcPass === false;
}
