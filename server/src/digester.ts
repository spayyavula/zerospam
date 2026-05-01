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
import { config, loadDigestSigningSecret } from './config.js';
import { sendMessage } from './sender.js';

const MAX_SENDERS_PER_DIGEST = 30;

const findMailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ?');

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

  // loopback path is added in Task 6
  throw new Error(`unknown digest_recipient_mode: ${mb.digest_recipient_mode}`);
}
