// Ingestion pipeline shared by the SMTP server and the test injector.
// Given a raw RFC 822 message and a recipient address, decides inbox vs quarantine
// and persists the message + raw .eml + attachments + FTS row.

import { simpleParser } from 'mailparser';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import type { Mailbox } from './db.js';
import { saveRaw, saveAttachment } from './storage.js';
import { matchWhitelist } from './whitelist.js';
import { checkAuth } from './auth.js';
import { bus } from './events.js';
import { scanTrackers } from './utils/trackers.js';

export type IngestResult = {
  mailboxId: number;
  messageId: string;
  folder: 'inbox' | 'quarantine';
  whitelistMatch: string | null;
  reason: string;
  attachmentCount: number;
};

const findMailbox = db.prepare('SELECT * FROM mailboxes WHERE address = ?');
const findAlias = db.prepare(
  `SELECT a.*, m.address AS mailbox_address
   FROM aliases a JOIN mailboxes m ON m.id = a.mailbox_id
   WHERE a.address = ?`,
);
const bumpAlias = db.prepare(
  'UPDATE aliases SET received_count = received_count + 1, last_seen = ? WHERE id = ?',
);
const insertMessage = db.prepare(`
  INSERT INTO messages (
    id, mailbox_id, folder, from_address, from_name,
    to_addresses, cc_addresses, subject, preview, body_text, body_html,
    received_at, expires_at, read, starred,
    spf_pass, dkim_pass, dmarc_pass, whitelist_match, raw_path, size_bytes,
    attachment_count, in_reply_to, tracker_count, tracker_details, delivered_to_alias
  ) VALUES (
    @id, @mailbox_id, @folder, @from_address, @from_name,
    @to_addresses, @cc_addresses, @subject, @preview, @body_text, @body_html,
    @received_at, @expires_at, 0, 0,
    @spf_pass, @dkim_pass, @dmarc_pass, @whitelist_match, @raw_path, @size_bytes,
    @attachment_count, @in_reply_to, @tracker_count, @tracker_details, @delivered_to_alias
  )
`);

type RecipientResolution = {
  mailbox: Mailbox;
  viaAlias: string | null;
  aliasId: number | null;
  abused: boolean;
};

