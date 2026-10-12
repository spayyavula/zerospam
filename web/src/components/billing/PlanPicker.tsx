import { useState } from 'react';
import { api } from '../../api';
import type { BillingPlan } from '../../types';
import { PRICING, annualSavingsPct } from '../landing/Pricing';

// Text that sits on the yellow signal fill must stay dark in both themes.
const ON_SIGNAL = 'text-[#14120B]';

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** Sends the browser to Stripe Checkout. Exported so tests can stub navigation. */
export const navigate = { to: (url: string) => window.location.assign(url) };

/**
 * The two plans as buttons. Choosing one creates a Stripe Checkout session and leaves
 * for Stripe's hosted payment page; we never see card details.
 */
export default function PlanPicker({ trialDaysLeft }: { trialDaysLeft: number | null }) {
  const [busy, setBusy] = useState<BillingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (plan: BillingPlan) => {
    setBusy(plan);
    setError(null);
    try {
      const { url } = await api.billingCheckout(plan);
      navigate.to(url);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open checkout. Try again.');
      setBusy(null);
    }
  };

  const plans: Array<{ plan: BillingPlan; name: string; price: string; period: string; note: string; featured?: boolean }> = [
    { plan: 'monthly', name: 'Monthly', price: usd(PRICING.monthly), period: 'per month', note: 'Cancel anytime.' },
    {
      plan: 'annual',
      name: 'Annual',
      price: usd(PRICING.annual),
      period: 'per year',
      note: `Save ${annualSavingsPct}% compared with monthly.`,
      featured: true,
    },
  ];

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-px bg-rule border border-rule rounded-[14px] overflow-hidden">
        {plans.map((p) => (
          <div key={p.plan} className={`flex flex-col p-6 ${p.featured ? 'bg-paper-deep' : 'bg-paper'}`}>
            <p className="text-[15px] font-medium text-ink">{p.name}</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-[40px] leading-none text-ink tabular-nums">{p.price}</span>
              <span className="text-[14px] text-quiet">{p.period}</span>
            </p>
            <p className="mt-2 text-[14px] text-ink-soft">{p.note}</p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => choose(p.plan)}
              aria-label={`Choose ${p.name.toLowerCase()} plan`}
              className={`mt-6 w-full rounded-lg px-4 py-2.5 text-[15px] font-medium transition-[filter,background-color] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                p.featured ? `bg-signal ${ON_SIGNAL} hover:brightness-95` : 'border border-ink text-ink hover:bg-paper-deep'
              }`}
            >
              {busy === p.plan ? 'Opening checkout…' : `Choose ${p.name.toLowerCase()}`}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-quiet">
        {trialDaysLeft && trialDaysLeft > 2
          ? `You won’t be charged until your free trial ends, in ${trialDaysLeft} days. `
          : ''}
        Payment is handled securely by Stripe.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-zsdanger">
          {error}
        </p>
      )}
    </div>
  );
}
