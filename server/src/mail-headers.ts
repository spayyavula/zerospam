// Pure RFC 5322 header-block helpers used by alias forwarding and reverse-alias replies.
//
// Forwarding rewrites a message's *headers* (From, Reply-To, To, Cc, …) but passes the
// body through byte-for-byte so MIME structure, attachments and transfer encodings are
// untouched. Headers are handled as latin1 ("binary") strings so any raw 8-bit bytes in
// the kept headers round-trip unchanged.

export type HeaderField = {
  /** Header name as it appeared, e.g. "Content-Type". */
  name: string;
  /** Everything after the colon, including folded continuation lines (CRLF-normalized). */
  value: string;
};

export type SplitMessage = {
  fields: HeaderField[];
  body: Buffer;
};

/** Split a raw message into parsed header fields and the untouched body bytes. */
export function splitMessage(raw: Buffer): SplitMessage {
  const crlf = raw.indexOf('\r\n\r\n');
  const lf = raw.indexOf('\n\n');
  let headerEnd: number;
  let bodyStart: number;
  if (crlf !== -1 && (lf === -1 || crlf <= lf)) {
    headerEnd = crlf;
    bodyStart = crlf + 4;
  } else if (lf !== -1) {
    headerEnd = lf;
    bodyStart = lf + 2;
  } else {
    // Header-only message.
    headerEnd = raw.length;
    bodyStart = raw.length;
  }
  const headerText = raw.subarray(0, headerEnd).toString('latin1');
  return { fields: parseHeaderBlock(headerText), body: raw.subarray(bodyStart) };
}

/** Parse a header block into fields, joining folded continuation lines. */
export function parseHeaderBlock(block: string): HeaderField[] {
  const lines = block.split(/\r?\n/);
  const fields: HeaderField[] = [];
  for (const line of lines) {
    if (line === '') continue;
    if (/^[ \t]/.test(line)) {
      // Continuation of the previous field. Ignore stray continuations before any field.
      const last = fields[fields.length - 1];
      if (last) last.value += '\r\n' + line;
      continue;
    }
    const colon = line.indexOf(':');
    if (colon <= 0) continue; // not a header line (e.g. mbox "From " separator) — drop it
    fields.push({ name: line.slice(0, colon).trim(), value: line.slice(colon + 1).replace(/^[ \t]/, '') });
  }
  return fields;
}

/** Keep only fields whose name (case-insensitive) is in `allow`, preserving order. */
export function keepHeaders(fields: HeaderField[], allow: readonly string[]): HeaderField[] {
  const set = new Set(allow.map((n) => n.toLowerCase()));
  return fields.filter((f) => set.has(f.name.toLowerCase()));
}

export function hasHeader(fields: HeaderField[], name: string): boolean {
  const n = name.toLowerCase();
  return fields.some((f) => f.name.toLowerCase() === n);
}

/** Serialize fields + body back into a raw message with CRLF line endings. */
export function buildMessage(fields: HeaderField[], body: Buffer): Buffer {
  const head = fields.map((f) => `${f.name}: ${f.value}`).join('\r\n');
  return Buffer.concat([Buffer.from(head + '\r\n\r\n', 'latin1'), body]);
}

// ---- address formatting ----

// Printable ASCII (quotes/backslashes get escaped): a display name made only of these can be emitted as a
// quoted-string without escaping surprises. Anything else gets RFC 2047 encoding.
const SAFE_DISPLAY = /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~ .,:;@()[\]"\\]*$/;

/**
 * RFC 2047 encode a display name as one or more UTF-8 "B" encoded-words, each kept under
 * the 75-char encoded-word limit and split only on code-point boundaries.
 */
export function encodeWords(text: string): string {
  const MAX_BYTES = 45; // 45 bytes → 60 base64 chars + 12 overhead = 72 ≤ 75
  const words: string[] = [];
  let chunk = '';
  for (const ch of text) {
    if (Buffer.byteLength(chunk + ch, 'utf8') > MAX_BYTES) {
      words.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join('\r\n ');
}

/** Format `name <address>` with safe quoting/encoding. Strips CR/LF to prevent header injection. */
export function formatAddress(name: string | null | undefined, address: string): string {
  const addr = address.replace(/[\r\n<>]/g, '');
  const clean = (name ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!clean) return addr;
  if (SAFE_DISPLAY.test(clean)) {
    return `"${clean.replace(/(["\\])/g, '\\$1')}" <${addr}>`;
  }
  return `${encodeWords(clean)} <${addr}>`;
}

/** Join formatted addresses into one header value, folding between entries. */
export function formatAddressList(entries: Array<{ name?: string | null; address: string }>): string {
  return entries.map((e) => formatAddress(e.name, e.address)).join(',\r\n ');
}
