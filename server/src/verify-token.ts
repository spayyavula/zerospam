import { createHmac, timingSafeEqual } from 'node:crypto';

export type VerifyTokenPayload = {
  v: 1;
  userId: number;
  exp: number;
};

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  let buf: Buffer;
  try {
    buf = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
  // Reject non-canonical encodings: the unused low bits of a base64url segment's
  // final character are ignored on decode, so flipping it to an "equivalent" char
  // yields identical bytes and a single-char tamper would slip past the HMAC check.
  // Requiring round-trip equality closes that gap.
  if (b64urlEncode(buf) !== s) return null;
  return buf;
}

function mac(secret: string, payloadBuf: Buffer): Buffer {
  return createHmac('sha256', secret).update(payloadBuf).digest();
}

export function signVerifyToken(payload: VerifyTokenPayload, secret: string): string {
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = mac(secret, payloadBuf);
  return `${b64urlEncode(payloadBuf)}.${b64urlEncode(sig)}`;
}

export function verifyVerifyToken(token: string, secret: string, now: number): VerifyTokenPayload | null {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  const payloadBuf = b64urlDecode(token.slice(0, dot));
  const sigBuf = b64urlDecode(token.slice(dot + 1));
  if (!payloadBuf || !sigBuf) return null;

  const expected = mac(secret, payloadBuf);
  if (sigBuf.length !== expected.length) return null;
  if (!timingSafeEqual(sigBuf, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBuf.toString('utf8'));
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as VerifyTokenPayload).v !== 1 ||
    typeof (parsed as VerifyTokenPayload).userId !== 'number' ||
    typeof (parsed as VerifyTokenPayload).exp !== 'number'
  ) {
    return null;
  }
  const p = parsed as VerifyTokenPayload;
  if (p.exp < now) return null;
  return p;
}
