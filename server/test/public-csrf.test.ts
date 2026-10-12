import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';

const sent = (): any[] => (globalThis as any).__sentMail;

async function setup() {
  const app = await startApi();
  const { userId, accountId } = await seedOwner();
  const mailboxId = seedMailbox('owner@zero-spam.email');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(accountId, mailboxId);
  const cookie = makeSessionCookie(userId);
  return { app, cookie, mailboxId };
}

function lastToken(): string {
  const m = sent()[sent().length - 1].text.match(/verify\?t=([A-Za-z0-9_%-]+)/);
  return decodeURIComponent(m[1]);
}

describe('CSRF origin guard vs token-authenticated public routes', () => {
  // Reproduces production: the confirm page is served with Referrer-Policy: no-referrer,
  // so the browser submits the form with Origin: null while the user is logged in.
  it('lets a logged-in browser confirm a forwarding address (Origin: null)', async () => {
    const { app, cookie } = await setup();
    try {
      await app.inject({ method: 'POST', url: '/api/forward-targets', headers: { cookie }, payload: { email: 'me@saalr.io' } });
      const t = lastToken();
      const r = await app.inject({
        method: 'POST',
        url: '/public/forward/verify',
        headers: { cookie, origin: 'null', 'content-type': 'application/x-www-form-urlencoded' },
        payload: `t=${encodeURIComponent(t)}`,
      });
      expect(r.statusCode).toBe(200);
      expect(r.body).toContain('Forwarding address confirmed');
    } finally {
      await app.close();
    }
  });

  it('still blocks cross-site POSTs to cookie-authenticated API routes', async () => {
    const { app, cookie, mailboxId } = await setup();
    try {
      for (const origin of ['null', 'https://evil.example']) {
        const r = await app.inject({
          method: 'POST',
          url: '/api/aliases',
          headers: { cookie, origin },
          payload: { mailboxId },
        });
        expect(r.statusCode).toBe(403);
        expect(r.json()).toEqual({ error: 'csrf-origin-rejected' });
      }
    } finally {
      await app.close();
    }
  });
});
