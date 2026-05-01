// Digest scheduler, content assembly, and dispatch.
// Mirrors the shape of sweeper.ts: setInterval + per-row check-and-act.
//
// Public exports: assembleDigest, sendDigest, tick, startDigester.

import { db } from './db.js';
import type { Mailbox } from './db.js';
import { sign as signToken, type DigestTokenPayload } from './digest-token.js';
import {
  type DigestContent,
  type DigestSenderRow,
  renderHtml,
  renderText,
} from './digest-template.js';
import { config, loadDigestSigningSecret, assertPublicBaseUrlIfDigestEnabled } from './config.js';
import { sendMessage } from './sender.js';
import { ingest } from './ingest.js';

const MAX_SENDERS_PER_DIGEST = 30;

const findMailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ?');

const ruleExists = db.prepare(
  'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
);
const insertRule = db.prepare(
  'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
);

function digestSystemAddress(mailboxAddress: string): string {
  const domain = mailboxAddress.split('@')[1];
  return `digest-system@${domain}`;
}

export function ensureDigestSelfWhitelist(mailboxId: number): void {
  const mb = findMailbox.get(mailboxId) as Mailbox | undefined;
  if (!mb) return;
  const pattern = digestSystemAddress(mb.address);
  const existing = ruleExists.get(mailboxId, 'address', pattern);
  if (!existing) {
    insertRule.run(mailboxId, 'address', pattern, 'self:digest', Date.now());
  }
}

export async function assembleDigest(mailboxId: number): Promise<DigestContent | null> {
  const mb = findMailbox.get(mailboxId) as Mailbox | undefined;
  if (!mb) return null;

  const cutoff = mb.last_digest_sent_at ?? 0;
  const tokenExp = Date.now() + mb.quarantine_ttl_hours * 3600 * 1000;
  const secret = loadDigestSigningSecret();

  type Row = {
    from_address: string;
    from_name: string | null;
    message_count: number;
    latest_subject: string | null;
    latest_received_at: number;
  };

  const rows = db
    .prepare(
      `SELECT
         from_address,
         MAX(from_name) AS from_name,
         COUNT(*) AS message_count,
         (SELECT subject FROM messages m2
            WHERE m2.mailbox_id = ? AND m2.folder = 'quarantine'
              AND m2.from_address = m.from_address AND m2.received_at > ?
            ORDER BY received_at DESC LIMIT 1) AS latest_subject,
         MAX(received_at) AS latest_received_at
       FROM messages m
       WHERE mailbox_id = ?
         AND folder = 'quarantine'
         AND received_at > ?
       GROUP BY from_address
       ORDER BY MAX(received_at) DESC`,
    )
    .all(mailboxId, cutoff, mailboxId, cutoff) as Row[];

  if (rows.length === 0) return null;

  const limited = rows.slice(0, MAX_SENDERS_PER_DIGEST);
  const senderRows: DigestSenderRow[] = limited.map((r) => {
    const payload: DigestTokenPayload = {
      v: 1,
      mailboxId,
      sender: r.from_address.toLowerCase(),
      action: 'allow-forever',
      exp: tokenExp,
    };
    return {
      fromAddress: r.from_address,
      fromName: r.from_name,
      messageCount: r.message_count,
      latestSubject: r.latest_subject,
      latestReceivedAt: r.latest_received_at,
      allowToken: signToken(payload, secret),
    };
  });

  return {
    mailboxId,
    mailboxAddress: mb.address,
    rows: senderRows,
    totalSendersInQuarantine: rows.length,
    windowStart: cutoff,
  };
}

export type SendDigestResult = {
  delivered: boolean;
  recipientMode: 'external' | 'loopback';
};

