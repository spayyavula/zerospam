import { db } from '../src/db.js';
import { ensureDkim } from '../src/dkim.js';
import { ingest } from '../src/ingest.js';

export function seedDomain(name: string): number {
  const r = db
    .prepare(`INSERT INTO domains (name, created_at) VALUES (?, ?) RETURNING id`)
    .get(name, Date.now()) as { id: number };
  ensureDkim(r.id);
  return r.id;
}

export type SeedMailboxOpts = {
  displayName?: string;
  quarantineTtlHours?: number;
  digestEnabled?: boolean;
  digestHour?: number;
  digestRecipientMode?: 'external' | 'loopback';
  ownerEmail?: string;
  lastDigestSentAt?: number | null;
};

export function seedMailbox(address: string, opts: SeedMailboxOpts = {}): number {
  const domainName = address.split('@')[1];
  let domain = db.prepare('SELECT id FROM domains WHERE name = ?').get(domainName) as
    | { id: number }
    | undefined;
  if (!domain) domain = { id: seedDomain(domainName) };
  const r = db
    .prepare(
      `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, created_at)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      address.toLowerCase(),
      domain.id,
      opts.displayName ?? null,
      opts.quarantineTtlHours ?? 168,
      Date.now(),
    ) as { id: number };
  return r.id;
}

export async function injectQuarantined(opts: {
  to: string;
  from: string;
  fromName?: string;
  subject?: string;
  text?: string;
}): Promise<string> {
  const headers = [
    `From: ${opts.fromName ? `"${opts.fromName}" <${opts.from}>` : opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject ?? '(no subject)'}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@test.local>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    opts.text ?? 'body',
  ];
  const raw = Buffer.from(headers.join('\r\n'));
  const r = await ingest(raw, opts.to);
  if (!r) throw new Error(`ingest returned null for ${opts.to}`);
  return r.messageId;
}
