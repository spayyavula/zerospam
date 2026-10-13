// Stripe billing: free trial clock, entitlement, Checkout / Customer Portal, webhooks,
// and trial reminder emails. Design: docs/superpowers/specs/2026-10-12-stripe-billing-design.md
//
// Stripe is the source of truth for paid status and reaches us only through signed
// webhooks. We never see card data: payment happens on Stripe-hosted pages.

import Stripe from 'stripe';
import { db } from './db.js';
import type { AccountBilling } from './db.js';
import { config } from './config.js';
import { sendMessage } from './sender.js';
import { getOrCreateSystemMailboxId } from './system-mailbox.js';

export type Plan = 'monthly' | 'annual';

const DAY = 86_400_000;
/** Stripe refuses a Checkout trial_end less than 48 hours in the future. */
const MIN_CHECKOUT_TRIAL_MS = 48 * 3_600_000;
/** Statuses that keep an account entitled. past_due = Stripe is still retrying payment. */
const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

export class BillingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Stripe client (injectable for tests)
// ---------------------------------------------------------------------------

/** The subset of the Stripe client we call. Tests swap in a stub. */
export type StripeApi = {
  customers: { create(params: Stripe.CustomerCreateParams): Promise<{ id: string }> };
  checkout: { sessions: { create(params: Stripe.Checkout.SessionCreateParams): Promise<{ url: string | null }> } };
  billingPortal: {
    sessions: { create(params: Stripe.BillingPortal.SessionCreateParams): Promise<{ url: string }> };
  };
  subscriptions: { cancel(id: string): Promise<unknown> };
};

/** Stop billing immediately (account deletion). Throws if Stripe refuses. */
export async function cancelSubscriptionNow(subscriptionId: string): Promise<void> {
  await stripe().subscriptions.cancel(subscriptionId);
}

let client: StripeApi | null = null;

function stripe(): StripeApi {
  if (!client) client = new Stripe(config.billing.stripeSecretKey) as unknown as StripeApi;
  return client;
}

export function setStripeClientForTests(c: StripeApi | null): void {
  client = c;
}

// ---------------------------------------------------------------------------
// Trial clock
// ---------------------------------------------------------------------------

/** Add calendar months in UTC, clamping to the last day (Nov 30 + 3 months = Feb 28/29). */
export function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.getTime();
}

/** Trial end for an account created now: null while billing is off (clock starts at launch). */
export function newAccountTrialEnd(now = Date.now()): number | null {
  return config.billing.enabled ? addMonths(now, config.billing.trialMonths) : null;
}

/**
 * "Trial starts at launch": every non-exempt account without a trial clock (existing
 * accounts, or ones created while billing was off) gets trialMonths from now.
 */
export function startPendingTrials(now = Date.now()): number {
  const r = db
    .prepare('UPDATE accounts SET trial_ends_at = ? WHERE trial_ends_at IS NULL AND billing_exempt = 0')
    .run(addMonths(now, config.billing.trialMonths));
  return Number(r.changes);
}

// ---------------------------------------------------------------------------
// Entitlement
// ---------------------------------------------------------------------------

const selectBilling = db.prepare(
  `SELECT id, trial_ends_at, billing_exempt, stripe_customer_id, stripe_subscription_id,
          subscription_status, subscription_plan, current_period_end, cancel_at_period_end,
          trial_reminder_sent_at, trial_ended_notice_sent_at
   FROM accounts WHERE id = ?`,
);

export function getAccountBilling(accountId: number): AccountBilling | undefined {
  return selectBilling.get(accountId) as AccountBilling | undefined;
}

export function isSubscribed(b: Pick<AccountBilling, 'subscription_status'>): boolean {
  return !!b.subscription_status && PAID_STATUSES.has(b.subscription_status);
}

