import { beforeEach, afterAll, vi } from 'vitest';
import { db, DEFAULT_ACCOUNT_ID, SYSTEM_ACCOUNT_ID } from '../src/db.js';
import { rmSync } from 'node:fs';
import { config } from '../src/config.js';

// Stub nodemailer so outbound delivery tests don't need a real SMTP server.
// Resolves transport.sendMail() without touching the network; sendMessage()
// still does its DB writes and trust-on-send whitelist work as in production.
// Every sendMail() call is recorded on globalThis.__sentMail (cleared before each test) so
// alias forwarding / reverse-reply tests can assert on what would have gone out.
// Set globalThis.__failNextSend = true to make the next sendMail() reject.
// Resolved at call time, not captured: with isolate:false the mocked module is cached across
// test files, so a closure over a per-file array would go stale after the first file.
const sentMail = vi.hoisted(() => {
  const g = globalThis as any;
  g.__sentMail ??= [];
  return g.__sentMail as any[];
});
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (opts: any) => {
        if ((globalThis as any).__failNextSend) {
          (globalThis as any).__failNextSend = false;
          throw new Error('relay down (test)');
        }
        (globalThis as any).__sentMail.push(opts);
        return { messageId: 'test', envelope: {}, response: 'ok' };
      },
    }),
  },
}));

// Keep this list in sync with the CREATE TABLE statements in db.ts.
beforeEach(() => {
  sentMail.length = 0;
  (globalThis as any).__failNextSend = false;
  db.exec(`
    DELETE FROM connections;
    DELETE FROM messages_fts;
    DELETE FROM messages;
    DELETE FROM attachments;
    DELETE FROM contacts;
    DELETE FROM whitelist_rules;
    DELETE FROM screener_mutes;
    DELETE FROM aliases;
    DELETE FROM reverse_aliases;
    DELETE FROM outbound_events;
    DELETE FROM forward_targets;
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
    DELETE FROM stripe_events;
    DELETE FROM otp_codes;
  `);
});

afterAll(() => {
  try {
    rmSync(config.dataDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
