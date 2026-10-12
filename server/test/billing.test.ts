import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';
import { startApi } from '../src/api.js';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { createAccount } from '../src/accounts.js';
import { ingest } from '../src/ingest.js';
import {
  addMonths,
  isEntitled,
  startPendingTrials,
  billingTick,
  setStripeClientForTests,
  type StripeApi,
} from '../src/billing.js';
import { seedMailbox } from './helpers.js';
import { makeSessionCookie } from './fixtures/owner.js';

const DAY = 86_400_000;
const sent = (): any[] => (globalThis as any).__sentMail;
const billing = config.billing as { -readonly [K in keyof typeof config.billing]: (typeof config.billing)[K] };
const defaults = { ...config.billing };
const WHSEC = 'whsec_test_secret_for_billing_tests';

function enableBilling() {
  Object.assign(billing, {
    enabled: true,
    stripeSecretKey: 'sk_test_x',
    stripeWebhookSecret: WHSEC,
    priceMonthly: 'price_monthly_1999',
    priceAnnual: 'price_annual_10000',
  });
}

type Calls = { customers: any[]; checkout: any[]; portal: any[] };
function stubStripe(): Calls {
  const calls: Calls = { customers: [], checkout: [], portal: [] };
  const api: StripeApi = {
    customers: { create: async (p) => (calls.customers.push(p), { id: `cus_${calls.customers.length}` }) },
    checkout: { sessions: { create: async (p) => (calls.checkout.push(p), { url: 'https://checkout.stripe.test/s/1' }) } },
    billingPortal: { sessions: { create: async (p) => (calls.portal.push(p), { url: 'https://billing.stripe.test/p/1' }) } },
  };
  setStripeClientForTests(api);
  return calls;
}

/** A paying-customer account (not the exempt operator account) with a verified user. */
function customer(email = 'pat@example.com', trialEndsAt: number | null = Date.now() + 60 * DAY) {
  const accountId = createAccount(`acct-${email}`).id;
  db.prepare('UPDATE accounts SET trial_ends_at = ? WHERE id = ?').run(trialEndsAt, accountId);
  const userId = (db
    .prepare(
      `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
       VALUES (?, 'x', ?, ?, ?) RETURNING id`,
    )
    .get(email, accountId, Date.now(), Date.now()) as { id: number }).id;
  return { accountId, userId, cookie: makeSessionCookie(userId) };
}

function acct(id: number) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
}

function signed(event: object) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  return { payload, header };
}

function subEvent(o: {
  id: string;
  type: string;
  accountId: number;
  status: string;
  price?: string;
  periodEnd?: number;
  created?: number;
  cancelAtPeriodEnd?: boolean;
}) {
  return {
    id: o.id,
    object: 'event',
    type: o.type,
    created: o.created ?? Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'sub_1',
        object: 'subscription',
        customer: 'cus_1',
        status: o.status,
        cancel_at_period_end: !!o.cancelAtPeriodEnd,
        metadata: { accountId: String(o.accountId) },
        items: { data: [{ price: { id: o.price ?? 'price_monthly_1999' }, current_period_end: o.periodEnd ?? 1_900_000_000 }] },
      },
    },
  };
}

beforeEach(() => {
  db.exec('DELETE FROM stripe_events');
});
afterEach(() => {
  Object.assign(billing, defaults);
  setStripeClientForTests(null);
});

