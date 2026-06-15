// Inspect login activity from the ZeroSpam SQLite DB.
//
// Usage:
//   node scripts/check-logins.cjs [db-path]
//   DB_PATH=/data/zerospam.sqlite node scripts/check-logins.cjs
//
// In production (single EC2 + docker compose), run it inside the app container so
// it sees the EBS-mounted /data volume:
//   docker compose exec -T app node scripts/check-logins.cjs /data/zerospam.sqlite
//
// Reads only — never writes. Surfaces successful/failed logins, the live sessions,
// and calls out the reviewer account (testuser1@zero-spam.email) specifically.
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.argv[2] || process.env.DB_PATH || '/data/zerospam.sqlite';
const REVIEWER_EMAIL = 'testuser1@zero-spam.email';
const fmt = (t) => new Date(t).toISOString();

const db = new DatabaseSync(dbPath);
console.log(`DB: ${dbPath}\n`);

console.log('== recent logins (audit_log, newest first) ==');
const rows = db
  .prepare(
    `SELECT a.at, a.event, a.ip, a.user_agent, u.email
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.event LIKE 'login%' ORDER BY a.at DESC LIMIT 50`,
  )
  .all();
if (!rows.length) console.log('  (none)');
for (const r of rows)
  console.log(
    `  ${fmt(r.at)}  ${r.event.padEnd(10)}  ${(r.email ?? '?').padEnd(28)}  ip=${(r.ip ?? '-').padEnd(15)}  ua=${(r.user_agent || '').slice(0, 50)}`,
  );

console.log(`\n== reviewer account: ${REVIEWER_EMAIL} ==`);
const rev = db
  .prepare(
    `SELECT a.at, a.event, a.ip, a.user_agent
     FROM audit_log a JOIN users u ON u.id = a.user_id
     WHERE u.email = ? AND a.event LIKE 'login%' ORDER BY a.at DESC`,
  )
  .all(REVIEWER_EMAIL);
const okCount = rev.filter((r) => r.event === 'login.ok').length;
if (!rev.length) console.log('  no login attempts recorded for this account');
else {
  console.log(`  ${okCount} successful login(s); most recent activity:`);
  for (const r of rev.slice(0, 10))
    console.log(`    ${fmt(r.at)}  ${r.event}  ip=${r.ip ?? '-'}  ua=${(r.user_agent || '').slice(0, 50)}`);
}

console.log('\n== live sessions (newest first) ==');
const s = db
  .prepare(
    `SELECT s.created_at, s.ip, s.user_agent, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 50`,
  )
  .all();
if (!s.length) console.log('  (none)');
for (const r of s)
  console.log(`  ${fmt(r.created_at)}  ${(r.email ?? '?').padEnd(28)}  ip=${(r.ip ?? '-').padEnd(15)}  ua=${(r.user_agent || '').slice(0, 50)}`);

console.log('\n== totals ==');
console.log('  login.ok:  ', db.prepare(`SELECT COUNT(*) c FROM audit_log WHERE event='login.ok'`).get().c);
console.log('  login.fail:', db.prepare(`SELECT COUNT(*) c FROM audit_log WHERE event='login.fail'`).get().c);
console.log('  sessions:  ', db.prepare(`SELECT COUNT(*) c FROM sessions`).get().c);