function resolveRecipient(rcpt: string): RecipientResolution | null {
  const addr = rcpt.toLowerCase();
  const mb = findMailbox.get(addr) as Mailbox | undefined;
  if (mb) return { mailbox: mb, viaAlias: null, aliasId: null, abused: false };

  const alias = findAlias.get(addr) as
    | (import('./db.js').Alias & { mailbox_address: string })
    | undefined;
  if (!alias) return null;
  if (alias.abused) return { mailbox: null as any, viaAlias: addr, aliasId: alias.id, abused: true };
  if (alias.expires_at && alias.expires_at < Date.now()) return null;

  const linkedMb = findMailbox.get(alias.mailbox_address) as Mailbox | undefined;
  if (!linkedMb) return null;
  return { mailbox: linkedMb, viaAlias: addr, aliasId: alias.id, abused: false };
}
const insertAttachment = db.prepare(`
  INSERT INTO attachments (message_id, filename, content_type, size_bytes, cid, inline, path)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertFts = db.prepare(`
  INSERT INTO messages_fts (message_id, mailbox_id, from_address, from_name, subject, body_text)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const upsertContact = db.prepare(`
  INSERT INTO contacts (mailbox_id, address, name, last_seen) VALUES (?, ?, ?, ?)
  ON CONFLICT(mailbox_id, address) DO UPDATE SET
    name = COALESCE(excluded.name, contacts.name),
    last_seen = excluded.last_seen
`);

function preview(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function asBool(b: boolean | null): number | null {
  return b == null ? null : b ? 1 : 0;
}

export async function ingest(
  rawBuffer: Buffer,
  recipient: string,
  clientIp?: string,
): Promise<IngestResult | null> {
  const resolution = resolveRecipient(recipient);
  if (!resolution) return null;
  if (resolution.abused) return null; // alias was flagged; pretend the recipient doesn't exist
  const mailbox = resolution.mailbox;

  const [parsed, auth] = await Promise.all([
    simpleParser(rawBuffer),
    checkAuth(rawBuffer, clientIp),
  ]);

  const fromObj = parsed.from?.value?.[0];
  const fromAddress = (fromObj?.address ?? 'unknown@unknown').toLowerCase();
  const fromName = fromObj?.name || null;

  const wl = matchWhitelist(mailbox.id, fromAddress);

  // Routing rule: whitelist match → inbox; otherwise → quarantine.
  // Auth (SPF/DKIM/DMARC) is recorded and surfaced in the UI as a spoof-risk indicator,
  // but does not override an explicit whitelist decision.
  let folder: 'inbox' | 'quarantine';
  let reason: string;
  if (wl) {
    folder = 'inbox';
    reason =
      auth.dmarcPass === false
        ? `whitelist:${wl.description} (dmarc-fail; check spoof risk)`
        : `whitelist:${wl.description}`;
  } else {
    folder = 'quarantine';
    reason = 'not-whitelisted';
  }

  const messageId = nanoid();
  const rawPath = saveRaw(mailbox.id, messageId, rawBuffer);
  const now = Date.now();
  const expiresAt =
    folder === 'quarantine' ? now + mailbox.quarantine_ttl_hours * 3600 * 1000 : null;

  const toAddresses = (parsed.to ? toArray(parsed.to) : []).map((a) => a.address).filter(Boolean);
  const ccAddresses = parsed.cc ? toArray(parsed.cc).map((a) => a.address).filter(Boolean) : [];

  const attachments = parsed.attachments ?? [];
  const savedAttachments = attachments.map((att, idx) => {
    const path = saveAttachment(
      mailbox.id,
      messageId,
      idx,
      att.filename,
      att.content as Buffer,
    );
    return {
      filename: att.filename ?? null,
      content_type: att.contentType ?? null,
      size_bytes: att.size ?? (att.content as Buffer)?.length ?? 0,
      cid: att.cid ?? null,
      inline: att.contentDisposition === 'inline' ? 1 : 0,
      path,
    };
  });

  const bodyHtml = typeof parsed.html === 'string' ? parsed.html : null;
  const inReplyToHeader = parsed.headers?.get('in-reply-to');
  const inReplyTo =
    typeof inReplyToHeader === 'string' ? inReplyToHeader.trim() : null;
  const trackerReport = scanTrackers(bodyHtml);

  insertMessage.run({
    id: messageId,
    mailbox_id: mailbox.id,
    folder,
    from_address: fromAddress,
    from_name: fromName,
    to_addresses: JSON.stringify(toAddresses),
    cc_addresses: ccAddresses.length ? JSON.stringify(ccAddresses) : null,
    subject: parsed.subject ?? null,
    preview: preview(parsed.text || (bodyHtml ?? '')),
    body_text: parsed.text ?? null,
    body_html: bodyHtml,
    received_at: now,
    expires_at: expiresAt,
    spf_pass: asBool(auth.spfPass),
    dkim_pass: asBool(auth.dkimPass),
    dmarc_pass: asBool(auth.dmarcPass),
    whitelist_match: wl ? wl.description : null,
    raw_path: rawPath,
    size_bytes: rawBuffer.length,
    attachment_count: savedAttachments.length,
    in_reply_to: inReplyTo,
    tracker_count: trackerReport.count,
    tracker_details: trackerReport.hits.length ? JSON.stringify(trackerReport.hits) : null,
    delivered_to_alias: resolution.viaAlias,
  });

  if (resolution.aliasId) {
    bumpAlias.run(now, resolution.aliasId);
  }

  for (const a of savedAttachments) {
    insertAttachment.run(messageId, a.filename, a.content_type, a.size_bytes, a.cid, a.inline, a.path);
  }

  insertFts.run(
    messageId,
    mailbox.id,
    fromAddress,
    fromName ?? '',
    parsed.subject ?? '',
    parsed.text ?? '',
  );

  upsertContact.run(mailbox.id, fromAddress, fromName, now);

  bus.publish({ type: 'message:new', mailboxId: mailbox.id, messageId, folder });

  return {
    mailboxId: mailbox.id,
    messageId,
    folder,
    whitelistMatch: wl?.description ?? null,
    reason,
    attachmentCount: savedAttachments.length,
  };
}

function toArray(v: any): { address?: string; name?: string }[] {
  if (Array.isArray(v)) {
    return v.flatMap((x) => x.value ?? []);
  }
  return v.value ?? [];
}
