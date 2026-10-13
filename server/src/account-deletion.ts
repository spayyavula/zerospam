// Self-service account deletion (required by Google Play for apps that create accounts).
//
// Deletes everything that belongs to one account: mailboxes and all their mail (rows and
// files on disk), aliases, rules, drafts, connected accounts, forwarding addresses, users,
// devices and sessions. A paid subscription is cancelled in Stripe first; if that fails,
// nothing is deleted, so we never keep charging someone whose data is gone.

import { db, runInTx, SYSTEM_ACCOUNT_ID, DEFAULT_ACCOUNT_ID } from './db.js';
import { deleteRaw, deleteAttachmentFile } from './storage.js';
import { cancelSubscriptionNow } from './billing.js';
import { config } from './config.js';

export class AccountDeletionError extends Error {}

export type DeletionResult = { mailboxes: number; messages: number; users: number };

export async function deleteAccount(accountId: number): Promise<DeletionResult> {
  if (accountId === SYSTEM_ACCOUNT_ID || accountId === DEFAULT_ACCOUNT_ID) {
    throw new AccountDeletionError('this account cannot be deleted');
  }
  const acct = db
    .prepare('SELECT id, stripe_subscription_id, subscription_status FROM accounts WHERE id = ?')
    .get(accountId) as { id: number; stripe_subscription_id: string | null; subscription_status: string | null } | undefined;
  if (!acct) throw new AccountDeletionError('account not found');

  if (acct.stripe_subscription_id && acct.subscription_status !== 'canceled' && config.billing.stripeSecretKey) {
    try {
      await cancelSubscriptionNow(acct.stripe_subscription_id);
    } catch (e) {
      throw new AccountDeletionError(
        `could not cancel the subscription, so nothing was deleted: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const mailboxIds = (db.prepare('SELECT id FROM mailboxes WHERE account_id = ?').all(accountId) as { id: number }[]).map((r) => r.id);
  const marks = mailboxIds.map(() => '?').join(',') || 'NULL';
  const rawPaths = (db.prepare(`SELECT raw_path FROM messages WHERE mailbox_id IN (${marks})`).all(...mailboxIds) as { raw_path: string }[]).map((r) => r.raw_path);
  const attPaths = (
    db
      .prepare(`SELECT a.path FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.mailbox_id IN (${marks})`)
      .all(...mailboxIds) as { path: string }[]
  ).map((r) => r.path);

  const result = runInTx(() => {
    const now = Date.now();
    db.prepare(
      `INSERT OR IGNORE INTO retired_addresses (address, retired_at)
       SELECT address, ? FROM mailboxes WHERE account_id = ?
       UNION SELECT a.address, ? FROM aliases a JOIN mailboxes m ON m.id = a.mailbox_id WHERE m.account_id = ?`,
    ).run(now, accountId, now, accountId);
    // Mailboxes cascade to messages (and their FTS rows and attachments), whitelist rules,
    // screener mutes, contacts, aliases (and reverse aliases), drafts and connections.
    const mailboxes = Number(db.prepare('DELETE FROM mailboxes WHERE account_id = ?').run(accountId).changes);
    // Domains are never deleted: the public signup domain is shared by every account, and
    // deleting its row would cascade to everyone's mailboxes and throw away the DKIM key
    // published in DNS. Hand them to the operator account instead.
    db.prepare('UPDATE domains SET account_id = ? WHERE account_id = ?').run(DEFAULT_ACCOUNT_ID, accountId);
    db.prepare('DELETE FROM outbound_events WHERE account_id = ?').run(accountId);
    // Users cascade to sessions, pairing codes and devices; audit rows keep a NULL user.
    const users = Number(db.prepare('DELETE FROM users WHERE account_id = ?').run(accountId).changes);
    // Accounts cascade to forward targets and connections.
    db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    return { mailboxes, users };
  });

  for (const p of rawPaths) deleteRaw(p);
  for (const p of attPaths) deleteAttachmentFile(p);
  return { ...result, messages: rawPaths.length };
}
