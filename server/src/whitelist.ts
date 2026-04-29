import { db } from './db.js';
import type { WhitelistRule } from './db.js';

export type WhitelistMatch = {
  rule: WhitelistRule;
  description: string;
};

export function rulesFor(mailboxId: number): WhitelistRule[] {
  return db
    .prepare('SELECT * FROM whitelist_rules WHERE mailbox_id = ? ORDER BY id')
    .all(mailboxId) as WhitelistRule[];
}

export function matchWhitelist(mailboxId: number, fromAddress: string): WhitelistMatch | null {
  const from = fromAddress.toLowerCase().trim();
  const fromDomain = from.includes('@') ? from.split('@')[1] : '';
  const rules = rulesFor(mailboxId);

  for (const rule of rules) {
    if (rule.kind === 'address' && rule.pattern.toLowerCase() === from) {
      return { rule, description: `address:${rule.pattern}` };
    }
    if (rule.kind === 'domain') {
      const dom = rule.pattern.toLowerCase().replace(/^@/, '');
      if (fromDomain === dom || fromDomain.endsWith('.' + dom)) {
        return { rule, description: `domain:${dom}` };
      }
    }
    if (rule.kind === 'regex') {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(from)) return { rule, description: `regex:${rule.pattern}` };
      } catch {
        // ignore bad regex
      }
    }
  }
  return null;
}
