import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, runInTx } from '../db.js';
import { config } from '../config.js';
import { hashPassword } from '../users.js';
import { createAccount } from '../accounts.js';
import { isValidUsername, isReserved, isUsernameAvailable } from '../usernames.js';
import { ensureDkim } from '../dkim.js';
import { signVerifyToken, verifyVerifyToken } from '../verify-token.js';
import { renderVerifyEmailHtml, renderVerifyEmailText } from '../verify-email-template.js';
import { sendMessage } from '../sender.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'password must be at least 12 characters'),
  username: z.string(),
});

export async function signupRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/signup', {
    config: { rateLimit: { max: config.rateLimitSignupPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    // Guard: PUBLIC_BASE_URL required so verify URL is absolute
    if (!config.publicBaseUrl) {
      return reply.code(503).send({ error: 'signup unavailable: PUBLIC_BASE_URL not configured' });
    }

    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      // Surface password error distinctly so tests can match on "password"
      const msg = firstIssue.message.toLowerCase().includes('password')
        ? firstIssue.message
        : `invalid body: ${firstIssue.message}`;
      return reply.code(400).send({ error: msg });
    }

    const { email, password, username } = parsed.data;

    // Validate username format
    if (!isValidUsername(username)) {
      return reply.code(400).send({ error: 'invalid username: must be 3-32 lowercase alphanumeric chars (._- allowed, not at start/end or consecutive)' });
    }
    if (isReserved(username)) {
      return reply.code(400).send({ error: 'invalid username: this username is reserved' });
    }

    // Check email uniqueness
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase()) as { id: number } | undefined;
    if (existingUser) {
      return reply.code(409).send({ error: 'email already registered' });
    }

    // Check username availability (mailbox address uniqueness)
    if (!isUsernameAvailable(username, config.signupDomain)) {
      return reply.code(409).send({ error: 'username already taken' });
    }

    // Hash password BEFORE transaction (async; better-sqlite3 transactions are sync)
    const passwordHash = await hashPassword(password);

    // Wrap all 4 DB writes in a transaction so no orphaned rows on partial failure
    let userId: number, accountId: number, mailboxId: number, domainId: number;
    try {
      ({ userId, accountId, mailboxId, domainId } = runInTx(() => {
        const account = createAccount(`account-${username}`);
        const userRow = db
          .prepare(
            `INSERT INTO users (email, password_hash, account_id, created_at)
             VALUES (?, ?, ?, ?) RETURNING id`,
          )
          .get(email.toLowerCase(), passwordHash, account.id, Date.now()) as { id: number };
        const domainRow = db
          .prepare(
            `INSERT INTO domains (name, created_at, account_id)
             VALUES (?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET name = excluded.name
             RETURNING id`,
          )
          .get(config.signupDomain, Date.now(), account.id) as { id: number };
        const address = `${username.toLowerCase()}@${config.signupDomain}`;
        const mailboxRow = db
          .prepare(
            `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, account_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
          )
          .get(address, domainRow.id, null, config.quarantineTtlHours, account.id, Date.now()) as { id: number };
        return { userId: userRow.id, accountId: account.id, mailboxId: mailboxRow.id, domainId: domainRow.id };
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE constraint failed: users\.email/.test(msg)) {
        return reply.code(409).send({ error: 'email already registered' });
      }
      if (/UNIQUE constraint failed: mailboxes\.address/.test(msg)) {
        return reply.code(409).send({ error: 'username already taken' });
      }
      app.log.error({ err: e }, 'signup: unexpected db error');
      return reply.code(500).send({ error: 'signup failed' });
    }

    // ensureDkim and email dispatch run AFTER commit
    ensureDkim(domainId);

    // Sign verify token
    const expiresAt = Date.now() + config.verifyTokenExpiryHours * 60 * 60 * 1000;
    const token = signVerifyToken(
      { v: 1, userId, exp: expiresAt },
      config.sessionSecret,
    );
    const verifyUrl = `${config.publicBaseUrl}/auth/verify?t=${token}`;

    // Dispatch verification email (best-effort — don't fail signup if mail fails)
    try {
      await sendMessage({
        mailboxId,
        to: [email],
        subject: 'Please verify your email — ZeroSpam',
        text: renderVerifyEmailText({ username, verifyUrl, expiresHours: config.verifyTokenExpiryHours }),
        html: renderVerifyEmailHtml({ username, verifyUrl, expiresHours: config.verifyTokenExpiryHours }),
      });
    } catch (e) {
      app.log.warn({ err: e }, 'signup: verification email dispatch failed');
    }

    return reply.code(201).send({ userId, accountId });
  });

  app.get('/auth/verify', async (req, reply) => {
    const t = (req.query as { t?: string }).t ?? '';
    const payload = verifyVerifyToken(t, config.sessionSecret, Date.now());
    if (!payload) {
      reply.type('text/html');
      return renderVerifyResultHtml({ ok: false });
    }
    const user = db
      .prepare('SELECT id, email_verified_at FROM users WHERE id = ?')
      .get(payload.userId) as { id: number; email_verified_at: number | null } | undefined;
    if (!user) {
      reply.type('text/html');
      return renderVerifyResultHtml({ ok: false });
    }
    if (!user.email_verified_at) {
      db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(Date.now(), user.id);
    }
    reply.type('text/html');
    return renderVerifyResultHtml({ ok: true });
  });
}

function renderVerifyResultHtml(args: { ok: boolean }): string {
  if (args.ok) {
    return `<!doctype html><html><body style="font-family:sans-serif;padding:48px;text-align:center;">
<h1>Email verified.</h1><p>You can now log in.</p>
</body></html>`;
  }
  return `<!doctype html><html><body style="font-family:sans-serif;padding:48px;text-align:center;">
<h1>This link is expired or invalid.</h1><p>Sign up again or contact support.</p>
</body></html>`;
}
