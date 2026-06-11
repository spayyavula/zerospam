// HMAC-signed, time-boxed state token binding an OAuth round-trip to a session.
// Format: <base64url(JSON)>.<base64url(HMAC-SHA256)>

import { createHmac, timingSafeEqual } from 'node:crypto';

export type OAuthStatePayload = {
  v: 1;
  userId: number;
  accountId: number;
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
  if (b64urlEncode(buf) !== s) return null;
  return buf;
}

function mac(secret: string, payloadBuf: Buffer): Buffer {
  return createHmac('sha256', secret).update(payloadBuf).digest();
}

export function signState(payload: OAuthStatePayload, secret: string): string {
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  return `${b64urlEncode(payloadBuf)}.${b64urlEncode(mac(secret, payloadBuf))}`;
}

export function verifyState(token: string, secret: string, now: number): OAuthStatePayload | null {
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
    !parsed || typeof parsed !== 'object' ||
    (parsed as OAuthStatePayload).v !== 1 ||
    typeof (parsed as OAuthStatePayload).userId !== 'number' ||
    typeof (parsed as OAuthStatePayload).accountId !== 'number' ||
    typeof (parsed as OAuthStatePayload).exp !== 'number'
  ) {
    return null;
  }
  const p = parsed as OAuthStatePayload;
  if (p.exp < now) return null;
  return p;
}
