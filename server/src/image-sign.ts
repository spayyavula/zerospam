// Signed, short-lived URLs for the remote-image proxy.
//
// The web app loads proxied images with the session cookie. The mobile app renders mail
// in a WebView, which cannot attach the device's Bearer token to <img> requests, so the
// app asks the API for pre-signed proxy URLs instead. The signature binds the original
// image URL and an expiry; it grants nothing except "the server may fetch this one image".

import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

export const IMAGE_URL_TTL_MS = 60 * 60 * 1000;
const MAX_IMAGES_PER_MESSAGE = 200;

// Domain-separated key derived from the session secret, so a signature here can never be
// replayed as any other kind of token.
function key(): Buffer {
  return createHmac('sha256', config.sessionSecret).update('zerospam:image-proxy:v1').digest();
}

function mac(url: string, exp: number): string {
  return createHmac('sha256', key()).update(`${exp}|${url}`).digest('base64url');
}

export function signImageUrl(url: string, now = Date.now(), baseUrl = config.publicBaseUrl): string {
  const exp = now + IMAGE_URL_TTL_MS;
  const qs = new URLSearchParams({ u: url, e: String(exp), s: mac(url, exp) });
  return `${(baseUrl ?? '').replace(/\/$/, '')}/public/img?${qs.toString()}`;
}

export function verifyImageSignature(url: string, exp: string, sig: string, now = Date.now()): boolean {
  if (!/^\d{1,16}$/.test(exp)) return false;
  const expMs = Number(exp);
  if (expMs < now) return false;
  const expected = Buffer.from(mac(url, expMs));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Remote (http/https) image URLs referenced by <img src> in an HTML body, de-duplicated. */
export function extractRemoteImageUrls(html: string | null): string[] {
  if (!html) return [];
  const out = new Set<string>();
  const re = /<img\b[^>]*?\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.size < MAX_IMAGES_PER_MESSAGE) {
    // HTML-encoded ampersands are the norm inside attributes; the browser decodes them
    // before requesting, so sign the decoded form.
    out.add(m[1].replace(/&amp;/g, '&'));
  }
  return [...out];
}
