import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { sign } from '../src/digest-token.js';
import { loadDigestSigningSecret } from '../src/config.js';

describe('GET /public/digest/allow', () => {
  it('renders confirm page for a valid token', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 's' });
      const t = sign(
        { v: 1, mailboxId: id, sender: 'sales@acme.com', action: 'allow-forever', exp: Date.now() + 86400000 },
        loadDigestSigningSecret(),
      );
      const r = await app.inject({ method: 'GET', url: `/public/digest/allow?t=${encodeURIComponent(t)}` });
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toMatch(/text\/html/);
      expect(r.body).toContain('sales@acme.com');
      expect(r.body.toLowerCase()).toContain('confirm');
      expect(r.body).toContain('1 quarantined message');
      expect(r.body).toContain(`<input type="hidden" name="t" value="${t}"`);
    } finally {
      await app.close();
    }
  });

  it('renders the generic expired page for a tampered token', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({ method: 'GET', url: `/public/digest/allow?t=BOGUS` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('expired or invalid');
      expect(r.body.toLowerCase()).not.toContain('confirm');
    } finally {
      await app.close();
    }
  });

  it('renders the generic expired page for a missing mailbox', async () => {
    const app = await startApi();
    try {
      const t = sign(
        { v: 1, mailboxId: 99999, sender: 's@x', action: 'allow-forever', exp: Date.now() + 60000 },
        loadDigestSigningSecret(),
      );
      const r = await app.inject({ method: 'GET', url: `/public/digest/allow?t=${encodeURIComponent(t)}` });
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('expired or invalid');
    } finally {
      await app.close();
    }
  });
});