describe('trial clock', () => {
  it('adds calendar months and clamps to the end of shorter months', () => {
    expect(new Date(addMonths(Date.UTC(2026, 10, 30), 3)).toISOString()).toBe('2027-02-28T00:00:00.000Z');
    expect(new Date(addMonths(Date.UTC(2027, 10, 30), 3)).toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(new Date(addMonths(Date.UTC(2026, 9, 12, 15), 3)).toISOString()).toBe('2027-01-12T15:00:00.000Z');
  });

  it('starts the trial at signup when billing is on, and not while it is off', () => {
    expect(acct(createAccount('off').id).trial_ends_at).toBeNull();
    enableBilling();
    const now = Date.now();
    const t = acct(createAccount('on').id).trial_ends_at;
    expect(t).toBeGreaterThan(now + 88 * DAY);
    expect(t).toBeLessThan(now + 93 * DAY);
  });

  it('starts every pending trial at launch, but never for exempt accounts', () => {
    const a = createAccount('existing').id; // created while billing was off: NULL clock
    enableBilling();
    const now = Date.UTC(2026, 9, 12);
    expect(startPendingTrials(now)).toBeGreaterThanOrEqual(1);
    expect(acct(a).trial_ends_at).toBe(Date.UTC(2027, 0, 12));
    expect(acct(1).trial_ends_at).toBeNull(); // operator's account is exempt
    expect(acct(0).trial_ends_at).toBeNull(); // system account is exempt
  });
});

describe('entitlement', () => {
  const base = {
    id: 9, trial_ends_at: null, billing_exempt: 0, stripe_customer_id: null, stripe_subscription_id: null,
    subscription_status: null, subscription_plan: null, current_period_end: null, cancel_at_period_end: 0,
    trial_reminder_sent_at: null, trial_ended_notice_sent_at: null,
  } as const;
  const now = Date.UTC(2027, 0, 1);

  it.each([
    ['billing disabled', { ...base, trial_ends_at: now - DAY }, false, true],
    ['in trial', { ...base, trial_ends_at: now + DAY }, true, true],
    ['trial ended, unpaid', { ...base, trial_ends_at: now - DAY }, true, false],
    ['trial ended, active', { ...base, trial_ends_at: now - DAY, subscription_status: 'active' }, true, true],
    ['trial ended, payment retrying', { ...base, trial_ends_at: now - DAY, subscription_status: 'past_due' }, true, true],
    ['trial ended, canceled', { ...base, trial_ends_at: now - DAY, subscription_status: 'canceled' }, true, false],
    ['trial ended, unpaid status', { ...base, trial_ends_at: now - DAY, subscription_status: 'unpaid' }, true, false],
    ['exempt', { ...base, trial_ends_at: now - DAY, billing_exempt: 1 }, true, true],
    ['clock not started yet', { ...base }, true, true],
  ])('%s', (_name, b, enabled, expected) => {
    expect(isEntitled(b as any, now, enabled as boolean)).toBe(expected);
  });
});

describe('paywall', () => {
  it('answers 402 on webmail routes for an unpaid account, but keeps auth and billing open', async () => {
    enableBilling();
    const app = await startApi();
    try {
      const { cookie } = customer('late@example.com', Date.now() - DAY);
      const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
      expect((await get('/api/mailboxes')).statusCode).toBe(402);
      expect((await get('/api/mailboxes')).json()).toEqual({ error: 'subscription_required' });
      expect((await get('/api/auth/me')).statusCode).toBe(200);
      const b = await get('/api/billing');
      expect(b.statusCode).toBe(200);
      expect(b.json()).toMatchObject({ enabled: true, entitled: false, trialDaysLeft: 0, subscribed: false });
    } finally {
      await app.close();
    }
  });

  it('does nothing while billing is disabled', async () => {
    const app = await startApi();
    try {
      const { cookie } = customer('early@example.com', Date.now() - DAY);
      expect((await app.inject({ method: 'GET', url: '/api/mailboxes', headers: { cookie } })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

describe('checkout and portal', () => {
  it('creates one Stripe customer, then Checkout for the plan, carrying the remaining trial', async () => {
    enableBilling();
    const calls = stubStripe();
    const app = await startApi();
    try {
      const trialEnd = Date.now() + 40 * DAY;
      const { cookie, accountId } = customer('pat@example.com', trialEnd);
      const post = (url: string, payload?: object) => app.inject({ method: 'POST', url, headers: { cookie }, payload });

      const r = await post('/api/billing/checkout', { plan: 'annual' });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ url: 'https://checkout.stripe.test/s/1' });
      expect(calls.customers).toEqual([{ email: 'pat@example.com', metadata: { accountId: String(accountId) } }]);
      const s = calls.checkout[0];
      expect(s).toMatchObject({
        mode: 'subscription',
        customer: 'cus_1',
        client_reference_id: String(accountId),
        line_items: [{ price: 'price_annual_10000', quantity: 1 }],
        success_url: 'http://localhost:8025/?billing=success',
      });
      expect(s.subscription_data.trial_end).toBe(Math.floor(trialEnd / 1000));

      await post('/api/billing/checkout', { plan: 'monthly' });
      expect(calls.customers).toHaveLength(1); // customer reused
      expect(calls.checkout[1].line_items[0].price).toBe('price_monthly_1999');

      expect((await post('/api/billing/checkout', { plan: 'weekly' })).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('charges immediately when less than 48h of trial remain (Stripe minimum)', async () => {
    enableBilling();
    const calls = stubStripe();
    const app = await startApi();
    try {
      const { cookie } = customer('soon@example.com', Date.now() + 24 * 3_600_000);
      await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: { cookie }, payload: { plan: 'monthly' } });
      expect(calls.checkout[0].subscription_data.trial_end).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('refuses a second subscription and sends subscribers to the portal instead', async () => {
    enableBilling();
    const calls = stubStripe();
    const app = await startApi();
    try {
      const { cookie, accountId } = customer('paid@example.com');
      const post = (url: string, payload?: object) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
      expect((await post('/api/billing/portal')).statusCode).toBe(409); // no customer yet
      db.prepare("UPDATE accounts SET stripe_customer_id = 'cus_9', subscription_status = 'active' WHERE id = ?").run(accountId);
      expect((await post('/api/billing/checkout', { plan: 'monthly' })).statusCode).toBe(409);
      const p = await post('/api/billing/portal');
      expect(p.json()).toEqual({ url: 'https://billing.stripe.test/p/1' });
      expect(calls.portal[0]).toEqual({ customer: 'cus_9', return_url: 'http://localhost:8025/?billing=portal' });
    } finally {
      await app.close();
    }
  });

  it('is unavailable while billing is disabled', async () => {
    stubStripe();
    const app = await startApi();
    try {
      const { cookie } = customer('x@example.com');
      const r = await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: { cookie }, payload: { plan: 'monthly' } });
      expect(r.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe('stripe webhook', () => {
  async function deliver(app: any, event: object, header?: string) {
    const { payload, header: h } = signed(event);
    return app.inject({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': header ?? h },
      payload,
    });
  }

  it('rejects unsigned or tampered events', async () => {
    enableBilling();
    const app = await startApi();
    try {
      const { accountId } = customer();
      const ev = subEvent({ id: 'evt_bad', type: 'customer.subscription.updated', accountId, status: 'active' });
      expect((await deliver(app, ev, 't=1,v1=deadbeef')).statusCode).toBe(400);
      const r = await app.inject({ method: 'POST', url: '/api/stripe/webhook', headers: { 'content-type': 'application/json' }, payload: JSON.stringify(ev) });
      expect(r.statusCode).toBe(400);
      expect(acct(accountId).subscription_status).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('links checkout, then mirrors the subscription; duplicates and stale events change nothing', async () => {
    enableBilling();
    const app = await startApi();
    try {
      const { accountId } = customer('sub@example.com', Date.now() - DAY); // trial over, unpaid
      expect(isEntitled(acct(accountId))).toBe(false);

      const done = await deliver(app, {
        id: 'evt_1', object: 'event', type: 'checkout.session.completed', created: 100,
        data: { object: { id: 'cs_1', object: 'checkout.session', client_reference_id: String(accountId), customer: 'cus_1', subscription: 'sub_1', metadata: {} } },
      });
      expect(done.json()).toMatchObject({ received: true, status: 'processed' });
      expect(acct(accountId)).toMatchObject({ stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });

      const active = subEvent({ id: 'evt_2', type: 'customer.subscription.updated', accountId, status: 'active', price: 'price_annual_10000', periodEnd: 1_900_000_000, created: 200 });
      expect((await deliver(app, active)).json().status).toBe('processed');
      expect(acct(accountId)).toMatchObject({ subscription_status: 'active', subscription_plan: 'annual', current_period_end: 1_900_000_000_000 });
      expect(isEntitled(acct(accountId))).toBe(true);

      expect((await deliver(app, active)).json().status).toBe('duplicate');

      // An older event delivered late must not roll the state back.
      const stale = subEvent({ id: 'evt_0', type: 'customer.subscription.updated', accountId, status: 'incomplete', created: 150 });
      await deliver(app, stale);
      expect(acct(accountId).subscription_status).toBe('active');

      const cancelled = subEvent({ id: 'evt_3', type: 'customer.subscription.deleted', accountId, status: 'canceled', created: 300 });
      await deliver(app, cancelled);
      expect(acct(accountId).subscription_status).toBe('canceled');
      expect(isEntitled(acct(accountId))).toBe(false);

      const other = await deliver(app, { id: 'evt_4', object: 'event', type: 'invoice.paid', created: 400, data: { object: {} } });
      expect(other.json().status).toBe('ignored');
    } finally {
      await app.close();
    }
  });
});

describe('trial reminders', () => {
  it('sends the 7-day reminder and the trial-ended notice once each, and nothing to subscribers', async () => {
    enableBilling();
    const now = Date.UTC(2027, 0, 10);
    const soon = customer('soon@example.com', now + 5 * DAY);
    const over = customer('over@example.com', now - DAY);
    const paid = customer('paid@example.com', now + 5 * DAY);
    db.prepare("UPDATE accounts SET subscription_status = 'active' WHERE id = ?").run(paid.accountId);
    customer('later@example.com', now + 30 * DAY);

    const r = await billingTick(now);
    expect(r.reminded).toEqual([soon.accountId]);
    expect(r.ended).toEqual([over.accountId]);
    const subjects = sent().map((m) => `${m.to}: ${m.subject}`);
    expect(subjects).toContain('soon@example.com: Your ZeroSpam free trial ends on January 15, 2027');
    expect(subjects).toContain('over@example.com: Your ZeroSpam free trial has ended');
    expect(sent()).toHaveLength(2);

    const again = await billingTick(now + 3_600_000);
    expect(again).toEqual({ reminded: [], ended: [] });
    expect(sent()).toHaveLength(2);
  });
});

describe('forwarding while unpaid', () => {
  it('stores alias mail instead of forwarding it once the trial has ended', async () => {
    enableBilling();
    const { accountId } = customer('fwd@example.com', Date.now() - DAY);
    const mailboxId = seedMailbox('me@zero-spam.email');
    db.prepare('UPDATE mailboxes SET account_id = ? WHERE id = ?').run(accountId, mailboxId);
    const target = (db
      .prepare(`INSERT INTO forward_targets (account_id, email, verified_at, created_at) VALUES (?, 'me@gmail.com', ?, ?) RETURNING id`)
      .get(accountId, Date.now(), Date.now()) as { id: number }).id;
    db.prepare(`INSERT INTO aliases (mailbox_id, address, created_at, mode, forward_target_id) VALUES (?, 'shop@zero-spam.email', ?, 'forward', ?)`)
      .run(mailboxId, Date.now(), target);
    db.prepare(`INSERT INTO whitelist_rules (mailbox_id, kind, pattern, created_at) VALUES (?, 'address', 'shop@store.com', ?)`).run(mailboxId, Date.now());

    const raw = Buffer.from('From: shop@store.com\r\nTo: shop@zero-spam.email\r\nSubject: Receipt\r\n\r\nThanks');
    const r = await ingest(raw, 'shop@zero-spam.email');
    expect(r?.folder).toBe('inbox');
    expect(r?.reason).toContain('forward-skipped:subscription-required');
    expect(sent()).toHaveLength(0);
  });
});