/** Pure entitlement rule (spec §5). */
export function isEntitled(b: AccountBilling | undefined, now = Date.now(), enabled = config.billing.enabled): boolean {
  if (!enabled) return true;
  if (!b) return false;
  if (b.billing_exempt) return true;
  if (isSubscribed(b)) return true;
  // A NULL trial clock means billing just went live and the boot backfill hasn't
  // reached this account yet: treat as in trial rather than paywalling.
  if (b.trial_ends_at == null) return true;
  return now < b.trial_ends_at;
}

export function isAccountEntitled(accountId: number, now = Date.now()): boolean {
  return isEntitled(getAccountBilling(accountId), now);
}

export function billingSummary(accountId: number, now = Date.now()) {
  const b = getAccountBilling(accountId);
  const trialEndsAt = b?.trial_ends_at ?? null;
  return {
    enabled: config.billing.enabled,
    entitled: isEntitled(b, now),
    exempt: !!b?.billing_exempt,
    subscribed: !!b && isSubscribed(b),
    status: b?.subscription_status ?? null,
    plan: b?.subscription_plan ?? null,
    trialEndsAt,
    trialDaysLeft: trialEndsAt == null ? null : Math.max(0, Math.ceil((trialEndsAt - now) / DAY)),
    currentPeriodEnd: b?.current_period_end ?? null,
    cancelAtPeriodEnd: !!b?.cancel_at_period_end,
    hasBillingAccount: !!b?.stripe_customer_id,
  };
}

// ---------------------------------------------------------------------------
// Checkout and Customer Portal
// ---------------------------------------------------------------------------

function priceFor(plan: Plan): string {
  return plan === 'monthly' ? config.billing.priceMonthly : config.billing.priceAnnual;
}

function planForPrice(priceId: string | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === config.billing.priceMonthly) return 'monthly';
  if (priceId === config.billing.priceAnnual) return 'annual';
  return null;
}

function requireEnabled() {
  if (!config.billing.enabled) throw new BillingError('billing is not enabled', 404);
}

async function ensureCustomer(accountId: number, email: string): Promise<string> {
  const b = getAccountBilling(accountId);
  if (!b) throw new BillingError('account not found', 404);
  if (b.stripe_customer_id) return b.stripe_customer_id;
  const customer = await stripe().customers.create({ email, metadata: { accountId: String(accountId) } });
  db.prepare('UPDATE accounts SET stripe_customer_id = ? WHERE id = ?').run(customer.id, accountId);
  return customer.id;
}

