// Ingestion pipeline shared by the SMTP server and the test injector.
// Given a raw RFC 822 message and a recipient address, decides inbox vs quarantine
// and persists the message + raw .eml + attachments + FTS row.

import { simpleParser } from 'mailparser';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import type { Mailbox } from './db.js';
import { saveRaw, saveAttachment } from './storage.js';
import { matchWhitelist } from './whitelist.js';
import { checkAuth } from './mailauth.js';
import { bus } from './events.js';
import { scanTrackers } from './utils/trackers.js';
import { forwardAliasMessage } from './forwarding.js';
import type { ForwardableAlias } from './forwarding.js';

export type IngestResult = {
  mailboxId: number;
  /** null when an alias in `forward` mode relayed the message without storing it. */
  messageId: string | null;
  folder: 'inbox' | 'quarantine' | 'forwarded';
  /** True when the message was relayed to the alias's forwarding address. */
  forwarded: boolean;
  whitelistMatch: string | null;
  reason: string;
  attachmentCount: number;
};

const findMailbox = db.prepare('SELECT * FROM mailboxes WHERE address = ?');
const findAlias = db.prepare(
  `SELECT a.*, m.address AS mailbox_address, m.account_id, m.domain_id
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
  alias: ForwardableAlias | null;
};

function resolveRecipient(rcpt: string): RecipientResolution | null {
  const addr = rcpt.toLowerCase();
  const mb = findMailbox.get(addr) as Mailbox | undefined;
  if (mb) return { mailbox: mb, viaAlias: null, aliasId: null, abused: false, alias: null };

  const alias = findAlias.get(addr) as
    | (import('./db.js').Alias & { mailbox_address: string; account_id: number; domain_id: number })
    | undefined;
  if (!alias) return null;
  if (alias.abused) {
    return { mailbox: null as any, viaAlias: addr, aliasId: alias.id, abused: true, alias: null };
  }
  if (alias.expires_at && alias.expires_at < Date.now()) return null;

  const linkedMb = findMailbox.get(alias.mailbox_address) as Mailbox | undefined;
  if (!linkedMb) return null;
  return { mailbox: linkedMb, viaAlias: addr, aliasId: alias.id, abused: false, alias };
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

  // Alias forwarding: only whitelisted mail is ever forwarded — unknown senders stay in
  // quarantine regardless of mode. A forward that can't happen (no verified target, rate
  // limit, relay error) falls back to storing, so mail is never silently lost.
  let forwarded = false;
  const alias = resolution.alias;
  if (alias && alias.mode !== 'store' && folder === 'inbox') {
    if (auth.dmarcPass === false) {
      // A spoof of a whitelisted sender. Never forward it: our rewrite re-signs it as our
      // own domain, which would launder it into a DMARC pass at the user's real inbox.
      // Store it here instead, where the reading pane shows the DMARC-fail warning.
      reason += ' (forward-skipped:dmarc-fail)';
    } else {
      const outcome = await forwardAliasMessage(rawBuffer, parsed, alias);
      forwarded = outcome.ok;
      if (!outcome.ok) reason += ` (forward-skipped:${outcome.reason})`;
    }
  }
  if (alias && alias.mode === 'forward' && forwarded) {
    bumpAlias.run(Date.now(), alias.id);
    return {
      mailboxId: mailbox.id,
      messageId: null,
      folder: 'forwarded',
      forwarded: true,
      whitelistMatch: wl?.description ?? null,
      reason: `${reason} -> forwarded`,
      attachmentCount: parsed.attachments?.length ?? 0,
    };
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
    forwarded,
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
