import { beforeEach, afterAll, vi } from 'vitest';
import { db, DEFAULT_ACCOUNT_ID, SYSTEM_ACCOUNT_ID } from '../src/db.js';
import { rmSync } from 'node:fs';
import { config } from '../src/config.js';

// Stub nodemailer so outbound delivery tests don't need a real SMTP server.
// Resolves transport.sendMail() without touching the network; sendMessage()
// still does its DB writes and trust-on-send whitelist work as in production.
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async () => ({ messageId: 'test', envelope: {}, response: 'ok' }),
    }),
  },
}));

// Keep this list in sync with the CREATE TABLE statements in db.ts.
beforeEach(() => {
  db.exec(`
    DELETE FROM messages_fts;
    DELETE FROM messages;
    DELETE FROM attachments;
    DELETE FROM contacts;
    DELETE FROM whitelist_rules;
    DELETE FROM aliases;
    DELETE FROM drafts;
    DELETE FROM mailboxes;
    DELETE FROM domains;
    DELETE FROM audit_log;
    DELETE FROM pairing_codes;
    DELETE FROM devices;
    DELETE FROM sessions;
    DELETE FROM users;
    DELETE FROM accounts WHERE id NOT IN (${DEFAULT_ACCOUNT_ID}, ${SYSTEM_ACCOUNT_ID});
    DELETE FROM digest_tokens_used;
  `);
});

afterAll(() => {
  try {
    rmSync(config.dataDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
