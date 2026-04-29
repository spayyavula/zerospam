import { beforeEach, afterAll } from 'vitest';
import { db } from '../src/db.js';
import { rmSync } from 'node:fs';
import { config } from '../src/config.js';

beforeEach(() => {
  db.exec(`
    DELETE FROM messages_fts;
    DELETE FROM messages;
    DELETE FROM attachments;
    DELETE FROM whitelist_rules;
    DELETE FROM aliases;
    DELETE FROM drafts;
    DELETE FROM mailboxes;
    DELETE FROM domains;
  `);
});

afterAll(() => {
  try {
    rmSync(config.dataDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
