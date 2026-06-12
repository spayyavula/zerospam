// Idempotent test-data seeder: creates N verified, login-ready users, each with
// its own account + mailbox (testuserN@<signupDomain>) + a starter whitelist and
// a prefilled inbox/quarantine. Mirrors the production signup wiring so every
// record is internally consistent (user ↔ account ↔ domain ↔ mailbox), and routes
// the sample mail through the real ingest pipeline (no special-cased folders).
//
// Re-runnable: existing test users are reused and their sample mail is rebuilt,
// so running it twice does not create duplicates.
//
// Usage: npm run seed:test-users --workspace=server
//        npm run seed:test-users --workspace=server -- --count 5
import { pathToFileURL } from 'node:url';
import { db } from './db.js';
import { config } from './config.js';
import { createAccount } from './accounts.js';
import { hashPassword } from './users.js';
import { ensureDkim } from './dkim.js';
import { ingest } from './ingest.js';

const DEFAULT_COUNT = 10;
const PASSWORD = 'test-password-123'; // 17 chars — satisfies the >=12 signup rule

type SeedMail = {
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  ageMinutes: number;
};

// Routed purely by the per-mailbox whitelist below: whitelisted senders land in
// the inbox, everyone else in quarantine — exactly what real ingest decides.
function mailsFor(domain: string): SeedMail[] {
  return [
    // → inbox (whitelisted)
    {
      from: 'boss@trusted.com',
      fromName: 'Alex Chen',
      subject: 'Sprint review notes',
      body: "Hey,\n\nGreat work on the sprint. Let's sync tomorrow on the rollout plan.\n\n— A.",
      ageMinutes: 15,
    },
    {
      from: 'notifications@github.com',
      fromName: 'GitHub',
      subject: '[zerospam/zerospam] PR #42 is ready for review',
      body: 'A pull request is ready for your review.\nhttps://github.com/zerospam/zerospam/pull/42\n',
      ageMinutes: 80,
    },
    {
      from: `team@${domain}`,
      fromName: 'ZeroSpam Team',
      subject: 'Welcome to ZeroSpam',
      body: 'Your inbox is whitelist-first. Everything else expires from quarantine.\n— The ZeroSpam Team',
      ageMinutes: 240,
    },
    // → quarantine (not whitelisted)
    {
      from: 'support@notpaypal.io',
      fromName: 'PayPal Support', // display-name spoof
      subject: 'Action required: verify your account',
      body: 'We detected unusual activity. Verify within 24 hours: http://verify-paypal.notpaypal.io',
      ageMinutes: 5,
    },
    {
      from: 'win@evil-prizes.io',
      subject: "🎉 You've won — claim your $1,000 gift card now",
      body: 'Limited-time offer for selected users. Click below to claim.',
      ageMinutes: 35,
    },
    {
      from: 'marketing@biztool.io',
      fromName: 'BizTool Sales',
      subject: 'Save your team 10 hours a week — book a 15-minute demo',
      body: "I'd love to show you how BizTool integrates with the rest of your stack. Got 15 minutes this week?",
      ageMinutes: 24 * 60,
    },
  ];
}

const findUserByEmail = db.prepare('SELECT id, account_id FROM users WHERE email = ?');
const insertUser = db.prepare(
  `INSERT INTO users (email, password_hash, account_id, email_verified_at, created_at)
   VALUES (?, ?, ?, ?, ?) RETURNING id`,
);
const ensureDomain = db.prepare(
  `INSERT INTO domains (name, created_at, account_id) VALUES (?, ?, ?)
   ON CONFLICT(name) DO UPDATE SET name = excluded.name RETURNING id`,
);
const upsertMailbox = db.prepare(
  `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, account_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(address) DO UPDATE SET display_name = excluded.display_name RETURNING id`,
);
const ruleExists = db.prepare(
  'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
);
const insertRule = db.prepare(
  'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
);

