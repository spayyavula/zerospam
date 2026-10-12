# Stripe Billing: 3-Month Free Trial, Then $19.99/mo or $100/yr — Design Spec

**Date:** 2026-10-12
**Status:** Implemented on `feat/stripe-billing`
**Pricing source of truth:** `web/src/components/landing/Pricing.tsx` (`PRICING`) for display; Stripe Prices for charging.

---

## 1. Decisions (from the product owner)

| Question | Decision |
|---|---|
| Card to start the trial? | **No.** The trial starts at signup without payment details. People subscribe through Stripe Checkout whenever they choose. |
| Trial ends unpaid | **The webmail shows a paywall, and mail keeps arriving.** Inbound mail is still received and stored. Nothing is lost while they decide. |
| Existing accounts | **The trial starts at launch.** Accounts that exist when billing is switched on get 3 months from that moment. |
| Plans | **Monthly at $19.99, or annual at $100.** Both include everything. |

## 2. Goals

- Billing ships *disabled* (`BILLING_ENABLED=false`) so it can be deployed before Stripe is configured. While disabled, everyone is entitled and no trial clock runs.
- Stripe is the source of truth for paid status, which reaches ZeroSpam only through **signed webhooks**. ZeroSpam never handles card data, because payment happens on Stripe's hosted Checkout and Customer Portal pages.
- Subscribing during the trial **does not forfeit the remaining free time**. Checkout sets `subscription_data.trial_end` to the account's trial end, so the first charge happens when the trial ends.
- Mail is never lost because of billing. Unpaid accounts keep receiving mail. Alias forwarding pauses and falls back to storing, using the existing fallback.

## 3. Non-Goals (v1)

- Card-up-front trials, coupons UI (Stripe promotion codes are allowed in Checkout), per-seat pricing, taxes (enable Stripe Tax in the dashboard if needed).
- Mobile app paywall screens. The mobile API returns `402 subscription_required`, and the screens are a follow-up.
- Changing the Terms of Service. Billing terms (renewal, cancellation, refunds) are a business and legal decision and must be added before `BILLING_ENABLED=true`.

## 4. Data model

New columns on `accounts`, added idempotently:

