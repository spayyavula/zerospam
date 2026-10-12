import type { BillingSummary } from '../../types';

/** Quiet strip under the header during the last two weeks of the trial. */
export default function TrialBanner({ billing, onChoosePlan }: { billing: BillingSummary; onChoosePlan: () => void }) {
  const days = billing.trialDaysLeft;
  if (!billing.enabled || billing.exempt || billing.subscribed || days == null || days > 14 || !billing.entitled) {
    return null;
  }
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 border-b border-rule bg-paper-deep text-[14px] text-ink-soft">
      <span>
        {days <= 1 ? 'Your free trial ends today.' : `${days} days left in your free trial.`}
      </span>
      <button type="button" onClick={onChoosePlan} className="font-medium text-ink underline underline-offset-4 hover:no-underline">
        Choose a plan
      </button>
    </div>
  );
}
