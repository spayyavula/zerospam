import { describe, it, expect } from 'vitest';
import { renderHtml, renderText, type DigestContent } from '../src/digest-template.js';

const BASE = 'https://mail.example.com';

function content(over: Partial<DigestContent> = {}): DigestContent {
  return {
    mailboxId: 1,
    mailboxAddress: 'alice@example.com',
    rows: [
      {
        fromAddress: 'sales@acme.com',
        fromName: 'Acme Sales',
        messageCount: 3,
        latestSubject: 'Q2 promo',
        latestReceivedAt: Date.parse('2026-04-29T14:32:00Z'),
        allowToken: 'TOKEN-ACME',
      },
    ],
    totalSendersInQuarantine: 1,
    windowStart: 0,
    ...over,
  };
}

describe('digest-template', () => {
  it('html includes mailbox address and sender details', () => {
    const html = renderHtml(content(), BASE);
    expect(html).toContain('alice@example.com');
    expect(html).toContain('sales@acme.com');
    expect(html).toContain('Acme Sales');
    expect(html).toContain('3 message');
    expect(html).toContain('Q2 promo');
  });

  it('html action button is a styled anchor with the action URL', () => {
    const html = renderHtml(content(), BASE);
    expect(html).toContain(`href="${BASE}/public/digest/allow?t=TOKEN-ACME"`);
    expect(html.toLowerCase()).toContain('allow forever');
  });

  it('html escapes special characters in subject, name, address', () => {
    const html = renderHtml(
      content({
        rows: [
          {
            fromAddress: 'x"y<z>@evil.com',
            fromName: '<script>alert(1)</script>',
            messageCount: 1,
            latestSubject: 'A & B "C"',
            latestReceivedAt: Date.now(),
            allowToken: 'T',
          },
        ],
      }),
      BASE,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B &quot;C&quot;');
    expect(html).toContain('x&quot;y&lt;z&gt;@evil.com');
  });

  it('html shows "+N more" footer when total exceeds rows', () => {
    const html = renderHtml(content({ totalSendersInQuarantine: 35 }), BASE);
    expect(html).toContain('+34 more');
  });

  it('html omits "+N more" footer when total equals rows', () => {
    const html = renderHtml(content({ totalSendersInQuarantine: 1 }), BASE);
    expect(html).not.toMatch(/\+\d+ more/);
  });

  it('text alternative covers the same data', () => {
    const text = renderText(content(), BASE);
    expect(text).toContain('alice@example.com');
    expect(text).toContain('sales@acme.com');
    expect(text).toContain('3 message');
    expect(text).toContain('Q2 promo');
    expect(text).toContain(`${BASE}/public/digest/allow?t=TOKEN-ACME`);
  });

  it('text shows "+N more" footer when applicable', () => {
    const text = renderText(content({ totalSendersInQuarantine: 35 }), BASE);
    expect(text).toContain('+34 more');
  });
});
