// Trace the "magic email" (OTP) flow: every email address that was ever submitted
// to request a login/signup code is recorded in otp_codes and never purged — so
// this finds emails people "left", even if they never completed the code.
//
// Usage:
//   node scripts/otp-trace.cjs [filter]            # filter = optional substring, e.g. an email or domain
//   DB_PATH=/data/zerospam.sqlite node scripts/otp-trace.cjs
// In prod:
//   docker compose exec -T app node scripts/otp-trace.cjs /data/zerospam.sqlite
//   docker compose exec -T app node scripts/otp-trace.cjs /data/zerospam.sqlite someone@example.com
//
// Read-only. Args: argv[2] may be a db-path (ends in .sqlite) and/or a filter substring.
const { DatabaseSync } = require('node:sqlite');

const rawArgs = process.argv.slice(2);
const dbPath =
  rawArgs.find((a) => a.endsWith('.sqlite')) || process.env.DB_PATH || '/data/zerospam.sqlite';
const filter = rawArgs.find((a) => !a.endsWith('.sqlite')) || null;
const fmt = (t) => (t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '—');
const db = new DatabaseSync(dbPath);

console.log(`DB: ${dbPath}${filter ? `   filter: "${filter}"` : ''}\n`);

let sql = `SELECT email, purpose, created_at, expires_at, consumed_at, attempt_count, signup_payload
           FROM otp_codes`;
const params = [];
if (filter) {
  sql += ` WHERE email LIKE ?`;
  params.push(`%${filter.toLowerCase()}%`);
}
sql += ` ORDER BY created_at DESC LIMIT 200`;
const rows = db.prepare(sql).all(...params);

console.log(`== magic-email requests (otp_codes): ${rows.length} ==`);
if (!rows.length) console.log('  (none — no OTP/magic-email code was ever requested)');
for (const r of rows) {
  // consumed_at is set on success, expiry, OR exhaustion — disambiguate.
  let outcome;
  if (!r.consumed_at) outcome = 'PENDING (never used)';
  else if (r.attempt_count >= 5) outcome = 'exhausted (too many tries)';
  else if (r.expires_at < r.consumed_at) outcome = 'expired';
  else outcome = 'COMPLETED';
  console.log(
    `  ${(r.email || '?').padEnd(34)} ${r.purpose.padEnd(12)} requested=${fmt(r.created_at)}  outcome=${outcome}${r.signup_payload ? '  payload=' + r.signup_payload.slice(0, 60) : ''}`,
  );
}

// Distinct emails + whether each became a real user account.
console.log('\n== distinct emails that left a magic-email request ==');
const distinct = [...new Set(rows.map((r) => r.email))];
if (!distinct.length) console.log('  (none)');
for (const email of distinct) {
  const u = db
    .prepare('SELECT id, email_verified_at, created_at FROM users WHERE email = ?')
    .get(email);
  const loggedIn = u
    ? db.prepare(`SELECT COUNT(*) c FROM audit_log WHERE user_id=? AND event='login.ok'`).get(u.id).c
    : 0;
  const status = u
    ? `account exists (verified=${u.email_verified_at ? 'yes' : 'no'}, password-logins=${loggedIn})`
    : 'NO account created — only left the email';
  console.log(`  ${email.padEnd(34)} ${status}`);
}
