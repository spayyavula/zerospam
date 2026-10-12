import { describe, it, expect } from 'vitest';
import {
  splitMessage,
  parseHeaderBlock,
  keepHeaders,
  hasHeader,
  buildMessage,
  encodeWords,
  formatAddress,
  formatAddressList,
} from '../src/mail-headers.js';

describe('mail-headers', () => {
  it('splits headers from body and joins folded continuation lines', () => {
    const raw = Buffer.from(
      'Subject: hello\r\n  world\r\nX-A: 1\r\nContent-Type: multipart/mixed;\r\n\tboundary="b1"\r\n\r\n--b1\r\nbody\r\n',
    );
    const { fields, body } = splitMessage(raw);
    expect(fields.map((f) => f.name)).toEqual(['Subject', 'X-A', 'Content-Type']);
    expect(fields[0].value).toBe('hello\r\n  world');
    expect(fields[2].value).toBe('multipart/mixed;\r\n\tboundary="b1"');
    expect(body.toString()).toBe('--b1\r\nbody\r\n');
  });

  it('handles bare-LF messages and header-only messages', () => {
    const lf = splitMessage(Buffer.from('A: 1\nB: 2\n\nbody'));
    expect(lf.fields.map((f) => f.name)).toEqual(['A', 'B']);
    expect(lf.body.toString()).toBe('body');
    const headerOnly = splitMessage(Buffer.from('A: 1'));
    expect(headerOnly.fields).toHaveLength(1);
    expect(headerOnly.body.length).toBe(0);
  });

  it('passes the body through byte-for-byte, including 8-bit bytes', () => {
    const body = Buffer.from([0xe2, 0x82, 0xac, 0x0d, 0x0a, 0xff, 0x00]);
    const raw = Buffer.concat([Buffer.from('Subject: x\r\n\r\n'), body]);
    const { fields, body: out } = splitMessage(raw);
    expect(Buffer.compare(out, body)).toBe(0);
    const rebuilt = buildMessage(fields, out);
    expect(Buffer.compare(rebuilt, raw)).toBe(0);
  });

  it('ignores stray continuation lines and non-header lines', () => {
    const fields = parseHeaderBlock(' leading\r\nFrom someone mbox-line\r\nA: 1');
    expect(fields).toEqual([{ name: 'A', value: '1' }]);
  });

  it('filters by a case-insensitive allowlist and preserves order', () => {
    const fields = parseHeaderBlock('DKIM-Signature: v=1\r\nsubject: s\r\nReceived: x\r\nDate: d');
    const kept = keepHeaders(fields, ['Subject', 'Date']);
    expect(kept.map((f) => f.name)).toEqual(['subject', 'Date']);
    expect(hasHeader(fields, 'dkim-signature')).toBe(true);
    expect(hasHeader(kept, 'DKIM-Signature')).toBe(false);
  });

  it('quotes safe display names and escapes quotes/backslashes', () => {
    expect(formatAddress('Jane Doe', 'j@x.com')).toBe('"Jane Doe" <j@x.com>');
    expect(formatAddress('a "b" \\ c', 'j@x.com')).toBe('"a \\"b\\" \\\\ c" <j@x.com>');
    expect(formatAddress('', 'j@x.com')).toBe('j@x.com');
    expect(formatAddress(null, 'j@x.com')).toBe('j@x.com');
  });

  it('RFC 2047-encodes non-ASCII names in chunks under 75 chars', () => {
    const name = 'Zoë Ångström — '.repeat(6);
    const encoded = encodeWords(name);
    const words = encoded.split('\r\n ');
    expect(words.length).toBeGreaterThan(1);
    for (const w of words) {
      expect(w.length).toBeLessThanOrEqual(75);
      expect(w).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    }
    const decoded = words
      .map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8'))
      .join('');
    expect(decoded).toBe(name); // round-trips exactly
    expect(formatAddress('Zoë', 'z@x.com')).toBe('=?UTF-8?B?Wm/Dqw==?= <z@x.com>');
  });

  it('strips CR/LF so names and addresses cannot inject headers', () => {
    const out = formatAddress('Evil\r\nBcc: victim@x.com', 'a@x.com\r\nX: y');
    expect(out).not.toMatch(/\r|\n/);
  });

  it('folds address lists between entries', () => {
    expect(formatAddressList([{ address: 'a@x.com' }, { name: 'B', address: 'b@x.com' }])).toBe(
      'a@x.com,\r\n "B" <b@x.com>',
    );
  });
});
