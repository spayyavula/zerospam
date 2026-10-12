import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import {
  BillingError,
  billingSummary,
  createCheckoutSession,
  createPortalSession,
  handleStripeWebhook,
} from '../billing.js';

function sendBillingError(reply: any, e: unknown) {
  if (e instanceof BillingError) return reply.code(e.status).send({ error: e.message });
  throw e;
}

const checkoutIn = z.object({ plan: z.enum(['monthly', 'annual']) });

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/billing', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    return billingSummary(accountId);
  });

  app.post('/api/billing/checkout', async (req, reply) => {
    const accountId = (req as any).account?.id;
    const userId = (req as any).user?.id;
    if (!accountId || !userId) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = checkoutIn.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'plan must be "monthly" or "annual"' });
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      return await createCheckoutSession(accountId, parsed.data.plan, user.email);
    } catch (e) {
      return sendBillingError(reply, e);
    }
  });

  app.post('/api/billing/portal', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    try {
      return await createPortalSession(accountId);
    } catch (e) {
      return sendBillingError(reply, e);
    }
  });

  // Stripe webhook. Public (authorized by the Stripe-Signature HMAC) and needs the exact
  // raw bytes to verify, so JSON parsing is replaced with a Buffer parser in this scope only.
  await app.register(async (scoped) => {
    scoped.removeContentTypeParser('application/json');
    scoped.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    scoped.post('/api/stripe/webhook', async (req, reply) => {
      const raw = req.body;
      if (!Buffer.isBuffer(raw)) return reply.code(400).send({ error: 'expected a JSON body' });
      try {
        const result = handleStripeWebhook(raw, req.headers['stripe-signature'] as string | undefined);
        if (result.status === 'unmatched') {
          req.log.warn({ type: result.type }, 'stripe webhook did not match any account');
        }
        return { received: true, ...result };
      } catch (e) {
        return sendBillingError(reply, e);
      }
    });
  });
}
