import { beforeEach, afterAll } from 'vitest';
import { db } from '../src/db.js';
import { rmSync } from 'node:fs';
import { config } from '../src/config.js';

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
  `);
});

afterAll(() => {
  try {
    rmSync(config.dataDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
