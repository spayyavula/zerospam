import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, runInTx } from '../db.js';
import { bus } from '../events.js';
import { FREE_MAIL_DOMAINS } from '../screener-domains.js';
import { listScreenerSenders } from '../screener.js';

function domainOf(addr: string): string {
  const at = addr.lastIndexOf('@');
  if (at < 0) return '';
  return addr.slice(at + 1).toLowerCase();
}

function ownsMailbox(accountId: number, mailboxId: number): boolean {
  const row = db
    .prepare('SELECT 1 FROM mailboxes WHERE id = ? AND account_id = ?')
    .get(mailboxId, accountId);
  return !!row;
}

const mailboxQuerySchema = z.object({ mailbox_id: z.coerce.number() });

const allowSchema = z.object({
  mailbox_id: z.coerce.number(),
  sender_address: z.string().email(),
});

const allowDomainSchema = z.object({
  mailbox_id: z.coerce.number(),
  domain: z.string().min(1),
});

const rejectSchema = z.object({
  mailbox_id: z.coerce.number(),
  sender_address: z.string().email(),
});

export async function screenerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/screener', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });

    const { mailbox_id } = mailboxQuerySchema.parse(req.query);
    if (!ownsMailbox(accountId, mailbox_id)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }

    return listScreenerSenders(mailbox_id);
  });

  app.post('/api/screener/allow', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });

    const body = allowSchema.parse(req.body);
    if (!ownsMailbox(accountId, body.mailbox_id)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }

    const sender = body.sender_address.toLowerCase().trim();
    const now = Date.now();
    const dom = domainOf(sender);

    const result = runInTx(() => {
      const existing = db
        .prepare('SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?')
        .get(body.mailbox_id, 'address', sender) as { id: number } | undefined;
      const ruleId = existing
        ? existing.id
        : (db
            .prepare(
              `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at)
               VALUES (?, ?, ?, ?, ?) RETURNING id`,
            )
            .get(body.mailbox_id, 'address', sender, 'screener:allow', now) as { id: number }).id;

      const moved = db
        .prepare(
          `UPDATE messages
           SET folder = 'inbox', expires_at = NULL
           WHERE mailbox_id = ? AND from_address = ? AND folder = 'quarantine'`,
        )
        .run(body.mailbox_id, sender).changes;

      return { moved, ruleId };
    });

    bus.publish({ type: 'whitelist:changed', mailboxId: body.mailbox_id });
    bus.publish({ type: 'screener:changed', mailboxId: body.mailbox_id });

    return {
      moved: result.moved,
      rule_id: result.ruleId,
      sender_address: sender,
      domain: dom,
      suggest_domain_expand: dom !== '' && !FREE_MAIL_DOMAINS.has(dom),
    };
  });

  app.post('/api/screener/allow-domain', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });

    const body = allowDomainSchema.parse(req.body);
    if (!ownsMailbox(accountId, body.mailbox_id)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }

    const domain = body.domain.toLowerCase().trim().replace(/^@/, '');
    if (FREE_MAIL_DOMAINS.has(domain)) {
      return reply.code(422).send({ error: 'domain not allowed for expansion' });
    }

    const now = Date.now();
    const result = runInTx(() => {
      const existing = db
        .prepare('SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?')
        .get(body.mailbox_id, 'domain', domain) as { id: number } | undefined;
      const ruleId = existing
        ? existing.id
        : (db
            .prepare(
              `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at)
               VALUES (?, ?, ?, ?, ?) RETURNING id`,
            )
            .get(body.mailbox_id, 'domain', domain, 'screener:allow-domain', now) as {
            id: number;
          }).id;

      const moved = db
        .prepare(
          `UPDATE messages
           SET folder = 'inbox', expires_at = NULL
           WHERE mailbox_id = ?
             AND folder = 'quarantine'
             AND lower(from_address) LIKE ?`,
        )
        .run(body.mailbox_id, `%@${domain}`).changes;

      return { moved, ruleId };
    });

    bus.publish({ type: 'whitelist:changed', mailboxId: body.mailbox_id });
    bus.publish({ type: 'screener:changed', mailboxId: body.mailbox_id });

    return { moved: result.moved, rule_id: result.ruleId };
  });

  app.post('/api/screener/reject', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });

    const body = rejectSchema.parse(req.body);
    if (!ownsMailbox(accountId, body.mailbox_id)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }

    const sender = body.sender_address.toLowerCase().trim();
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 3600 * 1000;

    const result = runInTx(() => {
      const trashed = db
        .prepare(
          `UPDATE messages
           SET folder = 'trash', expires_at = NULL
           WHERE mailbox_id = ? AND from_address = ? AND folder = 'quarantine'`,
        )
        .run(body.mailbox_id, sender).changes;

      db.prepare(
        `INSERT OR REPLACE INTO screener_mutes (mailbox_id, sender_addr, muted_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      ).run(body.mailbox_id, sender, now, now + thirtyDaysMs);

      return { trashed };
    });

    bus.publish({ type: 'screener:changed', mailboxId: body.mailbox_id });
    return { trashed: result.trashed };
  });
}
