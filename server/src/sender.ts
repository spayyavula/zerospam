// Outbound delivery. DKIM-signs every outgoing message and either:
//   - 'loopback' mode: submits SMTP to our own server on localhost:smtpPort
//                       so locally-hosted mailboxes round-trip through the ingest pipeline
//                       (useful for dev — you can compose to yourself and see the inbox flow).
//   - 'relay'    mode: ships through an external SMTP relay defined by RELAY_* env vars.
//
// "Trust on first send" — every recipient address gets auto-whitelisted on the sender's
// mailbox so their replies bypass quarantine.

import nodemailer from 'nodemailer';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import type { Mailbox } from './db.js';
import { config } from './config.js';
import { saveRaw, saveAttachment } from './storage.js';
import { ensureDkim } from './dkim.js';
import { bus } from './events.js';

export type SendInput = {
  mailboxId: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string | null;
  draftId?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
};

export type SendResult = {
  messageId: string;
  envelopeFrom: string;
  recipients: string[];
  signed: boolean;
  whitelistAdded: number;
};

const findMailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ?');

const insertSentMessage = db.prepare(`
  INSERT INTO messages (
    id, mailbox_id, folder, from_address, from_name,
    to_addresses, cc_addresses, subject, preview, body_text, body_html,
    received_at, expires_at, read, starred,
    spf_pass, dkim_pass, dmarc_pass, whitelist_match, raw_path, size_bytes,
    attachment_count, in_reply_to, tracker_count
  ) VALUES (
    @id, @mailbox_id, 'sent', @from_address, @from_name,
    @to_addresses, @cc_addresses, @subject, @preview, @body_text, @body_html,
    @received_at, NULL, 1, 0,
    NULL, 1, NULL, 'self', @raw_path, @size_bytes,
    @attachment_count, @in_reply_to, 0
  )
`);

const deleteDraft = db.prepare('DELETE FROM drafts WHERE id = ?');

const insertAttachment = db.prepare(`
  INSERT INTO attachments (message_id, filename, content_type, size_bytes, cid, inline, path)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertFts = db.prepare(`
  INSERT INTO messages_fts (message_id, mailbox_id, from_address, from_name, subject, body_text)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const ruleExists = db.prepare(
  'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
);
const insertRule = db.prepare(
  'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
);

function preview(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function buildTransport() {
  if (config.sendMode === 'silent') {
    // Buffer the message in memory; never touch the network. Used in tests.
    return nodemailer.createTransport({ streamTransport: true, buffer: true });
  }
  if (config.sendMode === 'relay') {
    if (!config.relay.host) {
      throw new Error('SEND_MODE=relay but RELAY_HOST is empty');
    }
    return nodemailer.createTransport({
      host: config.relay.host,
      port: config.relay.port,
      secure: config.relay.secure,
      auth: config.relay.user ? { user: config.relay.user, pass: config.relay.pass } : undefined,
    });
  }
  // loopback — speak SMTP to our own server, no auth, no TLS.
  return nodemailer.createTransport({
    host: '127.0.0.1',
    port: config.smtpPort,
    secure: false,
    ignoreTLS: true,
  });
}

export async function sendMessage(input: SendInput): Promise<SendResult> {
  const mailbox = findMailbox.get(input.mailboxId) as Mailbox | undefined;
  if (!mailbox) throw new Error(`no such mailbox id=${input.mailboxId}`);
  const domain = ensureDkim(mailbox.domain_id);
  if (!domain.dkim_selector || !domain.dkim_private_pem) {
    throw new Error(`DKIM not initialized for ${domain.name}`);
  }

  const transport = buildTransport();
  const messageId = nanoid();
  const recipients = [
    ...input.to.map((s) => s.toLowerCase()),
    ...(input.cc ?? []).map((s) => s.toLowerCase()),
    ...(input.bcc ?? []).map((s) => s.toLowerCase()),
  ];

  const fromHeader = mailbox.display_name
    ? `"${mailbox.display_name}" <${mailbox.address}>`
    : mailbox.address;

  // Use nodemailer to build, sign, and deliver. The DKIM option on sendMail signs
  // the message body+headers with the supplied private key before the SMTP envelope is opened.
  await transport.sendMail({
    from: fromHeader,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
    messageId: `<${messageId}@${domain.name}>`,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined,
    dkim: {
      domainName: domain.name,
      keySelector: domain.dkim_selector,
      privateKey: domain.dkim_private_pem,
    },
  });

  // Save a synthesized copy in the sender's "Sent" folder. We don't capture the
  // exact signed bytes nodemailer put on the wire; the local archive just records
  // what was sent for the user to read later.
  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${input.to.join(', ')}`,
  ];
  if (input.cc?.length) headers.push(`Cc: ${input.cc.join(', ')}`);
  headers.push(
    `Subject: ${input.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@${domain.name}>`,
    `MIME-Version: 1.0`,
    input.html ? `Content-Type: text/html; charset=utf-8` : `Content-Type: text/plain; charset=utf-8`,
  );
  const raw = Buffer.from(
    headers.join('\r\n') + '\r\n\r\n' + (input.html ?? input.text ?? ''),
  );
  const rawPath = saveRaw(mailbox.id, messageId, raw);

  let attachmentCount = 0;
  if (input.attachments?.length) {
    input.attachments.forEach((att, idx) => {
      const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
      const path = saveAttachment(mailbox.id, messageId, idx, att.filename, buf);
      insertAttachment.run(
        messageId,
        att.filename ?? null,
        att.contentType ?? null,
        buf.length,
        null,
        0,
        path,
      );
      attachmentCount++;
    });
  }

  insertSentMessage.run({
    id: messageId,
    mailbox_id: mailbox.id,
    from_address: mailbox.address,
    from_name: mailbox.display_name,
    to_addresses: JSON.stringify(input.to),
    cc_addresses: input.cc?.length ? JSON.stringify(input.cc) : null,
    subject: input.subject,
    preview: preview(input.text || input.html),
    body_text: input.text ?? null,
    body_html: input.html ?? null,
    received_at: Date.now(),
    raw_path: rawPath,
    size_bytes: raw.length,
    attachment_count: attachmentCount,
    in_reply_to: input.inReplyTo ?? null,
  });

  if (input.draftId) {
    deleteDraft.run(input.draftId);
  }

  insertFts.run(
    messageId,
    mailbox.id,
    mailbox.address,
    mailbox.display_name ?? '',
    input.subject ?? '',
    input.text ?? '',
  );

  // Trust-on-send: auto-whitelist every recipient on this mailbox.
  let whitelistAdded = 0;
  const now = Date.now();
  for (const r of new Set(recipients)) {
    if (!r) continue;
    const exists = ruleExists.get(mailbox.id, 'address', r);
    if (!exists) {
      insertRule.run(mailbox.id, 'address', r, 'trust-on-send', now);
      whitelistAdded++;
    }
  }
  if (whitelistAdded > 0) {
    bus.publish({ type: 'whitelist:changed', mailboxId: mailbox.id });
  }
  bus.publish({ type: 'message:new', mailboxId: mailbox.id, messageId, folder: 'sent' });

  return {
    messageId,
    envelopeFrom: mailbox.address,
    recipients,
    signed: true,
    whitelistAdded,
  };
}
