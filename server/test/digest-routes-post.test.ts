import { describe, it, expect } from 'vitest';
import { startApi } from '../src/api.js';
import { seedMailbox, injectQuarantined } from './helpers.js';
import { sign } from '../src/digest-token.js';
import { loadDigestSigningSecret } from '../src/config.js';
import { db } from '../src/db.js';

async function postForm(app: Awaited<ReturnType<typeof startApi>>, t: string) {
  return app.inject({
    method: 'POST',
    url: '/public/digest/allow',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: `t=${encodeURIComponent(t)}`,
  });
}

describe('POST /public/digest/allow', () => {
  it('whitelists the sender and moves their quarantined messages to inbox', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      const m1 = await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'a' });
      const m2 = await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'b' });
      const t = sign(
        { v: 1, mailboxId: id, sender: 'sales@acme.com', action: 'allow-forever', exp: Date.now() + 86400000 },
        loadDigestSigningSecret(),
      );

      const r = await postForm(app, t);
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('trusted');
      expect(r.body).toContain('2 message');

      const folders = db
        .prepare('SELECT id, folder FROM messages WHERE id IN (?, ?)')
        .all(m1, m2) as { id: string; folder: string }[];
      expect(folders.every((x) => x.folder === 'inbox')).toBe(true);

      const rule = db
        .prepare(
          "SELECT pattern, note FROM whitelist_rules WHERE mailbox_id = ? AND kind = 'address' AND pattern = ?",
        )
        .get(id, 'sales@acme.com') as { pattern: string; note: string } | undefined;
      expect(rule?.note).toBe('digest:allow-forever');
    } finally {
      await app.close();
    }
  });

  it('is idempotent: clicking twice does not duplicate the rule and reports 0 moved', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      await injectQuarantined({ to: 'alice@example.com', from: 'sales@acme.com', subject: 'a' });
      const t = sign(
        { v: 1, mailboxId: id, sender: 'sales@acme.com', action: 'allow-forever', exp: Date.now() + 86400000 },
        loadDigestSigningSecret(),
      );
      await postForm(app, t);
      const r2 = await postForm(app, t);
      expect(r2.statusCode).toBe(200);
      expect(r2.body.toLowerCase()).toContain('already trusted');
      expect(r2.body).toContain('0 message');

      const rules = db
        .prepare(
          "SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = 'address' AND pattern = ?",
        )
        .all(id, 'sales@acme.com');
      expect(rules).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('renders expired page for invalid token, makes no DB changes', async () => {
    const app = await startApi();
    try {
      const id = seedMailbox('alice@example.com');
      const r = await postForm(app, 'not-a-real-token');
      expect(r.statusCode).toBe(200);
      expect(r.body.toLowerCase()).toContain('expired or invalid');
      const rules = db.prepare('SELECT id FROM whitelist_rules WHERE mailbox_id = ?').all(id);
      expect(rules).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('returns 400 if body is missing the token', async () => {
    const app = await startApi();
    try {
      const r = await app.inject({
        method: 'POST',
        url: '/public/digest/allow',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: '',
      });
      expect(r.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
