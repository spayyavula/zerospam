// Idempotent seed: a default domain, a default mailbox, and a starter whitelist.
import { db } from './db.js';
import { config } from './config.js';
import { ensureDkim } from './dkim.js';

const now = Date.now();

const ensureDomain = db.prepare(`
  INSERT INTO domains (name, created_at) VALUES (?, ?)
  ON CONFLICT(name) DO UPDATE SET name = excluded.name
  RETURNING id
`);

const ensureMailbox = db.prepare(`
  INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(address) DO UPDATE SET display_name = excluded.display_name
  RETURNING id
`);

const insertRule = db.prepare(`
  INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)
`);
const ruleExists = db.prepare(
  'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
);

function seed() {
  const dom = ensureDomain.get('researchbot.co', now) as { id: number };
  ensureDkim(dom.id);
  const mb = ensureMailbox.get(
    'sreekanth@researchbot.co',
    dom.id,
    'Sreekanth',
    config.quarantineTtlHours,
    now,
  ) as { id: number };

  const rules: Array<{ kind: 'address' | 'domain' | 'regex'; pattern: string; note?: string }> = [
    { kind: 'address', pattern: 'boss@trusted.com', note: 'example trusted sender' },
    { kind: 'domain', pattern: 'researchbot.co', note: 'mail from our own domain' },
    { kind: 'domain', pattern: 'github.com', note: 'GitHub notifications' },
  ];
  for (const r of rules) {
    if (!ruleExists.get(mb.id, r.kind, r.pattern)) {
      insertRule.run(mb.id, r.kind, r.pattern, r.note ?? null, now);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `seeded:\n  domain  researchbot.co (id=${dom.id})\n  mailbox sreekanth@researchbot.co (id=${mb.id})\n  whitelist rules: ${rules.length}`,
  );
}

seed();
