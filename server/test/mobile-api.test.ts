import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { ingest } from '../src/ingest.js';
import { seedMailbox } from './helpers.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { signImageUrl, verifyImageSignature, extractRemoteImageUrls, IMAGE_URL_TTL_MS } from '../src/image-sign.js';

async function setup() {
  const app = await startApi();
  const { userId, accountId } = await seedOwner({ email: 'owner@example.com' });
  const mailboxId = seedMailbox('owner@zero-spam.email');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(accountId, mailboxId);
  return { app, userId, accountId, mailboxId };
}

function addDevice(userId: number): { id: number; token: string } {
  const token = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db
    .prepare(
      `INSERT INTO devices (user_id, name, token_hash, platform, created_at, last_seen_at)
       VALUES (?, 'Pixel', ?, 'android', ?, ?) RETURNING id`,
    )
    .get(userId, hash, Date.now(), Date.now()) as { id: number };
  return { id: row.id, token };
}

async function ingestHtml(to: string, html: string): Promise<string> {
  const raw = Buffer.from(
    [
      'From: news@sender.example',
      `To: ${to}`,
      'Subject: hello',
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@test.local>`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n'),
  );
  const r = await ingest(raw, to);
  if (!r?.messageId) throw new Error('nothing stored');
  return r.messageId;
}

describe('device auth precedence', () => {
  it('prefers the Bearer token over a cookie, so the device can revoke itself', async () => {
    const { app, userId } = await setup();
    try {
      const dev = addDevice(userId);
      const cookie = makeSessionCookie(userId);
      const r = await app.inject({
        method: 'DELETE',
        url: '/api/auth/devices/me',
        headers: { cookie, authorization: `Bearer ${dev.token}` },
      });
      expect(r.statusCode).toBe(200);
      const row = db.prepare('SELECT revoked_at FROM devices WHERE id = ?').get(dev.id) as { revoked_at: number | null };
      expect(row.revoked_at).not.toBeNull();
    } finally {
      await app.close();
    }
  });

  it('falls back to the cookie when the Bearer token is unknown', async () => {
    const { app, userId } = await setup();
    try {
      const r = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: makeSessionCookie(userId), authorization: 'Bearer nope' },
      });
      expect(r.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

describe('signed image URLs', () => {
  it('round-trips and rejects tampering or expiry', () => {
    const now = 1_000_000;
    const signed = new URL(signImageUrl('https://img.example/a.png?x=1&y=2', now, 'https://zero-spam.email'));
    expect(signed.origin + signed.pathname).toBe('https://zero-spam.email/public/img');
    const u = signed.searchParams.get('u')!;
    const e = signed.searchParams.get('e')!;
    const s = signed.searchParams.get('s')!;
    expect(u).toBe('https://img.example/a.png?x=1&y=2');
    expect(verifyImageSignature(u, e, s, now)).toBe(true);
    expect(verifyImageSignature('https://evil.example/', e, s, now)).toBe(false);
    expect(verifyImageSignature(u, String(Number(e) + 1), s, now)).toBe(false);
    expect(verifyImageSignature(u, e, s, now + IMAGE_URL_TTL_MS + 1)).toBe(false);
    expect(verifyImageSignature(u, 'abc', s, now)).toBe(false);
  });

  it('extracts remote <img> URLs, decoding &amp; and skipping data: and cid:', () => {
    const urls = extractRemoteImageUrls(
      `<img src="https://a.example/1.png?a=1&amp;b=2"><img alt=x src='http://b.example/2.gif'>
       <img src="data:image/png;base64,AAAA"><img src="cid:logo"><img src="https://a.example/1.png?a=1&amp;b=2">`,
    );
    expect(urls).toEqual(['https://a.example/1.png?a=1&b=2', 'http://b.example/2.gif']);
  });

  it('issues signed URLs only for the caller\'s own messages', async () => {
    const { app, userId, mailboxId } = await setup();
    try {
      const id = await ingestHtml('owner@zero-spam.email', '<p>hi</p><img src="https://img.example/p.png">');
      expect(mailboxId).toBeGreaterThan(0);
      const dev = addDevice(userId);
      const r = await app.inject({
        method: 'POST',
        url: `/api/messages/${id}/remote-images`,
        headers: { authorization: `Bearer ${dev.token}` },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { map: Record<string, string>; expiresInSec: number };
      expect(Object.keys(body.map)).toEqual(['https://img.example/p.png']);
      expect(body.map['https://img.example/p.png']).toContain('/public/img?');

      const other = await app.inject({ method: 'POST', url: `/api/messages/${id}/remote-images` });
      expect(other.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('the public proxy refuses a bad signature without fetching', async () => {
    const { app } = await setup();
    try {
      const r = await app.inject({
        method: 'GET',
        url: `/public/img?u=${encodeURIComponent('https://img.example/p.png')}&e=${Date.now() + 1000}&s=bad`,
      });
      expect(r.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
