// Idempotent demo seeder: ensures the default domain/mailbox/whitelist exist,
// then injects a curated set of mails through the real ingest pipeline so the
// webmail boots into a populated state. Mails route to inbox or quarantine
// based on the seeded whitelist (no special-cased shortcuts).
//
// Usage: npm run seed:demo
import { pathToFileURL } from 'node:url';
import { db } from './db.js';
import { ingest } from './ingest.js';
import { ensureDkim } from './dkim.js';
import { config } from './config.js';

const DEFAULT_DOMAIN = 'researchbot.co';
const DEFAULT_MAILBOX = 'sreekanth@researchbot.co';

type DemoEmail = {
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  ageMinutes: number;
};

// Ordered approximately newest-first for log readability; received_at is
// pinned per-message below so this order doesn't affect display.
const demos: DemoEmail[] = [
  // Inbox (whitelisted senders)
  {
    from: 'boss@trusted.com',
    fromName: 'Alex Chen',
    subject: 'Sprint review notes',
    body:
      "Hey,\n\nGreat work on the sprint. Let's chat tomorrow about the rollout plan — I have a few thoughts on staging and the digest cutover.\n\n— A.",
    ageMinutes: 15,
  },
  {
    from: 'notifications@github.com',
    fromName: 'GitHub',
    subject: '[zerospam/zerospam] PR #42 is ready for review',
    body:
      'Sreekanth opened a pull request: "feat(server): mobile-app phase A auth foundation".\n\nView it on GitHub: https://github.com/zerospam/zerospam/pull/42\n',
    ageMinutes: 80,
  },
  {
    from: 'noreply@github.com',
    fromName: 'GitHub Security',
    subject: 'New sign-in to your account',
    body:
      'We noticed a sign-in to your GitHub account from a new device. If this was you, no action is needed.\n',
    ageMinutes: 6 * 60,
  },
  {
    from: 'team@researchbot.co',
    fromName: 'Research Bot',
    subject: 'Weekly digest — 3 papers worth a read',
    body:
      'Top picks for this week — open in the app to see the highlights and saved citations. \n— ResearchBot',
    ageMinutes: 27 * 60,
  },

  // Quarantine (non-whitelisted)
  {
    from: 'support@notpaypal.io',
    fromName: 'PayPal Support', // display-name spoof
    subject: 'Action required: verify your account',
    body:
      'Dear customer, we detected unusual activity. Please verify your identity within 24 hours.\n\nhttp://verify-paypal.notpaypal.io',
    ageMinutes: 5,
  },
  {
    from: 'win@evil-prizes.io',
    subject: "🎉 You've won — claim your $1,000 gift card now",
    body: 'Limited-time offer for selected users. Click below to claim.',
    ageMinutes: 35,
  },
  {
    from: 'list@substack-newsletter.com',
    fromName: 'Daily Brief',
    subject: '5 takeaways from this week in tech',
    body:
      '1. Markets cooled.\n2. AI keeps shipping.\n3. Layoffs slowed.\n\nUnsubscribe: https://substack-newsletter.com/u/abc',
    ageMinutes: 4 * 60,
  },
  {
    from: 'marketing@biztool.io',
    fromName: 'BizTool Sales',
    subject: 'Save your team 10 hours a week — book a 15-minute demo',
    body:
      'Hi Sreekanth, I\'d love to show you how BizTool integrates with the rest of your stack. Got 15 minutes this week?',
    ageMinutes: 24 * 60,
  },
  {
    from: 'auto-reply@unknown-vendor.com',
    fromName: 'Auto Replies',
    subject: 'Re: Re: Re: invoice #8821',
    body:
      'We received your message. A representative will get back to you in 3-5 business days.\n',
    ageMinutes: 50 * 60,
  },
];

function ensureSeed(): { mailboxId: number } {
  const now = Date.now();
  const dom = db
    .prepare(
      `INSERT INTO domains (name, created_at) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET name = excluded.name
       RETURNING id`,
    )
    .get(DEFAULT_DOMAIN, now) as { id: number };
  ensureDkim(dom.id);

  const mb = db
    .prepare(
      `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(address) DO UPDATE SET display_name = excluded.display_name
       RETURNING id`,
    )
    .get(DEFAULT_MAILBOX, dom.id, 'Sreekanth', config.quarantineTtlHours, now) as { id: number };

  const rules: Array<{ kind: 'address' | 'domain' | 'regex'; pattern: string; note: string }> = [
    { kind: 'address', pattern: 'boss@trusted.com', note: 'example trusted sender' },
    { kind: 'domain', pattern: 'researchbot.co', note: 'mail from our own domain' },
    { kind: 'domain', pattern: 'github.com', note: 'GitHub notifications' },
  ];
  const ruleExists = db.prepare(
    'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
  );
  const insertRule = db.prepare(
    `INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const r of rules) {
    if (!ruleExists.get(mb.id, r.kind, r.pattern)) {
      insertRule.run(mb.id, r.kind, r.pattern, r.note, now);
    }
  }

  return { mailboxId: mb.id };
}

function clearPriorDemos(mailboxId: number): number {
  // Idempotency: remove anything previously seeded by this CLI so re-runs
  // don't produce duplicates. We identify demo mails by their `from_address`
  // exactly matching one of the demo senders.
  const senders = demos.map((d) => d.from);
  const placeholders = senders.map(() => '?').join(',');
  const r = db
    .prepare(
      `DELETE FROM messages WHERE mailbox_id = ? AND from_address IN (${placeholders})`,
    )
    .run(mailboxId, ...senders);
  return r.changes as number;
}

export async function runSeedDemo(): Promise<void> {
  const { mailboxId } = ensureSeed();
  const cleared = clearPriorDemos(mailboxId);
  if (cleared) {
    // eslint-disable-next-line no-console
    console.log(`cleared ${cleared} prior demo message(s)`);
  }

  let inboxN = 0;
  let quarN = 0;
  for (let i = 0; i < demos.length; i++) {
    const d = demos[i];
    const dateHeader = new Date(Date.now() - d.ageMinutes * 60_000).toUTCString();
    const fromHeader = d.fromName ? `"${d.fromName}" <${d.from}>` : d.from;
    const eml = Buffer.from(
      [
        `From: ${fromHeader}`,
        `To: ${DEFAULT_MAILBOX}`,
        `Subject: ${d.subject}`,
        `Date: ${dateHeader}`,
        `Message-ID: <demo.${i}.${Date.now()}@seed.local>`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        d.body,
      ].join('\r\n'),
    );
    const r = await ingest(eml, DEFAULT_MAILBOX);
    if (!r) {
      // eslint-disable-next-line no-console
      console.error(`failed to ingest demo #${i} from ${d.from}`);
      continue;
    }
    // Pin received_at so the list view shows realistic ages instead of
    // "all delivered just now".
    const at = Date.now() - d.ageMinutes * 60_000;
    db.prepare('UPDATE messages SET received_at = ? WHERE id = ?').run(at, r.messageId);
    if (r.folder === 'inbox') inboxN++;
    else if (r.folder === 'quarantine') quarN++;
    // eslint-disable-next-line no-console
    console.log(`  ${r.folder.padEnd(10)}  ${d.from.padEnd(34)}  ${d.subject}`);
  }
  // eslint-disable-next-line no-console
  console.log(`✓ ${inboxN} inbox + ${quarN} quarantine into ${DEFAULT_MAILBOX}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeedDemo().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
