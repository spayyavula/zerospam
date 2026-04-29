import { authenticator } from 'otplib';

// Allow ±1 30-second window for clock drift. Replay protection is *not* implemented;
// the OTP step is short-lived and behind the password gate, so a one-time replay
// inside the 90-second window is acceptable for a single-owner system.
authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

export function provisioningUri(accountName: string, secret: string): string {
  return authenticator.keyuri(accountName, 'ZeroSpam', secret);
}