| Column | Meaning |
|---|---|
| `trial_ends_at` | ms epoch. `NULL` means the trial has not started yet (billing is off, or the account predates launch). |
| `billing_exempt` | 1 for the system account (0) and the operator's default account (1). Exempt accounts are never paywalled. |
| `stripe_customer_id`, `stripe_subscription_id` | Links to the Stripe customer and subscription. |
| `subscription_status` | The Stripe status as received: `active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, and so on. |
| `subscription_plan` | `monthly` or `annual`, derived from the price ID. |
| `current_period_end` | ms epoch. In API `2026-09-30` this lives on the subscription *item*. |
| `cancel_at_period_end` | 0 or 1. |
| `trial_reminder_sent_at`, `trial_ended_notice_sent_at` | Dedupe guards for the two reminder emails. |

`stripe_events(id TEXT PRIMARY KEY, received_at)` is the webhook idempotency log.

### Trial clock
- When billing is **enabled**, a new account gets `trial_ends_at = signup + 3 calendar months`.
- On boot with billing enabled, every non-exempt account with `trial_ends_at IS NULL` gets `now + 3 months`. That one rule implements "the trial starts at launch" and also covers accounts created while billing was off.

## 5. Entitlement

An account is entitled if any of these is true:
- billing is disabled,
- `billing_exempt = 1`,
- `subscription_status` is one of `active`, `trialing` or `past_due` (Stripe is still retrying a failed payment),
- `now < trial_ends_at`.

Otherwise the account is **paywalled**:
- Webmail `/api/*` routes return `402 {error:"subscription_required"}`. These stay open: `/api/auth/*`, `/api/billing*`, `/api/health`, `/api/users/me/*`, the Stripe webhook, and `/public/*`.
- Inbound SMTP is unaffected, so mail keeps arriving.
- Alias forwarding skips with `subscription-required`, so the message is stored instead.

## 6. Stripe integration

| Route | Purpose |
|---|---|
| `GET /api/billing` | `{ enabled, entitled, exempt, status, plan, trialEndsAt, trialDaysLeft, currentPeriodEnd, cancelAtPeriodEnd, prices }` |
| `POST /api/billing/checkout` `{plan}` | Creates (or reuses) the Stripe customer, then a Checkout Session in `subscription` mode for the plan's price. Sets `client_reference_id` and the metadata `accountId`. If more than 48 hours of trial remain, sets `subscription_data.trial_end` (Stripe's minimum). Returns `{url}`. |
| `POST /api/billing/portal` | Customer Portal session for changing plan, updating the card, cancelling, and viewing invoices. Returns `{url}`. |
| `POST /api/stripe/webhook` | Public. Uses the raw body and verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`. It is idempotent through `stripe_events`. |

Webhook events handled:
- **`checkout.session.completed`**: link the customer and subscription to the account found from `client_reference_id`.
- **`customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`**: find the account by `metadata.accountId`, falling back to the customer ID, then copy across the status, plan (from the price ID), `current_period_end` (taken from the item) and `cancel_at_period_end`.

All other events are acknowledged with 200 and ignored. An event that doesn't map to any account is also acknowledged with 200 and logged, so that Stripe doesn't retry it forever.

## 7. Reminder emails

An hourly tick, active only when billing is enabled, sends two emails from `noreply@` to the account's users:
- **7 days before the trial ends:** "Your free trial ends on {date}", with a link to choose a plan.
- **When the trial ends, if the account isn't subscribed:** "Your trial has ended. Your mail is safe", with a link to subscribe.

Each email is sent once, guarded by the `*_sent_at` columns. Neither is sent if the account is already subscribed.

## 8. Web

| Element | Behaviour |
|---|---|
| Trial banner | Shown while trialing with 14 days or fewer left: "{n} days left in your free trial · Choose a plan". |
| Paywall | Full screen, shown when `entitled === false`. Says "Your free trial has ended. Your mail is still arriving." Offers the two plans from `PRICING`, a sign-out link, and the account email. |
| **More → Billing** | Opens the Customer Portal if subscribed, otherwise the plan picker. |
| Return from Checkout (`?billing=success`) | Polls `GET /api/billing` briefly, because the webhook may land a moment later, then confirms. |

## 9. Configuration

| Variable | Notes |
|---|---|
| `BILLING_ENABLED` | Default `false`. |
| `STRIPE_SECRET_KEY` | Secret. |
| `STRIPE_WEBHOOK_SECRET` | Secret. |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | Stripe Price IDs: recurring, USD, `1999` monthly and `10000` yearly. |
| `BILLING_TRIAL_MONTHS` | Default `3`. |

Boot fails fast if `BILLING_ENABLED=true` and any Stripe variable is missing.

## 10. Testing

- **Unit:** trial arithmetic (calendar months, end-of-month clamping) and the entitlement matrix.
- **Integration, with the Stripe API client stubbed:**
  - Checkout parameters: price, customer reuse, `trial_end` when there's room and none inside 48 hours.
  - Portal.
  - 402 gating and the paths that stay open.
  - Webhook signature verification using Stripe's own test-header generator, plus idempotency and state transitions.
  - Reminder dedupe.
  - Forwarding falling back to storing when unpaid.
- **Web:** banner, paywall and redirect to the Checkout URL.

## 11. Rollout

1. Create the product and the two prices in Stripe, configure the Customer Portal, and add the webhook endpoint `https://zero-spam.email/api/stripe/webhook` for the four events.
2. Put the keys and price IDs into SSM, keeping `BILLING_ENABLED=false`, then deploy. Nothing changes for users.
3. Update the Terms of Service.
4. Set `BILLING_ENABLED=true` and redeploy. Existing accounts start their 3-month trial at that moment.
