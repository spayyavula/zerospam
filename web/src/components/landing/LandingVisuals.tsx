// Product moments for the landing page. Each is real ZeroSpam UI, re-drawn at
// presentation size — Apple-style: one crafted shot per section, no screenshots,
// no shadows (elevation comes from paper-deep surfaces and hairlines).
import { Check, CornerUpLeft, EyeOff, ShieldCheck, KeyRound, PlugZap } from 'lucide-react';

// Text that sits on the yellow signal fill must stay dark in both themes.
const ON_SIGNAL = 'text-[#14120B]';

function Avatar({ initial, tone = 'ink' }: { initial: string; tone?: 'ink' | 'quiet' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center w-9 h-9 shrink-0 rounded-full font-display italic text-[17px] ${
        tone === 'ink' ? 'bg-ink text-paper' : 'bg-rule text-ink-soft'
      }`}
    >
      {initial}
    </span>
  );
}

/** Hero: the inbox holds only people you know; one new sender waits at the door. */
export function InboxPeek() {
  const rows = [
    { i: 'M', from: 'Maya Chen', subject: 'Contract — final redlines', time: '9:41' },
    { i: 'D', from: 'Dr. Okafor’s office', subject: 'Your appointment on Thursday', time: '8:15' },
    { i: 'J', from: 'Jonah', subject: 'Dinner Saturday?', time: 'Mon' },
  ];
  return (
    <figure
      className="mx-auto w-full max-w-[640px] rounded-[18px] border border-rule bg-paper-deep overflow-hidden text-left"
      aria-label="A ZeroSpam inbox: three messages from known people, and one new sender waiting in the Screener"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-rule">
        <span className="font-display italic text-[17px] text-ink">Inbox</span>
        <span className="text-[13px] text-quiet tabular-nums">3 messages · all from people you know</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.from} className="flex items-center gap-3 px-5 py-3.5 border-b border-rule last:border-b-0">
            <Avatar initial={r.i} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-ink font-medium truncate">{r.from}</p>
              <p className="text-[14px] text-quiet truncate">{r.subject}</p>
            </div>
            <span className="text-[13px] text-quiet tabular-nums">{r.time}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-5 py-4 bg-paper border-t border-rule">
        <Avatar initial="N" tone="quiet" />
        <div className="min-w-0 flex-1 basis-[calc(100%-48px)] sm:basis-auto">
          <p className="text-[15px] text-ink break-words">
            <span className="font-medium">newsletter@shoply.io</span> wants to reach you
          </p>
          <p className="text-[13px] text-quiet">Waiting in the Screener</p>
        </div>
        <div className="flex gap-2 pl-12 sm:pl-0">
          <span className={`px-3.5 py-1.5 rounded-lg bg-signal ${ON_SIGNAL} text-[14px] font-medium`}>Allow</span>
          <span className="px-3.5 py-1.5 rounded-lg border border-rule text-ink-soft text-[14px]">Not now</span>
        </div>
      </div>
    </figure>
  );
}

/** Aliases: one address per signup, forwarded to your real inbox; replies go out as the alias. */
export function AliasFlow() {
  return (
    <figure
      className="w-full rounded-[18px] border border-rule bg-paper overflow-hidden"
      aria-label="How an alias works: mail to the alias is forwarded to your inbox, and your reply leaves as the alias"
    >
      <div className="px-6 py-5 border-b border-rule">
        <p className="text-[13px] text-quiet mb-1">You sign up for a store with</p>
        <p className="font-mono text-[15px] sm:text-[17px] text-ink break-all">shop-a1@zero-spam.email</p>
      </div>
      <div className="px-6 py-5 border-b border-rule">
        <p className="text-[13px] text-quiet mb-2">Their receipt arrives in your own inbox, from</p>
        <p className="text-[15px] text-ink">
          Shoply <span className="text-quiet">(orders at shoply.io)</span>
        </p>
        <p className="font-mono text-[13px] text-quiet break-all">rv.6odh5dlp1b0r@zero-spam.email</p>
      </div>
      <div className="px-6 py-5 bg-paper-deep">
        <p className="flex items-center gap-2 text-[13px] text-quiet mb-2">
          <CornerUpLeft className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" /> You hit reply. Shoply sees
        </p>
        <p className="font-mono text-[15px] sm:text-[17px] text-ink break-all">shop-a1@zero-spam.email</p>
        <p className="text-[13px] text-quiet mt-1">Never your real address.</p>
      </div>
    </figure>
  );
}

/** The three delivery modes, as they appear on every alias. */
export function AliasModes() {
  const modes = [
    { label: 'Keep in ZeroSpam', note: 'Stays here, in your ZeroSpam inbox.' },
    { label: 'Forward only', note: 'Goes straight to Gmail, Outlook, or wherever you read mail.' },
    { label: 'Keep + forward', note: 'Both. A copy here, a copy there.' },
  ];
  return (
    <dl className="grid sm:grid-cols-3 gap-px bg-rule border border-rule rounded-[14px] overflow-hidden">
      {modes.map((m) => (
        <div key={m.label} className="bg-paper px-5 py-4">
          <dt className="text-[15px] text-ink font-medium">{m.label}</dt>
          <dd className="text-[14px] text-quiet mt-1">{m.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Quarantine + digest: the morning summary, with one-tap trust. */
export function DigestCard() {
  const senders = [
    { from: 'recruiter@talentco.io', count: 2 },
    { from: 'hello@new-dentist.com', count: 1 },
    { from: 'promo@deals-daily.net', count: 6 },
  ];
  return (
    <figure
      className="w-full rounded-[18px] border border-rule bg-paper overflow-hidden"
      aria-label="The daily quarantine digest, listing new senders with an Allow link for each"
    >
      <div className="px-6 py-5 border-b border-rule">
        <p className="font-display italic text-[22px] text-ink leading-tight">While you were away</p>
        <p className="text-[14px] text-quiet mt-1">3 new senders · quarantined, expiring in 7 days</p>
      </div>
      <ul>
        {senders.map((s, idx) => (
          <li key={s.from} className="flex items-center gap-3 px-6 py-3.5 border-b border-rule last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[14px] text-ink truncate">{s.from}</p>
              <p className="text-[13px] text-quiet tabular-nums">
                {s.count} message{s.count === 1 ? '' : 's'}
              </p>
            </div>
            {idx === 1 ? (
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-signal ${ON_SIGNAL} text-[13px] font-medium`}>
                <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" /> Allowed
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-lg border border-rule text-ink-soft text-[13px]">Allow</span>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export const PRIVACY_POINTS = [
  {
    Icon: EyeOff,
    title: 'Trackers stay blocked',
    body: 'Remote images and tracking pixels don’t load until you say so, so senders can’t see when you open their mail.',
  },
  {
    Icon: ShieldCheck,
    title: 'Fakes get flagged',
    body: 'Every message is checked with SPF, DKIM, and DMARC. A “PayPal” that isn’t PayPal is marked before you click.',
  },
  {
    Icon: KeyRound,
    title: 'Only you get in',
    body: 'Turn on two-factor sign-in with any authenticator app. Your sender list is yours to change, nobody else’s.',
  },
  {
    Icon: PlugZap,
    title: 'Works with the address you have',
    body: 'Connect Gmail or Outlook and ZeroSpam screens it in place. No new address to hand out unless you want one.',
  },
] as const;
