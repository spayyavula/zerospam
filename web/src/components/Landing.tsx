import { Shield, Mail, CheckCircle2, Zap, Lock, BarChart3, ArrowRight, Github, UserCheck, Clock3, Quote, Inbox } from 'lucide-react';

const softTestimonials = [
  {
    quote: 'I no longer start mornings by deleting junk. I start by reading real email.',
    role: 'Freelance consultant',
  },
  {
    quote: 'Screener feels calm. I make fast decisions, and my inbox stays clean all week.',
    role: 'Small business owner',
  },
  {
    quote: 'ZeroSpam.email made email feel intentional again, not noisy.',
    role: 'Product manager',
  },
];

export default function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zsbg via-zsbg to-zspanel">
      {/* Header */}
      <header className="px-4 sm:px-6 lg:px-8 py-6 border-b border-zsborder">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/shield-blue.svg" alt="ZeroSpam shield" className="w-8 h-8" />
            <span className="text-2xl font-bold">ZeroSpam.email</span>
          </div>
          <button
            onClick={onGetStarted}
            className="px-4 py-2 rounded-lg bg-zsaccent text-zsbg font-medium hover:bg-zsaccent/90 transition"
          >
            Create Free Account
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-32">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zsaccent/10 border border-zsaccent/20 mb-6">
            <Zap className="w-4 h-4 text-zsaccent" />
            <span className="text-sm font-medium text-zsaccent">Built for busy professionals who want calm, productive days</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Protect your focus.
            <br />
            Keep your inbox calm.
          </h1>

          <p className="text-xl text-zsmuted mb-8 max-w-3xl mx-auto">
            ZeroSpam.email is for people who want deep work without inbox noise. Create your account once,
            define who you trust, and keep unknown senders out of your attention stream until you are ready.
          </p>

          <p className="text-base text-zstext/90 mb-8 max-w-2xl mx-auto font-medium">
            Core promise: protect your focus.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-zsaccent text-zsbg font-semibold hover:bg-zsaccent/90 transition text-lg"
            >
              Create My Free Account
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="px-5 py-4 rounded-lg border border-zsborder bg-zspanel/40 text-sm text-zsmuted">
              Setup time: about 2 minutes
            </div>
          </div>

          <p className="text-sm text-zsmuted mt-4">No credit card required • Keep your current email • Cancel anytime</p>
        </div>
      </section>

      {/* Soft Trust Strip */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto rounded-2xl border border-zsborder bg-zspanel/40 px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-sm sm:text-base text-zsmuted text-center leading-relaxed">
            People choose ZeroSpam.email because calm is a productivity feature.
            Less inbox noise means better decisions, cleaner attention, and more energy for meaningful work.
          </p>
        </div>
      </section>

      {/* Audience Fit */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zsborder bg-zsbg/50 p-4">
            <h3 className="font-semibold mb-1">Client-facing roles</h3>
            <p className="text-sm text-zsmuted">Respond to real people faster without scanning through clutter first.</p>
          </div>
          <div className="rounded-xl border border-zsborder bg-zsbg/50 p-4">
            <h3 className="font-semibold mb-1">Managers and founders</h3>
            <p className="text-sm text-zsmuted">Keep decision emails visible while unknown senders wait in Screener.</p>
          </div>
          <div className="rounded-xl border border-zsborder bg-zsbg/50 p-4">
            <h3 className="font-semibold mb-1">Deep-work professionals</h3>
            <p className="text-sm text-zsmuted">Reduce context switching and protect your peak focus blocks.</p>
          </div>
        </div>
      </section>

      {/* Why Create an Account */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-zspanel/40 border-y border-zsborder">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Why create a ZeroSpam.email account?</h2>
          <p className="text-center text-zsmuted mb-12 max-w-3xl mx-auto">
            Your account is where your calm workflow lives. Trusted senders, screening decisions,
            and security settings stay consistent so your inbox feels predictable every day.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-lg border border-zsborder bg-zsbg/50">
              <UserCheck className="w-6 h-6 text-zsaccent mb-3" />
              <h3 className="font-semibold text-lg mb-2">Your own trust network</h3>
              <p className="text-zsmuted">
                Approve a sender once and ZeroSpam remembers it in your account. No repeated training.
              </p>
            </div>
            <div className="p-6 rounded-lg border border-zsborder bg-zsbg/50">
              <Clock3 className="w-6 h-6 text-zsaccent mb-3" />
              <h3 className="font-semibold text-lg mb-2">Save time every week</h3>
              <p className="text-zsmuted">
                Unknown senders are grouped in Screener, so triage takes seconds and your main inbox stays focused.
              </p>
            </div>
            <div className="p-6 rounded-lg border border-zsborder bg-zsbg/50">
              <Lock className="w-6 h-6 text-zsaccent mb-3" />
              <h3 className="font-semibold text-lg mb-2">Security and ownership</h3>
              <p className="text-zsmuted">
                Enable 2FA, keep audit-friendly sender decisions, and stay in control of who can reach you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">What you get with ZeroSpam.email</h2>
          <p className="text-center text-zsmuted mb-12 max-w-2xl mx-auto">
            Built for first-time users and experts who want the same thing: a focused inbox and a calmer mind.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-lg border border-zsborder bg-zspanel/50 hover:border-zsaccent/30 transition">
              <div className="w-12 h-12 rounded-lg bg-zsaccent/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-zsaccent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Whitelist-First</h3>
              <p className="text-zsmuted">
                Only approved senders reach your inbox. No black-box filters deciding what you should see.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-lg border border-zsborder bg-zspanel/50 hover:border-zsaccent/30 transition">
              <div className="w-12 h-12 rounded-lg bg-zsaccent/10 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-zsaccent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Smart Screener</h3>
              <p className="text-zsmuted">
                New senders are held safely for your decision. You choose when they earn your attention.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-lg border border-zsborder bg-zspanel/50 hover:border-zsaccent/30 transition">
              <div className="w-12 h-12 rounded-lg bg-zsaccent/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-zsaccent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">DKIM Verification</h3>
              <p className="text-zsmuted">
                Cryptographic verification helps stop spoofing and gives you confidence in sender identity.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-lg border border-zsborder bg-zspanel/50 hover:border-zsaccent/30 transition">
              <div className="w-12 h-12 rounded-lg bg-zsaccent/10 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-zsaccent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Two-Factor Auth</h3>
              <p className="text-zsmuted">
                Protect your account with TOTP 2FA so only you can manage sender trust decisions.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-lg border border-zsborder bg-zspanel/50 hover:border-zsaccent/30 transition">
              <div className="w-12 h-12 rounded-lg bg-zsaccent/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-zsaccent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Analytics</h3>
              <p className="text-zsmuted">
                Understand who is trying to contact you and how your spam pressure changes over time.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-lg border border-zsborder bg-zspanel/50 hover:border-zsaccent/30 transition">
              <div className="w-12 h-12 rounded-lg bg-zsaccent/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-zsaccent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Instant Setup</h3>
              <p className="text-zsmuted">
                Start quickly with your current address and route mail through ZeroSpam.email in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Before / After Story */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-zspanel/50 border-y border-zsborder">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">A softer inbox experience</h2>
          <p className="text-center text-zsmuted mb-12 max-w-3xl mx-auto">
            This is not about more settings. It is about protecting cognitive energy and reducing daily email stress.
          </p>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-zsborder bg-zsbg/50 p-6">
              <div className="inline-flex items-center gap-2 text-zsmuted text-sm mb-4">
                <Inbox className="w-4 h-4" /> Before
              </div>
              <h3 className="text-xl font-semibold mb-3">Without ZeroSpam.email</h3>
              <ul className="space-y-2 text-zsmuted text-sm">
                <li>- Important emails buried between promotions and spam.</li>
                <li>- Constant manual cleanup and second-guessing.</li>
                <li>- Random senders repeatedly breaking through.</li>
                <li>- Anxiety that you missed something important.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-zsaccent/30 bg-zsaccent/5 p-6">
              <div className="inline-flex items-center gap-2 text-zsaccent text-sm mb-4">
                <Shield className="w-4 h-4" /> After
              </div>
              <h3 className="text-xl font-semibold mb-3">With ZeroSpam.email</h3>
              <ul className="space-y-2 text-zstext text-sm">
                <li>- Trusted senders reach Inbox by default.</li>
                <li>- Unknown senders wait in Screener for your quick decision.</li>
                <li>- Your trust list improves over time in your account.</li>
                <li>- A calmer routine: fewer interruptions, more flow.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* First-Time User Path */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Your first 10 minutes as a new user</h2>
          <p className="text-center text-zsmuted mb-12">
            A gentle onboarding path designed to quickly reduce noise and create a calmer workflow.
          </p>

          <div className="space-y-4">
            <div className="rounded-lg border border-zsborder bg-zspanel/50 p-4 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-zsaccent/10 border border-zsaccent grid place-items-center text-zsaccent font-semibold">1</div>
              <div>
                <h3 className="font-semibold">Create account and verify email</h3>
                <p className="text-sm text-zsmuted">You unlock personalized trust lists, secure settings, and sender decision history.</p>
              </div>
            </div>
            <div className="rounded-lg border border-zsborder bg-zspanel/50 p-4 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-zsaccent/10 border border-zsaccent grid place-items-center text-zsaccent font-semibold">2</div>
              <div>
                <h3 className="font-semibold">Forward mail to ZeroSpam.email</h3>
                <p className="text-sm text-zsmuted">Keep your existing address while ZeroSpam filters unknown senders automatically.</p>
              </div>
            </div>
            <div className="rounded-lg border border-zsborder bg-zspanel/50 p-4 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-zsaccent/10 border border-zsaccent grid place-items-center text-zsaccent font-semibold">3</div>
              <div>
                <h3 className="font-semibold">Approve important senders from Screener</h3>
                <p className="text-sm text-zsmuted">One click per sender. Future emails from them go straight to Inbox without extra friction.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-zspanel/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">How It Works</h2>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zsaccent/10 border-2 border-zsaccent flex items-center justify-center text-lg font-bold text-zsaccent">
                1
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Sign up & connect your inbox</h3>
                <p className="text-zsmuted">
                  Create your ZeroSpam.email account and connect your current email flow. Takes about 2 minutes.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zsaccent/10 border-2 border-zsaccent flex items-center justify-center text-lg font-bold text-zsaccent">
                2
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Build your whitelist</h3>
                <p className="text-zsmuted">
                  Approve trusted senders once. They always reach your inbox, while unknown senders are screened.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zsaccent/10 border-2 border-zsaccent flex items-center justify-center text-lg font-bold text-zsaccent">
                3
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Review & approve new senders</h3>
                <p className="text-zsmuted">
                  New contacts appear in Screener with context, so you can decide quickly and safely.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zsaccent/10 border-2 border-zsaccent flex items-center justify-center text-lg font-bold text-zsaccent">
                4
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Enjoy a spam-free inbox</h3>
                <p className="text-zsmuted">
                  From here on, your inbox is mostly trusted senders. Fewer interruptions, fewer mistakes, more signal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Voice */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">How users describe the change</h2>
          <p className="text-center text-zsmuted mb-10 max-w-2xl mx-auto">
            Soft wins matter: less noise, less stress, stronger focus.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {softTestimonials.map((item) => (
              <article key={item.quote} className="rounded-xl border border-zsborder bg-zspanel/40 p-5">
                <Quote className="w-4 h-4 text-zsaccent mb-3" />
                <p className="text-sm leading-relaxed">"{item.quote}"</p>
                <p className="text-xs text-zsmuted mt-4">{item.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready for a calmer, more productive inbox?</h2>
          <p className="text-xl text-zsmuted mb-8">
            Create your account now and protect your focus from day one.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-zsaccent text-zsbg font-semibold hover:bg-zsaccent/90 transition text-lg"
          >
            Create Free Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 lg:px-8 py-8 border-t border-zsborder">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 sm:mb-0">
            <Shield className="w-5 h-5 text-zsaccent" />
            <span className="font-semibold">ZeroSpam.email</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zsmuted">
            <a href="/privacy-policy" className="hover:text-zsaccent transition">
              Privacy Policy
            </a>
            <a href="/terms-of-service" className="hover:text-zsaccent transition">
              Terms of Service
            </a>
            <a href="https://github.com" className="hover:text-zsaccent transition inline-flex items-center gap-1">
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