function parseCount(argv: string[]): number {
  const i = argv.indexOf('--count');
  if (i >= 0 && argv[i + 1]) {
    const n = Number.parseInt(argv[i + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_COUNT;
}

export async function runSeedTestUsers(argv: string[] = []): Promise<void> {
  const count = parseCount(argv);
  const domain = config.signupDomain;
  // Same password for every test user → hash once and reuse the digest.
  const passwordHash = await hashPassword(PASSWORD);
  const now = Date.now();

  // Domain already exists in any seeded DB; ON CONFLICT keeps its current owner.
  const dom = ensureDomain.get(domain, now, 0) as { id: number };
  ensureDkim(dom.id);

  for (let i = 1; i <= count; i++) {
    const username = `testuser${i}`;
    const email = `${username}@${domain}`;
    const address = email; // login email doubles as the mailbox address

    // user + account (idempotent: reuse an existing test user's account)
    let accountId: number;
    const existing = findUserByEmail.get(email) as { id: number; account_id: number } | undefined;
    const reused = Boolean(existing);
    if (existing) {
      accountId = existing.account_id;
    } else {
      accountId = createAccount(`account-${username}`).id;
      insertUser.get(email, passwordHash, accountId, now, now);
    }

    // mailbox + starter whitelist
    const mb = upsertMailbox.get(
      address,
      dom.id,
      `Test User ${i}`,
      config.quarantineTtlHours,
      accountId,
      now,
    ) as { id: number };
    const rules: Array<{ kind: 'address' | 'domain'; pattern: string; note: string }> = [
      { kind: 'address', pattern: 'boss@trusted.com', note: 'example trusted sender' },
      { kind: 'domain', pattern: 'github.com', note: 'GitHub notifications' },
      { kind: 'domain', pattern: domain, note: 'mail from our own domain' },
    ];
    for (const r of rules) {
      if (!ruleExists.get(mb.id, r.kind, r.pattern)) {
        insertRule.run(mb.id, r.kind, r.pattern, r.note, now);
      }
    }

    // sample mail — clear any prior seeded mail for this mailbox, then re-ingest
    const mails = mailsFor(domain);
    const senders = mails.map((m) => m.from);
    db.prepare(
      `DELETE FROM messages WHERE mailbox_id = ? AND from_address IN (${senders.map(() => '?').join(',')})`,
    ).run(mb.id, ...senders);

    let inbox = 0;
    let quarantine = 0;
    for (let j = 0; j < mails.length; j++) {
      const m = mails[j];
      const receivedAt = now - m.ageMinutes * 60_000;
      const fromHeader = m.fromName ? `"${m.fromName}" <${m.from}>` : m.from;
      const eml = Buffer.from(
        [
          `From: ${fromHeader}`,
          `To: ${address}`,
          `Subject: ${m.subject}`,
          `Date: ${new Date(receivedAt).toUTCString()}`,
          `Message-ID: <testseed.${i}.${j}.${now}@seed.local>`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset=utf-8`,
          ``,
          m.body,
        ].join('\r\n'),
      );
      const r = await ingest(eml, address);
      if (!r) {
        // eslint-disable-next-line no-console
        console.error(`  ! failed to ingest mail #${j} for ${address}`);
        continue;
      }
      // Pin received_at so the list view shows realistic ages, not "just now".
      db.prepare('UPDATE messages SET received_at = ? WHERE id = ?').run(receivedAt, r.messageId);
      if (r.folder === 'inbox') inbox++;
      else if (r.folder === 'quarantine') quarantine++;
    }

    // eslint-disable-next-line no-console
    console.log(
      `  ${(reused ? 'updated' : 'created').padEnd(7)} ${email.padEnd(28)} inbox=${inbox} quarantine=${quarantine}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `\n✓ ${count} test users ready on ${domain}` +
      `\n  login email: testuser1@${domain} … testuser${count}@${domain}` +
      `\n  password:    ${PASSWORD}  (same for all)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeedTestUsers(process.argv.slice(2)).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
