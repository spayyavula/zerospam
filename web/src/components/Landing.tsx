// Landing page — Reading Room brand, laid out with Apple's principles:
// one idea per section, a big headline, a short lede, and one product moment.
// Colors come from the paper/ink tokens, which flip with the day/night switch.
import { Wordmark } from './brand';
import DayNightSwitch from './landing/DayNightSwitch';
import { InboxPeek, AliasFlow, AliasModes, DigestCard, PRIVACY_POINTS } from './landing/LandingVisuals';

// Text that sits on the yellow signal fill must stay dark in both themes.
const ON_SIGNAL = 'text-[#14120B]';
const WRAP = 'mx-auto w-full max-w-[1040px] px-5 sm:px-8';

function PrimaryButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg bg-signal ${ON_SIGNAL} px-6 py-3 text-[17px] font-medium transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper`}
    >
      {children}
    </button>
  );
}

function SectionHeading({ children, center = false }: { children: string; center?: boolean }) {
  return (
    <h2
      className={`font-display italic text-ink tracking-[-0.02em] leading-[1.02] text-[clamp(36px,5.6vw,64px)] ${
        center ? 'text-center' : ''
      }`}
    >
      {children}
    </h2>
  );
}

export default function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-screen bg-paper text-ink-soft font-body antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-paper-deep focus:text-ink"
      >
        Skip to content
      </a>

      {/* Nav — translucent, Apple-style */}
      <header className="sticky top-0 z-40 border-b border-rule bg-[color-mix(in_srgb,var(--paper)_82%,transparent)] backdrop-blur-md">
        <nav className={`${WRAP} flex items-center gap-4 h-14`} aria-label="Primary">
          <a href="/" aria-label="ZeroSpam home" className="mr-auto">
            <Wordmark size="sm" />
          </a>
          <div className="hidden md:flex items-center gap-6 text-[14px] text-quiet">
            <a href="#aliases" className="hover:text-ink transition-colors">Aliases</a>
            <a href="#quarantine" className="hover:text-ink transition-colors">Quarantine</a>
            <a href="#privacy" className="hover:text-ink transition-colors">Privacy</a>
          </div>
          <DayNightSwitch />
          <button
            type="button"
            onClick={onGetStarted}
            className="text-[14px] text-ink hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded"
          >
            Sign in
          </button>
        </nav>
      </header>

      <main id="main">
        {/* Hero — whitelist + Screener in one picture */}
        <section className="pt-[clamp(64px,11vw,140px)] pb-[clamp(56px,8vw,112px)]">
          <div className={`${WRAP} text-center`}>
            <h1 className="zs-rise font-display italic text-ink tracking-[-0.03em] leading-[0.98] text-[clamp(48px,9vw,104px)]">
              Your inbox is
              <br />
              by invitation.
            </h1>
            <p className="zs-rise zs-rise-2 mx-auto mt-7 max-w-[34ch] font-display text-[clamp(19px,2.2vw,23px)] leading-[1.45] text-ink-soft">
              Only people you approve reach your inbox. Everyone else waits for your yes, or quietly
              expires.
            </p>
            <div className="zs-rise zs-rise-3 mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
              <PrimaryButton onClick={onGetStarted}>Create free account</PrimaryButton>
              <span className="text-[14px] text-quiet">Free. No credit card. About two minutes to set up.</span>
            </div>
          </div>
          <div className={`${WRAP} zs-rise zs-rise-4 mt-[clamp(48px,7vw,88px)]`}>
            <InboxPeek />
          </div>
        </section>

        {/* Aliases + private replies */}
        <section id="aliases" className="bg-paper-deep py-[clamp(72px,10vw,136px)] scroll-mt-14">
          <div className={WRAP}>
            <div className="grid lg:grid-cols-[1fr_1.05fr] gap-[clamp(40px,6vw,80px)] items-center">
              <div>
                <span className="inline-block mb-5 rounded-full border border-rule px-3 py-1 text-[13px] text-quiet">
                  New
                </span>
                <SectionHeading>A different address for every signup.</SectionHeading>
                <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.6]">
                  Make an alias in one click and give it to any site. Its mail arrives in the inbox you
                  already use, and when you reply, the reply leaves from the alias.
                </p>
                <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6]">
                  If an alias starts attracting spam, block it. Your real address was never exposed.
                </p>
              </div>
              <AliasFlow />
            </div>
            <div className="mt-[clamp(40px,6vw,64px)]">
              <p className="mb-4 text-[15px] text-ink">Choose where each alias delivers.</p>
              <AliasModes />
            </div>
          </div>
        </section>

        {/* Quarantine + daily digest */}
        <section id="quarantine" className="py-[clamp(72px,10vw,136px)] scroll-mt-14">
          <div className={`${WRAP} grid lg:grid-cols-[1.05fr_1fr] gap-[clamp(40px,6vw,80px)] items-center`}>
            <div className="order-2 lg:order-1">
              <DigestCard />
            </div>
            <div className="order-1 lg:order-2">
              <SectionHeading>Everything else expires.</SectionHeading>
              <p className="mt-6 max-w-[44ch] text-[17px] leading-[1.6]">
                Mail from senders you haven’t approved goes to quarantine and deletes itself after 168 hours.
                You can make that shorter.
              </p>
              <p className="mt-4 max-w-[44ch] text-[17px] leading-[1.6]">
                Each morning a short digest lists who tried to reach you. Allow anyone straight from the
                email, without opening ZeroSpam.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy & security */}
        <section id="privacy" className="bg-paper-deep py-[clamp(72px,10vw,136px)] scroll-mt-14">
          <div className={WRAP}>
            <SectionHeading center>Private by default.</SectionHeading>
            <p className="mx-auto mt-6 max-w-[42ch] text-center text-[17px] leading-[1.6]">
              Screening is only half of it. ZeroSpam also keeps senders from watching you.
            </p>
            <dl className="mt-[clamp(40px,6vw,72px)] grid sm:grid-cols-2 gap-px bg-rule border border-rule rounded-[18px] overflow-hidden">
              {PRIVACY_POINTS.map(({ Icon, title, body }) => (
                <div key={title} className="bg-paper p-7 sm:p-8">
                  <Icon className="w-6 h-6 text-ink" strokeWidth={1.5} aria-hidden="true" />
                  <dt className="mt-5 font-display text-[22px] leading-tight text-ink">{title}</dt>
                  <dd className="mt-2 text-[16px] leading-[1.6]">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="py-[clamp(88px,12vw,160px)]">
          <div className={`${WRAP} text-center`}>
            <SectionHeading center>Start with a quiet inbox.</SectionHeading>
            <p className="mx-auto mt-6 max-w-[40ch] text-[17px] leading-[1.6]">
              Pick a username, approve the people you know, and let the rest wait.
            </p>
            <div className="mt-9">
              <PrimaryButton onClick={onGetStarted}>Create free account</PrimaryButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className={`${WRAP} flex flex-col sm:flex-row items-center justify-between gap-4 py-8 text-[14px] text-quiet`}>
          <Wordmark size="sm" />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="/privacy-policy" className="hover:text-ink transition-colors">Privacy Policy</a>
            <a href="/terms-of-service" className="hover:text-ink transition-colors">Terms of Service</a>
            <span>© 2026 ZeroSpam</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
