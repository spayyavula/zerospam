import { Wordmark } from '../brand';
import PlanPicker from './PlanPicker';

/**
 * Shown instead of webmail when the free trial has ended without a subscription.
 * Mail keeps arriving server-side, so the message leads with that: nothing is lost.
 */
export default function Paywall({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <div className="min-h-full bg-paper text-ink-soft font-body">
      <header className="mx-auto max-w-[760px] px-5 sm:px-8 h-14 flex items-center justify-between">
        <Wordmark size="sm" />
        <button
          type="button"
          onClick={onSignOut}
          className="text-[14px] text-quiet hover:text-ink underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </header>
      <main className="mx-auto max-w-[760px] px-5 sm:px-8 pt-[clamp(32px,8vw,88px)] pb-16">
        <h1 className="font-display italic text-ink tracking-[-0.02em] leading-[1.02] text-[clamp(36px,6vw,56px)]">
          Your free trial has ended.
        </h1>
        <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.6]">
          Your mail is still arriving and nothing has been deleted. Choose a plan to read it and keep
          everything working{email ? ` for ${email}` : ''}.
        </p>
        <div className="mt-10">
          <PlanPicker trialDaysLeft={0} />
        </div>
      </main>
    </div>
  );
}
