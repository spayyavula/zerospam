// Pricing: a three-month free trial, then monthly or annual. Prices live in one place
// (PRICING) so the savings figure and the per-month equivalent can never drift from them.
import { Check } from 'lucide-react';

export const PRICING = {
  trialMonths: 3,
  monthly: 19.99,
  annual: 100,
} as const;

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** Whole-percent saving of annual vs. twelve monthly payments (58% for $100 vs $19.99). */
export const annualSavingsPct = Math.round((1 - PRICING.annual / (PRICING.monthly * 12)) * 100);
const annualPerMonth = Math.floor((PRICING.annual / 12) * 100) / 100; // $8.33

const INCLUDED = [
  'Whitelist inbox and Screener',
  'Self-clearing quarantine with a daily digest',
  'Aliases with forwarding and private replies',
  'Tracker blocking and spoof checks',
  'Gmail and Outlook connect',
  'Two-factor sign-in',
];

// Text that sits on the yellow signal fill must stay dark in both themes.
const ON_SIGNAL = 'text-[#14120B]';

type Plan = {
  name: string;
  price: string;
  period: string;
  detail: string;
  badge?: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: 'Monthly',
    price: usd(PRICING.monthly),
    period: 'per month',
    detail: 'Billed every month after your free trial.',
  },
  {
    name: 'Annual',
    price: usd(PRICING.annual),
    period: 'per year',
    detail: `That’s ${usd(annualPerMonth)} a month, billed once a year after your free trial.`,
    badge: `Save ${annualSavingsPct}%`,
    featured: true,
  },
];

export function Pricing({ onStartTrial }: { onStartTrial: () => void }) {
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-px bg-rule border border-rule rounded-[18px] overflow-hidden">
        {PLANS.map((p) => (
          <div key={p.name} className={`flex flex-col p-7 sm:p-9 ${p.featured ? 'bg-paper-deep' : 'bg-paper'}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-medium text-ink">{p.name}</h3>
              {p.badge && (
                <span className="rounded-full border border-ink px-2.5 py-0.5 text-[13px] text-ink">{p.badge}</span>
              )}
            </div>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-[clamp(44px,6vw,56px)] leading-none tracking-[-0.02em] text-ink tabular-nums">
                {p.price}
              </span>
              <span className="text-[15px] text-quiet">{p.period}</span>
            </p>
            <p className="mt-3 text-[15px] leading-[1.55] text-ink-soft">{p.detail}</p>
            <div className="mt-auto">
              <button
                type="button"
                onClick={onStartTrial}
                aria-label={`Start free trial, ${p.name.toLowerCase()} plan`}
                className={`mt-8 w-full rounded-lg px-5 py-3 text-[16px] font-medium transition-[filter,background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
                  p.featured
                    ? `bg-signal ${ON_SIGNAL} hover:brightness-95`
                    : 'border border-ink text-ink hover:bg-paper-deep'
                }`}
              >
                Start free trial
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[clamp(32px,5vw,48px)] grid md:grid-cols-[auto_1fr] gap-x-12 gap-y-4">
        <p className="text-[15px] text-ink">Both plans include everything.</p>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-ink-soft">
              <Check className="w-4 h-4 mt-[3px] shrink-0 text-ink" strokeWidth={1.75} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
