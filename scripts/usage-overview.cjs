// Who has actually USED the ZeroSpam web app — beyond the OAuth reviewer.
//
// Usage:
//   node scripts/usage-overview.cjs [db-path]
//   DB_PATH=/data/zerospam.sqlite node scripts/usage-overview.cjs
// In prod (single EC2 + docker compose):
//   docker compose exec -T app node scripts/usage-overview.cjs /data/zerospam.sqlite
//
// Read-only. Classifies each user as SEEDED (test fixtures / seed-test-users) or
// REAL, then shows engagement signals so genuine usage stands out.
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.argv[2] || process.env.DB_PATH || '/data/zerospam.sqlite';
const fmt = (t) => (t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '—');
const db = new DatabaseSync(dbPath);

// Accounts created by tests or the seeders — anything NOT matching these is "real".
const SEEDED = [
  /^testuser\d+@zero-spam\.email$/, // seed-test-users.ts
  /@(example\.com|local)$/, // unit/e2e fixtures: alice@example.com, demo@local, rogue@local…
  /^a@x\.com$/,
  /^e2e@/,
];
const isSeeded = (email) => SEEDED.some((re) => re.test(email || ''));

console.log(`DB: ${dbPath}\n`);

const users = db
  .prepare(
    `SELECT u.id, u.email, u.created_at, u.email_verified_at, u.tour_completed_at,
            (SELECT COUNT(*) FROM audit_log a WHERE a.user_id=u.id AND a.event='login.ok')   AS logins_ok,
            (SELECT MAX(a.at) FROM audit_log a WHERE a.user_id=u.id AND a.event='login.ok')   AS last_login,
            (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id)                            AS sessions,
            (SELECT COUNT(*) FROM devices d WHERE d.user_id=u.id AND d.revoked_at IS NULL)    AS devices
     FROM users u ORDER BY u.created_at`,
  )
  .all();

const real = users.filter((u) => !isSeeded(u.email));
const seeded = users.filter((u) => isSeeded(u.email));

function table(list) {
  if (!list.length) return console.log('  (none)');
  console.log(
    '  ' +
      'email'.padEnd(30) +
      'signed up'.padEnd(18) +
      'verified'.padEnd(10) +
      'tour'.padEnd(6) +
      'logins'.padEnd(8) +
      'last login'.padEnd(18) +
      'sess'.padEnd(6) +
      'devs',
  );
  for (const u of list)
    console.log(
      '  ' +
        (u.email || '?').padEnd(30) +
        fmt(u.created_at).padEnd(18) +
        (u.email_verified_at ? 'yes' : 'NO').padEnd(10) +
        (u.tour_completed_at ? 'yes' : '—').padEnd(6) +
        String(u.logins_ok).padEnd(8) +
        fmt(u.last_login).padEnd(18) +
        String(u.sessions).padEnd(6) +
        String(u.devices),
    );
}

console.log(`== REAL accounts (not seeded/test): ${real.length} ==`);
table(real);

console.log(`\n== seeded / test accounts: ${seeded.length} ==`);
table(seeded);

// Mail + OAuth connections are strong "actually used it" signals.
console.log('\n== mailbox activity (real-account mailboxes) ==');
const mb = db
  .prepare(
    `SELECT m.address, m.provider, m.created_at,
            (SELECT COUNT(*) FROM messages msg WHERE msg.mailbox_id=m.id) AS msgs,
            (SELECT COUNT(*) FROM connections c WHERE c.mailbox_id=m.id)  AS conns
     FROM mailboxes m ORDER BY m.created_at`,
  )
  .all()
  .filter((m) => !isSeeded(m.address));
if (!mb.length) console.log('  (no non-seeded mailboxes)');
for (const m of mb)
  console.log(`  ${(m.address || '?').padEnd(34)} provider=${(m.provider || 'local').padEnd(8)} msgs=${m.msgs}  oauth_conns=${m.conns}  created=${fmt(m.created_at)}`);

console.log('\n== OAuth connections (Gmail/Outlook linked) ==');
const conns = db
  .prepare(
    `SELECT c.provider, c.status, c.created_at, mb.address
     FROM connections c JOIN mailboxes mb ON mb.id=c.mailbox_id ORDER BY c.created_at`,
  )
  .all();
if (!conns.length) console.log('  (none — nobody has connected an external mailbox)');
for (const c of conns) console.log(`  ${c.provider}  ${c.status}  ${c.address}  created=${fmt(c.created_at)}`);

console.log('\n== totals ==');
console.log(`  users: ${users.length}  (real ${real.length}, seeded ${seeded.length})`);
console.log(`  real accounts that ever logged in: ${real.filter((u) => u.logins_ok > 0).length}`);
console.log(`  real accounts that completed onboarding tour: ${real.filter((u) => u.tour_completed_at).length}`);