export async function sendDigest(
  mailboxId: number,
  content: DigestContent,
): Promise<SendDigestResult> {
  const mb = findMailbox.get(mailboxId) as Mailbox | undefined;
  if (!mb) throw new Error(`mailbox ${mailboxId} not found`);
  if (!config.publicBaseUrl) {
    throw new Error('PUBLIC_BASE_URL is unset; cannot build digest action URLs');
  }

  const subject = `ZeroSpam quarantine digest — ${content.rows.length} sender${content.rows.length === 1 ? '' : 's'} waiting`;
  const html = renderHtml(content, config.publicBaseUrl);
  const text = renderText(content, config.publicBaseUrl);

  if (mb.digest_recipient_mode === 'external') {
    if (!mb.owner_email) {
      throw new Error(`mailbox ${mailboxId} has external digest mode but no owner_email`);
    }
    await sendMessage({
      mailboxId,
      to: [mb.owner_email],
      subject,
      text,
      html,
    });
    return { delivered: true, recipientMode: 'external' };
  }

  // Loopback: synthesize a multipart RFC 822 buffer and run it through ingest()
  // exactly like the test injector does. The digest-system@<domain> sender is
  // pre-whitelisted via ensureDigestSelfWhitelist, so the digest itself does
  // not land in quarantine.
  const fromAddr = digestSystemAddress(mb.address);
  const boundary = `bndry-${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ZeroSpam Digest <${fromAddr}>`,
    `To: ${mb.address}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${mb.address.split('@')[1]}>`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    text,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
    `--${boundary}--`,
  ];
  const raw = Buffer.from(headers.join('\r\n'));
  await ingest(raw, mb.address);
  return { delivered: true, recipientMode: 'loopback' };
}

const TWELVE_HOURS_MS = 12 * 3600 * 1000;
const FAILURE_THRESHOLD = 7;

function todayHourBoundaryMs(now: Date, hour: number): number {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export type TickResult = {
  sentForMailboxes: number[];
  skippedEmpty: number[];
  errored: number[];
  autoDisabled: number[];
};

export async function tick(now: Date = new Date()): Promise<TickResult> {
  const result: TickResult = {
    sentForMailboxes: [],
    skippedEmpty: [],
    errored: [],
    autoDisabled: [],
  };

  const mailboxes = db
    .prepare('SELECT * FROM mailboxes WHERE digest_enabled = 1')
    .all() as Mailbox[];

  for (const mb of mailboxes) {
    const todayBoundary = todayHourBoundaryMs(now, mb.digest_hour);
    if (now.getTime() < todayBoundary) continue;

    if (
      mb.last_digest_sent_at !== null &&
      mb.last_digest_sent_at >= todayBoundary
    ) {
      continue; // already sent today after the boundary
    }

    if (
      mb.last_digest_sent_at !== null &&
      now.getTime() - mb.last_digest_sent_at < TWELVE_HOURS_MS
    ) {
      continue; // 12h anti-double-send guard
    }

    try {
      const content = await assembleDigest(mb.id);
      if (content === null) {
        db.prepare(
          'UPDATE mailboxes SET last_digest_sent_at = ?, digest_consecutive_failures = 0, digest_last_error = NULL WHERE id = ?',
        ).run(now.getTime(), mb.id);
        result.skippedEmpty.push(mb.id);
        continue;
      }
      await sendDigest(mb.id, content);
      db.prepare(
        'UPDATE mailboxes SET last_digest_sent_at = ?, digest_consecutive_failures = 0, digest_last_error = NULL WHERE id = ?',
      ).run(now.getTime(), mb.id);
      result.sentForMailboxes.push(mb.id);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const newFailures = mb.digest_consecutive_failures + 1;
      const willDisable = newFailures >= FAILURE_THRESHOLD;
      db.prepare(
        `UPDATE mailboxes
            SET digest_consecutive_failures = ?,
                digest_last_error = ?,
                digest_enabled = CASE WHEN ? THEN 0 ELSE digest_enabled END
          WHERE id = ?`,
      ).run(newFailures, msg.slice(0, 500), willDisable ? 1 : 0, mb.id);
      result.errored.push(mb.id);
      if (willDisable) result.autoDisabled.push(mb.id);
    }
  }

  return result;
}

export function startDigester(): () => void {
  const anyEnabled = (db
    .prepare('SELECT COUNT(*) AS c FROM mailboxes WHERE digest_enabled = 1')
    .get() as { c: number }).c > 0;
  assertPublicBaseUrlIfDigestEnabled(anyEnabled);

  const run = async () => {
    try {
      await tick();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[digester] tick failure', e);
    }
  };
  // initial run on boot so a missed digest_hour gets caught up
  void run();
  const interval = setInterval(run, config.digestTickIntervalSec * 1000);
  // eslint-disable-next-line no-console
  console.log(`[digester] running every ${config.digestTickIntervalSec}s`);
  return () => clearInterval(interval);
}
