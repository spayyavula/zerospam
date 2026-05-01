import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { hashPassword, getOwnerByEmail } from '../users.js';
import { createAccount } from '../accounts.js';
import { isValidUsername, isReserved, isUsernameAvailable } from '../usernames.js';
import { ensureDkim } from '../dkim.js';
import { signVerifyToken } from '../verify-token.js';
import { renderVerifyEmailHtml, renderVerifyEmailText } from '../verify-email-template.js';
import { sendMessage } from '../sender.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'password must be at least 12 characters'),
  username: z.string(),
});

export async function signupRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/signup', async (req, reply) => {
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
    const existingUser = getOwnerByEmail(email);
    if (existingUser) {
      return reply.code(409).send({ error: 'email already registered' });
    }

    // Check username availability (mailbox address uniqueness)
    if (!isUsernameAvailable(username, config.signupDomain)) {
      return reply.code(409).send({ error: 'username already taken' });
    }

    // Create account
    const account = createAccount(`account-${username}`);

    // Create user
    const passwordHash = await hashPassword(password);
    const userRow = db
      .prepare(
        `INSERT INTO users (email, password_hash, account_id, created_at)
         VALUES (?, ?, ?, ?) RETURNING id`,
      )
      .get(email.toLowerCase(), passwordHash, account.id, Date.now()) as { id: number };
    const userId = userRow.id;

    // Ensure domain + DKIM exist
    const domainRow = db
      .prepare(
        `INSERT INTO domains (name, created_at, account_id)
         VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET name = excluded.name
         RETURNING id`,
      )
      .get(config.signupDomain, Date.now(), account.id) as { id: number };
    ensureDkim(domainRow.id);

    // Create mailbox
    const address = `${username.toLowerCase()}@${config.signupDomain}`;
    const mailboxRow = db
      .prepare(
        `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, account_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(address, domainRow.id, username, 168, account.id, Date.now()) as { id: number };
    const mailboxId = mailboxRow.id;

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

    return reply.code(201).send({ userId, accountId: account.id });
  });
}
