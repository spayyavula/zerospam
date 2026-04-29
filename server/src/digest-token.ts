// HMAC-signed token for digest action URLs.
// Format: <base64url(JSON payload)>.<base64url(HMAC-SHA256(secret, payload))>
// No JWT to avoid alg-confusion footguns.

import { createHmac, timingSafeEqual } from 'node:crypto';

export type DigestTokenPayload = {
  v: 1;
  mailboxId: number;
  sender: string;
  action: 'allow-forever';
  exp: number;
};

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
}

function mac(secret: string, payloadBuf: Buffer): Buffer {
  return createHmac('sha256', secret).update(payloadBuf).digest();
}

export function sign(payload: DigestTokenPayload, secret: string): string {
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = mac(secret, payloadBuf);
  return `${b64urlEncode(payloadBuf)}.${b64urlEncode(sig)}`;
}

export function verify(token: string, secret: string, now: number): DigestTokenPayload | null {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  const payloadBuf = b64urlDecode(payloadPart);
  const sigBuf = b64urlDecode(sigPart);
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
    (parsed as DigestTokenPayload).v !== 1 ||
    typeof (parsed as DigestTokenPayload).mailboxId !== 'number' ||
    typeof (parsed as DigestTokenPayload).sender !== 'string' ||
    (parsed as DigestTokenPayload).action !== 'allow-forever' ||
    typeof (parsed as DigestTokenPayload).exp !== 'number'
  ) {
    return null;
  }

  const p = parsed as DigestTokenPayload;
  if (p.exp < now) return null;
  return p;
}
