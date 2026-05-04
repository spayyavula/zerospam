import { db } from './db.js';
import { matchWhitelist } from './whitelist.js';

export type ScreenerMessageSummary = {
  id: string;
  mailbox_id: number;
  folder: 'inbox' | 'quarantine' | 'sent' | 'trash';
  from_address: string;
  from_name: string | null;
  to_addresses: string;
  subject: string | null;
  preview: string | null;
  received_at: number;
  expires_at: number | null;
  read: number;
  starred: number;
  spf_pass: number | null;
  dkim_pass: number | null;
  dmarc_pass: number | null;
  whitelist_match: string | null;
  size_bytes: number;
  attachment_count: number;
};

export type ScreenerSender = {
  address: string;
  name: string | null;
  message_count: number;
  latest_subject: string;
  latest_preview: string;
  latest_received_at: number;
  first_received_at: number;
  messages: ScreenerMessageSummary[];
};

function normalizeAddress(input: string): string {
  return input.trim().toLowerCase();
}

export function listScreenerMessages(mailboxId: number, now = Date.now()): ScreenerMessageSummary[] {
  const rows = db
    .prepare(
      `SELECT m.id, m.mailbox_id, m.folder, m.from_address, m.from_name, m.to_addresses,
              m.subject, m.preview, m.received_at, m.expires_at, m.read, m.starred,
              m.spf_pass, m.dkim_pass, m.dmarc_pass, m.whitelist_match,
              m.size_bytes, m.attachment_count
       FROM messages m
       JOIN mailboxes b ON b.id = m.mailbox_id
       LEFT JOIN screener_mutes sm
         ON sm.mailbox_id = m.mailbox_id
        AND sm.sender_addr = m.from_address
        AND sm.expires_at > ?
       WHERE m.mailbox_id = ?
         AND m.folder = 'quarantine'
         AND (m.received_at + (b.screener_sla_hours * 3600000)) > ?
         AND sm.id IS NULL
       ORDER BY m.received_at DESC`,
    )
    .all(now, mailboxId, now) as ScreenerMessageSummary[];

  return rows.filter((r) => !matchWhitelist(mailboxId, r.from_address));
}

export function listScreenerSenders(mailboxId: number, now = Date.now()): ScreenerSender[] {
  const msgs = listScreenerMessages(mailboxId, now);
  const grouped = new Map<string, ScreenerSender>();

  for (const m of msgs) {
    const key = normalizeAddress(m.from_address);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        address: key,
        name: m.from_name,
        message_count: 1,
        latest_subject: (m.subject ?? '(no subject)').trim() || '(no subject)',
        latest_preview: (m.preview ?? '').slice(0, 200),
        latest_received_at: m.received_at,
        first_received_at: m.received_at,
        messages: [m],
      });
      continue;
    }

    existing.message_count += 1;
    existing.messages.push(m);
    if (m.received_at > existing.latest_received_at) {
      existing.latest_received_at = m.received_at;
      existing.latest_subject = (m.subject ?? '(no subject)').trim() || '(no subject)';
      existing.latest_preview = (m.preview ?? '').slice(0, 200);
      if (m.from_name) existing.name = m.from_name;
    }
    if (m.received_at < existing.first_received_at) {
      existing.first_received_at = m.received_at;
    }
  }

  const senders = Array.from(grouped.values());
  for (const s of senders) {
    s.messages.sort((a, b) => b.received_at - a.received_at);
  }
  senders.sort((a, b) => b.latest_received_at - a.latest_received_at);
  return senders;
}

export function getScreenerCounts(mailboxId: number, now = Date.now()): { total: number; unread: number } {
  const senders = listScreenerSenders(mailboxId, now);
  let unread = 0;
  for (const s of senders) {
    if (s.messages.some((m) => m.read === 0)) unread += 1;
  }
  return { total: senders.length, unread };
}
