import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { getOwnerById, verifyPassword } from '../users.js';
import { verifyStoredTotp } from '../totp.js';
import { recordAudit } from '../audit.js';
import { SESSION_COOKIE_NAME } from '../sessions.js';
import { sendMessage } from '../sender.js';
import { getOrCreateSystemMailboxId } from '../system-mailbox.js';
import { deleteAccount, AccountDeletionError } from '../account-deletion.js';

const deleteSchema = z.object({
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  // Permanently delete the caller's account. Re-authenticates with the password (and the
  // 2FA code when enabled) so a stolen session or phone alone can't destroy the account.
  app.post('/api/account/delete', {
    config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = (req as any).user?.id as number | undefined;
    const accountId = (req as any).account?.id as number | undefined;
    if (!userId || !accountId) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = deleteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'password required' });

    const user = getOwnerById(userId);
    if (!user || !(await verifyPassword(user.password_hash, parsed.data.password))) {
      return reply.code(403).send({ error: 'wrong password' });
    }
    if (user.totp_enabled_at) {
      if (!parsed.data.totp) return reply.code(403).send({ error: 'totp required' });
      if (!verifyStoredTotp(user.totp_secret, parsed.data.totp)) return reply.code(403).send({ error: 'wrong 2fa code' });
    }

    let result;
    try {
      result = await deleteAccount(accountId);
    } catch (e) {
      if (e instanceof AccountDeletionError) return reply.code(409).send({ error: e.message });
      throw e;
    }
    recordAudit({ event: 'account.delete', userId: null, detail: { accountId, ...result }, ip: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null });

    // Confirmation to the address they signed up with. Best-effort.
    void sendMessage({
      mailboxId: getOrCreateSystemMailboxId(),
      to: [user.email],
      subject: 'Your ZeroSpam account was deleted',
      text:
        'Your ZeroSpam account and everything in it — mailboxes, messages, aliases and settings — has been deleted.\n\n' +
        'Any subscription was cancelled and you will not be charged again.\n\n' +
        'If you did not do this, reply to this email right away.\n',
    }).catch((err) => app.log.warn({ err }, 'account deletion confirmation email failed'));

    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true, ...result };
  });
}
