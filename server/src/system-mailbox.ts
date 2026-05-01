import { db, SYSTEM_ACCOUNT_ID } from './db.js';
import { config } from './config.js';
import { ensureDkim } from './dkim.js';

const SYSTEM_LOCAL_PART = 'noreply';

/**
 * Returns the mailbox id of the noreply@<signupDomain> system mailbox,
 * creating it (and its parent domain row + DKIM key) if needed.
 *
 * Owned by SYSTEM_ACCOUNT_ID. Used to send verification emails so the
 * token never lands in a user's own sent folder.
 *
 * Idempotent and tolerant of per-test cleanup (which wipes mailboxes).
 */
export function getOrCreateSystemMailboxId(): number {
  const address = `${SYSTEM_LOCAL_PART}@${config.signupDomain}`;
  const existing = db
    .prepare('SELECT id FROM mailboxes WHERE address = ?')
    .get(address) as { id: number } | undefined;
  if (existing) return existing.id;

  // Ensure domain row + DKIM key for the signup domain.
  let domainRow = db
    .prepare('SELECT id FROM domains WHERE name = ?')
    .get(config.signupDomain) as { id: number } | undefined;
  if (!domainRow) {
    domainRow = db
      .prepare(
        `INSERT INTO domains (name, created_at, account_id)
         VALUES (?, ?, ?) RETURNING id`,
      )
      .get(config.signupDomain, Date.now(), SYSTEM_ACCOUNT_ID) as { id: number };
  }
  ensureDkim(domainRow.id);

  // Create the mailbox. Schema has UNIQUE(address) — race-safe.
  const row = db
    .prepare(
      `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, account_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(address) DO UPDATE SET address = excluded.address
       RETURNING id`,
    )
    .get(
      address,
      domainRow.id,
      'ZeroSpam noreply',
      config.quarantineTtlHours,
      SYSTEM_ACCOUNT_ID,
      Date.now(),
    ) as { id: number };
  return row.id;
}
