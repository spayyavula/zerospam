// Builds the document a message's HTML body is rendered in. The WebView runs with
// JavaScript disabled; on top of that the CSP below blocks every network load, so opening
// a message never tells the sender anything. When the reader taps "Show images", <img>
// sources are swapped for signed URLs on our own image proxy (see server image-sign.ts),
// and the CSP is widened to allow exactly that origin.

import type { Palette } from '../theme/tokens';

export type ImageMap = Record<string, string>;

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Replace remote <img src> URLs that appear in `map` (keys are &amp;-decoded URLs). */
export function rewriteImages(html: string, map: ImageMap): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(https?:\/\/[^"']+)\2/gi,
    (whole, pre: string, _q: string, url: string) => {
      const signed = map[url.replace(/&amp;/g, '&')];
      return signed ? `${pre}"${escapeAttr(signed)}"` : whole;
    },
  );
}

export function hasRemoteImages(html: string | null): boolean {
  return !!html && /<img\b[^>]*?\bsrc\s*=\s*["']https?:\/\//i.test(html);
}

export function buildMessageHtml(
  html: string,
  opts: { colors: Palette; images?: { map: ImageMap; origin: string } | null },
): string {
  const { colors, images } = opts;
  const body = images ? rewriteImages(html, images.map) : html;
  const imgSrc = images ? `${images.origin} data:` : 'data:';
  const csp = [
    "default-src 'none'",
    `img-src ${imgSrc}`,
    "style-src 'unsafe-inline'",
    "font-src 'none'",
    "script-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
  return `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; padding: 0; background: ${colors.paper}; color: ${colors.inkSoft};
    font-family: system-ui, -apple-system, Roboto, sans-serif; font-size: 16px; line-height: 1.55;
    overflow-wrap: anywhere; }
  body { padding: 16px; }
  a { color: ${colors.accent}; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  pre { white-space: pre-wrap; }
  blockquote { margin: 0 0 0 4px; padding-left: 12px; border-left: 3px solid ${colors.rule}; color: ${colors.quiet}; }
</style>
</head><body>${body}</body></html>`;
}

/** Plain text rendered as a document, so long text gets the same scroll and links. */
export function buildTextHtml(text: string, colors: Palette): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linked = escaped.replace(/\bhttps?:\/\/[^\s<>"]+/g, (u) => `<a href="${u}">${u}</a>`);
  return buildMessageHtml(`<pre style="font-family:inherit;margin:0">${linked}</pre>`, { colors });
}
