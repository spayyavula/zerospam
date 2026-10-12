import { describe, it, expect, afterEach, vi } from 'vitest';
import * as mailauth from '../src/mailauth.js';
import { connect } from 'node:net';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { ingest } from '../src/ingest.js';
import { handleReverseReply, replyRateLimited, recordOutbound } from '../src/forwarding.js';
import { startSmtp } from '../src/smtp.js';
import { seedMailbox } from './helpers.js';
import { seedOwner } from './fixtures/owner.js';

const sent = (): any[] => (globalThis as any).__sentMail;
const limits = config.aliases as { -readonly [K in keyof typeof config.aliases]: (typeof config.aliases)[K] };
const defaults = { ...config.aliases };

afterEach(() => {
  Object.assign(limits, defaults);
});

const ALIAS = 'quiet-otter-x7k2@zero-spam.email';
const TARGET = 'owner@example.com';

async function setup(opts: { mode: 'store' | 'forward' | 'both'; verified?: boolean; target?: boolean }) {
  const { accountId } = await seedOwner({ email: TARGET });
  const mailboxId = seedMailbox('me@zero-spam.email');
  db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(accountId, mailboxId);
  let targetId: number | null = null;
  if (opts.target !== false) {
    targetId = (db
      .prepare(
        `INSERT INTO forward_targets (account_id, email, verified_at, created_at)
         VALUES (?, ?, ?, ?) RETURNING id`,
      )
      .get(accountId, TARGET, opts.verified === false ? null : Date.now(), Date.now()) as { id: number }).id;
  }
  const aliasId = (db
    .prepare(
      `INSERT INTO aliases (mailbox_id, address, created_at, mode, forward_target_id)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(mailboxId, ALIAS, Date.now(), opts.mode, targetId) as { id: number }).id;
  db.prepare(
    `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, created_at) VALUES (?, 'address', ?, ?)`,
  ).run(mailboxId, 'boss@trusted.com', Date.now());
  return { accountId, mailboxId, aliasId, targetId };
}

function mail(opts: {
  from?: string;
  fromName?: string;
  to?: string;
  cc?: string;
  subject?: string;
  extra?: string[];
  body?: string;
}): Buffer {
  const from = opts.from ?? 'boss@trusted.com';
  return Buffer.from(
    [
      'Received: from mx.trusted.com by mail.zero-spam.email',
      'DKIM-Signature: v=1; a=rsa-sha256; d=trusted.com; s=s1; b=AAAA',
      `From: ${opts.fromName ? `"${opts.fromName}" <${from}>` : from}`,
      `To: ${opts.to ?? ALIAS}`,
      ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
      `Subject: ${opts.subject ?? 'Quarterly numbers'}`,
      'Date: Mon, 12 Oct 2026 09:00:00 +0000',
      `Message-ID: <${Math.random().toString(36).slice(2)}@trusted.com>`,
      'Return-Path: <bounce@trusted.com>',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      ...(opts.extra ?? []),
      '',
      opts.body ?? 'The numbers are in.\r\n-- \r\nBoss',
    ].join('\r\n'),
  );
}

function headersOf(raw: Buffer | string): string {
  const s = raw.toString();
  return s.slice(0, s.indexOf('\r\n\r\n'));
}

function header(raw: Buffer | string, name: string): string | undefined {
  const m = headersOf(raw).match(new RegExp(`^${name}: (.*(?:\\r\\n[ \\t].*)*)`, 'im'));
  return m?.[1];
}

describe('alias forwarding (ingest)', () => {
  it('store mode keeps today\'s behaviour: stored, nothing relayed', async () => {
    await setup({ mode: 'store' });
    const r = await ingest(mail({}), ALIAS);
    expect(r?.folder).toBe('inbox');
    expect(r?.forwarded).toBe(false);
    expect(sent()).toHaveLength(0);
  });

  it('both mode stores AND forwards a rewritten copy', async () => {
    const { aliasId } = await setup({ mode: 'both' });
    const r = await ingest(
      mail({ fromName: 'The Boss', cc: '"Pat" <pat@partner.io>, quiet-otter-x7k2@zero-spam.email' }),
      ALIAS,
    );
    expect(r?.folder).toBe('inbox');
    expect(r?.forwarded).toBe(true);
    expect(r?.messageId).toBeTruthy();
    expect(sent()).toHaveLength(1);

    const m = sent()[0];
    expect(m.envelope).toEqual({ from: 'bounces@zero-spam.email', to: [TARGET] });
    expect(m.dkim.domainName).toBe('zero-spam.email');

    const revs = db
      .prepare('SELECT contact_address, address FROM reverse_aliases WHERE alias_id = ? ORDER BY contact_address')
      .all(aliasId) as Array<{ contact_address: string; address: string }>;
    expect(revs.map((r) => r.contact_address)).toEqual(['boss@trusted.com', 'pat@partner.io']);
    for (const r of revs) expect(r.address).toMatch(/^rv\.[0-9a-z]{12}@zero-spam\.email$/);
    const bossRev = revs[0].address;
    const patRev = revs[1].address;

    const raw = m.raw as Buffer;
    expect(header(raw, 'From')).toBe(`"The Boss (boss at trusted.com)" <${bossRev}>`);
    expect(header(raw, 'Reply-To')).toBe(bossRev);
    expect(header(raw, 'To')).toBe(ALIAS);
    expect(header(raw, 'Cc')).toContain(`<${patRev}>`);
    expect(header(raw, 'Cc')).toContain(ALIAS);
    expect(header(raw, 'Cc')).not.toContain('pat@partner.io>');
    expect(header(raw, 'X-ZeroSpam-Forwarded')).toBe(ALIAS);
    expect(header(raw, 'Subject')).toBe('Quarterly numbers');
    // Original signatures/trace/return headers are dropped.
    expect(header(raw, 'DKIM-Signature')).toBeUndefined();
    expect(header(raw, 'Received')).toBeUndefined();
    expect(header(raw, 'Return-Path')).toBeUndefined();
    // Body is byte-for-byte.
    expect(raw.toString().endsWith('\r\n\r\nThe numbers are in.\r\n-- \r\nBoss')).toBe(true);

    const a = db.prepare('SELECT forwarded_count, received_count FROM aliases WHERE id = ?').get(aliasId) as any;
    expect(a).toEqual({ forwarded_count: 1, received_count: 1 });
  });

  it('forward mode relays without storing', async () => {
    const { aliasId, mailboxId } = await setup({ mode: 'forward' });
    const r = await ingest(mail({}), ALIAS);
    expect(r).toMatchObject({ folder: 'forwarded', forwarded: true, messageId: null, mailboxId });
    expect(sent()).toHaveLength(1);
    const stored = db.prepare('SELECT COUNT(*) AS c FROM messages').get() as { c: number };
    expect(stored.c).toBe(0);
    const a = db.prepare('SELECT forwarded_count, received_count FROM aliases WHERE id = ?').get(aliasId) as any;
    expect(a).toEqual({ forwarded_count: 1, received_count: 1 });
  });

  it('never forwards non-whitelisted senders: they go to quarantine in every mode', async () => {
    await setup({ mode: 'forward' });
    const r = await ingest(mail({ from: 'spam@evil.io' }), ALIAS);
    expect(r?.folder).toBe('quarantine');
    expect(r?.forwarded).toBe(false);
    expect(sent()).toHaveLength(0);
    expect(db.prepare('SELECT COUNT(*) AS c FROM reverse_aliases').get()).toEqual({ c: 0 });
  });

  it('never forwards a DMARC-failing spoof of a whitelisted sender', async () => {
    await setup({ mode: 'forward' });
    const spy = vi
      .spyOn(mailauth, 'checkAuth')
      .mockResolvedValue({ spfPass: false, dkimPass: false, dmarcPass: false, fromAuthenticated: false });
    try {
      const r = await ingest(mail({}), ALIAS);
      expect(r?.folder).toBe('inbox'); // stored with the DMARC-fail chip, not relayed
      expect(r?.reason).toContain('forward-skipped:dmarc-fail');
      expect(sent()).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back to storing when the target is unverified', async () => {
    await setup({ mode: 'forward', verified: false });
    const r = await ingest(mail({}), ALIAS);
    expect(r?.folder).toBe('inbox');
    expect(r?.reason).toContain('forward-skipped:no-verified-target');
    expect(sent()).toHaveLength(0);
  });

  it('falls back to storing when there is no target at all', async () => {
    await setup({ mode: 'forward', target: false });
    const r = await ingest(mail({}), ALIAS);
    expect(r?.folder).toBe('inbox');
    expect(r?.reason).toContain('no-verified-target');
  });

  it('falls back to storing when the relay fails', async () => {
    await setup({ mode: 'forward' });
    (globalThis as any).__failNextSend = true;
    const r = await ingest(mail({}), ALIAS);
    expect(r?.folder).toBe('inbox');
    expect(r?.reason).toContain('forward-skipped:relay-error');
    expect(r?.messageId).toBeTruthy();
  });

  it('stops forwarding at the hourly limit and stores instead', async () => {
    limits.forwardMaxPerHour = 1;
    await setup({ mode: 'forward' });
    expect((await ingest(mail({}), ALIAS))?.folder).toBe('forwarded');
    const second = await ingest(mail({}), ALIAS);
    expect(second?.folder).toBe('inbox');
    expect(second?.reason).toContain('rate-limited');
    expect(sent()).toHaveLength(1);
  });

  it('refuses to re-forward a message that already went through a forward (loop guard)', async () => {
    await setup({ mode: 'forward' });
    const r = await ingest(mail({ extra: ['X-ZeroSpam-Forwarded: someone@zero-spam.email'] }), ALIAS);
    expect(r?.folder).toBe('inbox');
    expect(r?.reason).toContain('loop');
    expect(sent()).toHaveLength(0);
  });

  it('reuses one reverse alias per contact', async () => {
    const { aliasId } = await setup({ mode: 'forward' });
    await ingest(mail({}), ALIAS);
    await ingest(mail({ subject: 'again' }), ALIAS);
    const rows = db.prepare('SELECT COUNT(*) AS c FROM reverse_aliases WHERE alias_id = ?').get(aliasId);
    expect(rows).toEqual({ c: 1 });
    expect(header(sent()[0].raw, 'Reply-To')).toBe(header(sent()[1].raw, 'Reply-To'));
  });

  it('does not forward through a blocked alias', async () => {
    const { aliasId } = await setup({ mode: 'forward' });
    db.prepare('UPDATE aliases SET abused = 1 WHERE id = ?').run(aliasId);
    expect(await ingest(mail({}), ALIAS)).toBeNull();
    expect(sent()).toHaveLength(0);
  });
});

describe('reverse-alias replies', () => {
  async function forwardedSetup() {
    limits.replyRequireDmarc = false; // mailauth has no DNS in tests
    const ctx = await setup({ mode: 'forward' });
    await ingest(mail({ cc: '"Pat" <pat@partner.io>' }), ALIAS);
    const rev = (contact: string) =>
      (db.prepare('SELECT address FROM reverse_aliases WHERE contact_address = ?').get(contact) as { address: string }).address;
    sent().length = 0;
    return { ...ctx, bossRev: rev('boss@trusted.com'), patRev: rev('pat@partner.io') };
  }

  function reply(opts: { from?: string; to: string; cc?: string }): Buffer {
    return Buffer.from(
      [
        'DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=g; b=BBBB',
        `From: "Owner Person" <${opts.from ?? TARGET}>`,
        `To: ${opts.to}`,
        ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
        'Subject: Re: Quarterly numbers',
        'Date: Mon, 12 Oct 2026 10:00:00 +0000',
        'Message-ID: <CAF123@mail.gmail.com>',
        'In-Reply-To: <orig@trusted.com>',
        'References: <orig@trusted.com>',
        'X-Mailer: Gmail',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Thanks, looks good.',
      ].join('\r\n'),
    );
  }

  it('relays the reply to the contact as the alias, with no trace of the real address', async () => {
    const { bossRev, patRev, aliasId } = await forwardedSetup();
    const r = await handleReverseReply(
      reply({ to: `"The Boss (boss at trusted.com)" <${bossRev}>`, cc: `${patRev}, ${TARGET}, stranger@else.com` }),
      bossRev,
    );
    expect(r).toEqual({ status: 'sent', contact: 'boss@trusted.com' });
    expect(sent()).toHaveLength(1);
    const m = sent()[0];
    expect(m.envelope).toEqual({ from: 'bounces@zero-spam.email', to: ['boss@trusted.com'] });
    const raw = m.raw as Buffer;
    expect(header(raw, 'From')).toBe(ALIAS);
    expect(header(raw, 'To')).toBe('boss@trusted.com');
    expect(header(raw, 'Cc')).toBe('"Pat" <pat@partner.io>');
    expect(header(raw, 'Message-ID')).toMatch(/^<[^@]+@zero-spam\.email>$/);
    expect(header(raw, 'In-Reply-To')).toBe('<orig@trusted.com>');
    const head = headersOf(raw);
    expect(head).not.toContain(TARGET);
    expect(head).not.toContain('gmail');
    expect(head).not.toContain('stranger@else.com');
    expect(header(raw, 'DKIM-Signature')).toBeUndefined();
    expect(header(raw, 'X-Mailer')).toBeUndefined();
    expect(raw.toString().endsWith('Thanks, looks good.')).toBe(true);
    const a = db.prepare('SELECT replied_count FROM aliases WHERE id = ?').get(aliasId) as any;
    expect(a.replied_count).toBe(1);
  });

  it('rejects replies that do not come from the verified forwarding address', async () => {
    const { bossRev } = await forwardedSetup();
    const r = await handleReverseReply(reply({ from: 'attacker@evil.io', to: bossRev }), bossRev);
    expect(r).toEqual({ status: 'rejected', reason: 'sender-not-owner' });
    expect(sent()).toHaveLength(0);
    const audit = db.prepare("SELECT event FROM audit_log WHERE event = 'alias.reply.rejected'").all();
    expect(audit).toHaveLength(1);
  });

  it('rejects an unauthenticated From of the real address (spoof) when auth is required', async () => {
    const { bossRev } = await forwardedSetup();
    limits.replyRequireDmarc = true;
    const r = await handleReverseReply(reply({ to: bossRev }), bossRev);
    expect(r).toEqual({ status: 'rejected', reason: 'sender-not-authenticated' });
    expect(sent()).toHaveLength(0);
  });

  // Production case: the forwarding domain publishes no DMARC record, so DMARC can never
  // "pass", but its mail carries a valid DKIM signature aligned with the From domain.
  it('accepts a reply whose domain has no DMARC record but an aligned DKIM pass', async () => {
    const { bossRev } = await forwardedSetup();
    limits.replyRequireDmarc = true;
    const spy = vi
      .spyOn(mailauth, 'checkAuth')
      .mockResolvedValue({ spfPass: true, dkimPass: true, dmarcPass: null, fromAuthenticated: true });
    try {
      const r = await handleReverseReply(reply({ to: bossRev }), bossRev);
      expect(r).toEqual({ status: 'sent', contact: 'boss@trusted.com' });
      expect(sent()).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects replies once the alias is blocked', async () => {
    const { bossRev, aliasId } = await forwardedSetup();
    db.prepare('UPDATE aliases SET abused = 1 WHERE id = ?').run(aliasId);
    const r = await handleReverseReply(reply({ to: bossRev }), bossRev);
    expect(r.status).toBe('rejected');
    expect(sent()).toHaveLength(0);
  });

  it('reports the reply rate limit so SMTP can answer 451', async () => {
    const { bossRev, accountId } = await forwardedSetup();
    limits.replyMaxPerHour = 2;
    expect(replyRateLimited(bossRev)).toBe(false);
    recordOutbound(accountId, 'reply');
    recordOutbound(accountId, 'reply');
    expect(replyRateLimited(bossRev)).toBe(true);
    // Old events fall out of the window.
    db.prepare('UPDATE outbound_events SET at = at - 3700000').run();
    expect(replyRateLimited(bossRev)).toBe(false);
  });
});

describe('SMTP handling of reverse aliases', () => {
  function smtpSession(lines: string[]): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const sock = connect(config.smtpPort, '127.0.0.1');
      const replies: string[] = [];
      let buf = '';
      let i = 0;
      sock.setEncoding('utf8');
      sock.on('data', (d: string) => {
        buf += d;
        let idx: number;
        while ((idx = buf.indexOf('\r\n')) !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (/^\d{3}-/.test(line)) continue; // multi-line reply continues
          replies.push(line);
          if (i < lines.length) sock.write(lines[i++] + '\r\n');
          else sock.end();
        }
      });
      sock.on('error', reject);
      sock.on('close', () => resolve(replies));
    });
  }

  it('accepts active reverse aliases, rejects unknown ones, and 451s over the reply limit', async () => {
    limits.replyRequireDmarc = false;
    const ctx = await setup({ mode: 'forward' });
    await ingest(mail({}), ALIAS);
    const bossRev = (db.prepare('SELECT address FROM reverse_aliases').get() as { address: string }).address;
    sent().length = 0;

    const server = startSmtp();
    await new Promise((r) => setTimeout(r, 50));
    try {
      const body = [
        `From: ${TARGET}`,
        `To: ${bossRev}`,
        'Subject: Re: hi',
        '',
        'ok',
        '.',
      ].join('\r\n');

      const ok = await smtpSession([
        'EHLO test',
        `MAIL FROM:<${TARGET}>`,
        'RCPT TO:<rv.doesnotexist1@zero-spam.email>',
        `RCPT TO:<${bossRev}>`,
        'DATA',
        body,
        'QUIT',
      ]);
      expect(ok[3]).toMatch(/^550/); // unknown reverse alias
      expect(ok[4]).toMatch(/^250/); // real reverse alias
      expect(ok[6]).toMatch(/^250/); // accepted + relayed
      expect(sent()).toHaveLength(1);
      expect(sent()[0].envelope.to).toEqual(['boss@trusted.com']);

      limits.replyMaxPerHour = 1;
      const limited = await smtpSession([
        'EHLO test',
        `MAIL FROM:<${TARGET}>`,
        `RCPT TO:<${bossRev}>`,
        'DATA',
        body,
        'QUIT',
      ]);
      expect(limited[5]).toMatch(/^451 4\.7\.1/);
      expect(sent()).toHaveLength(1);
      void ctx;
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