export async function createCheckoutSession(
  accountId: number,
  plan: Plan,
  email: string,
  now = Date.now(),
): Promise<{ url: string }> {
  requireEnabled();
  const b = getAccountBilling(accountId);
  if (!b) throw new BillingError('account not found', 404);
  if (b.billing_exempt) throw new BillingError('this account is not billed', 409);
  if (isSubscribed(b)) throw new BillingError('already subscribed; manage it from billing settings', 409);

  const customer = await ensureCustomer(accountId, email);
  const base = config.publicBaseUrl;
  // Subscribing early must not forfeit free time: carry the remaining trial into
  // Stripe so the first charge lands when the trial ends.
  const trialEnd = b.trial_ends_at != null && b.trial_ends_at - now > MIN_CHECKOUT_TRIAL_MS ? b.trial_ends_at : null;

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: String(accountId),
    line_items: [{ price: priceFor(plan), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/?billing=success`,
    cancel_url: `${base}/?billing=cancel`,
    metadata: { accountId: String(accountId) },
    subscription_data: {
      metadata: { accountId: String(accountId) },
      ...(trialEnd ? { trial_end: Math.floor(trialEnd / 1000) } : {}),
    },
  });
  if (!session.url) throw new BillingError('Stripe did not return a checkout URL', 502);
  return { url: session.url };
}

export async function createPortalSession(accountId: number): Promise<{ url: string }> {
  requireEnabled();
  const b = getAccountBilling(accountId);
  if (!b?.stripe_customer_id) throw new BillingError('no billing account yet; choose a plan first', 409);
  const session = await stripe().billingPortal.sessions.create({
    customer: b.stripe_customer_id,
    return_url: `${config.publicBaseUrl}/?billing=portal`,
  });
  return { url: session.url };
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export type WebhookResult = { status: 'processed' | 'duplicate' | 'ignored' | 'unmatched'; type: string };

function accountIdFrom(meta: Stripe.Metadata | null | undefined, customerId: string | null): number | null {
  const fromMeta = Number(meta?.accountId);
  if (Number.isInteger(fromMeta) && fromMeta > 0 && getAccountBilling(fromMeta)) return fromMeta;
  if (customerId) {
    const r = db.prepare('SELECT id FROM accounts WHERE stripe_customer_id = ?').get(customerId) as
      | { id: number }
      | undefined;
    if (r) return r.id;
  }
  return null;
}

function idOf(x: string | { id: string } | null | undefined): string | null {
  if (!x) return null;
  return typeof x === 'string' ? x : x.id;
}

function syncSubscription(sub: Stripe.Subscription, eventCreatedSec: number, deleted: boolean): boolean {
  const customerId = idOf(sub.customer as string | { id: string });
  const accountId = accountIdFrom(sub.metadata, customerId);
  if (!accountId) return false;
  const item = sub.items?.data?.[0];
  // API 2026-09-30: the billing period lives on the subscription item.
  const periodEnd = item?.current_period_end ? item.current_period_end * 1000 : null;
  const plan = planForPrice(item?.price?.id);
  const eventAt = eventCreatedSec * 1000;
  // Stripe doesn't guarantee delivery order: never let an older event overwrite newer state.
  const r = db
    .prepare(
      `UPDATE accounts SET
         stripe_customer_id = COALESCE(stripe_customer_id, ?),
         stripe_subscription_id = ?,
         subscription_status = ?,
         subscription_plan = COALESCE(?, subscription_plan),
         current_period_end = ?,
         cancel_at_period_end = ?,
         subscription_updated_at = ?
       WHERE id = ? AND (subscription_updated_at IS NULL OR subscription_updated_at <= ?)`,
    )
    .run(
      customerId,
      sub.id,
      deleted ? 'canceled' : sub.status,
      plan,
      periodEnd,
      sub.cancel_at_period_end ? 1 : 0,
      eventAt,
      accountId,
      eventAt,
    );
  // Matched the account. 0 changes just means this event was older than stored state.
  void r;
  return true;
}

/**
 * Verify and apply a Stripe webhook. Throws on a bad signature (caller answers 400).
 * Idempotent: each event id is applied at most once.
 */
export function handleStripeWebhook(rawBody: Buffer, signature: string | undefined): WebhookResult {
  if (!signature) throw new BillingError('missing Stripe-Signature header', 400);
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, signature, config.billing.stripeWebhookSecret);
  } catch {
    throw new BillingError('invalid Stripe signature', 400);
  }

  const claim = db
    .prepare('INSERT OR IGNORE INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)')
    .run(event.id, event.type, Date.now());
  if (Number(claim.changes) === 0) return { status: 'duplicate', type: event.type };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const accountId = accountIdFrom({ accountId: s.client_reference_id ?? s.metadata?.accountId ?? '' }, idOf(s.customer as any));
        if (!accountId) return { status: 'unmatched', type: event.type };
        db.prepare(
          `UPDATE accounts SET stripe_customer_id = COALESCE(?, stripe_customer_id),
                               stripe_subscription_id = COALESCE(?, stripe_subscription_id)
           WHERE id = ?`,
        ).run(idOf(s.customer as any), idOf(s.subscription as any), accountId);
        return { status: 'processed', type: event.type };
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const matched = syncSubscription(
          event.data.object as Stripe.Subscription,
          event.created,
          event.type === 'customer.subscription.deleted',
        );
        if (!matched) return { status: 'unmatched', type: event.type };
        return { status: 'processed', type: event.type };
      }
      default:
        return { status: 'ignored', type: event.type };
    }
  } catch (err) {
    // Let Stripe retry: forget the claim so the redelivery is processed.
    db.prepare('DELETE FROM stripe_events WHERE id = ?').run(event.id);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Trial reminder emails
// ---------------------------------------------------------------------------

const REMINDER_LEAD_DAYS = 7;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function accountEmails(accountId: number): string[] {
  return (
    db
      .prepare('SELECT email FROM users WHERE account_id = ? AND email_verified_at IS NOT NULL')
      .all(accountId) as { email: string }[]
  ).map((r) => r.email);
}

async function notify(accountId: number, subject: string, lines: string[]): Promise<void> {
  const to = accountEmails(accountId);
  if (!to.length) return;
  await sendMessage({
    mailboxId: getOrCreateSystemMailboxId(),
    to,
    subject,
    text: [...lines, '', '— Zero·Spam'].join('\n'),
  });
}

/** Send due trial reminders. Each is sent once per account (guarded by *_sent_at). */
export async function billingTick(now = Date.now()): Promise<{ reminded: number[]; ended: number[] }> {
  const reminded: number[] = [];
  const ended: number[] = [];
  if (!config.billing.enabled) return { reminded, ended };
  const link = `${config.publicBaseUrl}/?billing=choose`;
  const candidates = db
    .prepare(
      `SELECT id, trial_ends_at, subscription_status, trial_reminder_sent_at, trial_ended_notice_sent_at
       FROM accounts
       WHERE billing_exempt = 0 AND trial_ends_at IS NOT NULL
         AND (trial_reminder_sent_at IS NULL OR trial_ended_notice_sent_at IS NULL)`,
    )
    .all() as Array<Pick<AccountBilling, 'id' | 'trial_ends_at' | 'subscription_status' | 'trial_reminder_sent_at' | 'trial_ended_notice_sent_at'>>;

  for (const a of candidates) {
    if (isSubscribed(a)) continue;
    const end = a.trial_ends_at!;
    try {
      if (now >= end && !a.trial_ended_notice_sent_at) {
        await notify(a.id, 'Your ZeroSpam free trial has ended', [
          'Your free trial has ended. Your mail is safe: it is still arriving and nothing has been deleted.',
          '',
          'To read it and keep everything working, choose a plan:',
          '',
          `   ${link}`,
          '',
          '$19.99 a month, or $100 a year.',
        ]);
        // Mark both so a late tick doesn't also send the 7-day reminder.
        db.prepare(
          'UPDATE accounts SET trial_ended_notice_sent_at = ?, trial_reminder_sent_at = COALESCE(trial_reminder_sent_at, ?) WHERE id = ?',
        ).run(now, now, a.id);
        ended.push(a.id);
      } else if (now < end && end - now <= REMINDER_LEAD_DAYS * DAY && !a.trial_reminder_sent_at) {
        await notify(a.id, `Your ZeroSpam free trial ends on ${formatDate(end)}`, [
          `Your free trial ends on ${formatDate(end)}.`,
          '',
          'Choose a plan now and nothing changes. You won’t be charged until the trial ends:',
          '',
          `   ${link}`,
          '',
          '$19.99 a month, or $100 a year.',
        ]);
        db.prepare('UPDATE accounts SET trial_reminder_sent_at = ? WHERE id = ?').run(now, a.id);
        reminded.push(a.id);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[billing] reminder failed for account', a.id, err);
    }
  }
  return { reminded, ended };
}

export function startBillingTicker(): () => void {
  if (!config.billing.enabled) return () => {};
  const run = () => {
    billingTick().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[billing] tick failed', err);
    });
  };
  run();
  const t = setInterval(run, config.billing.reminderTickSec * 1000);
  return () => clearInterval(t);
}
