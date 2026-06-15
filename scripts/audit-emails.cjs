// Every email address that ever appeared in an auth event — including failed logins
// for accounts that DON'T exist (the typed email is stored in audit_log.detail).
// Catches visitors who tried to log in / signed up but never created an account.
//
// Usage:
//   node scripts/audit-emails.cjs [db-path] [filter]
// In prod (script lives in the bind-mounted /data):
//   sudo cp scripts/audit-emails.cjs /data/audit-emails.cjs
//   sudo docker compose exec -T app node /data/audit-emails.cjs /data/zerospam.sqlite
//
// Read-only.
const { DatabaseSync } = require('node:sqlite');

const rawArgs = process.argv.slice(2);
const dbPath =
  rawArgs.find((a) => a.endsWith('.sqlite')) || process.env.DB_PATH || '/data/zerospam.sqlite';
const filter = rawArgs.find((a) => !a.endsWith('.sqlite')) || null;
const fmt = (t) => (t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '—');
const db = new DatabaseSync(dbPath);

console.log(`DB: ${dbPath}${filter ? `   filter: "${filter}"` : ''}\n`);

const rows = db
  .prepare(
    `SELECT a.at, a.event, a.detail, a.ip, a.user_agent, u.email AS account_email
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.at DESC LIMIT 500`,
  )
  .all();

// Resolve the "email in play" for each row: the joined account email, else the
// email captured in the detail JSON (failed logins for unknown addresses).
const emailFor = (r) => {
  if (r.account_email) return r.account_email;
  try {
    const d = r.detail ? JSON.parse(r.detail) : null;
    if (d && d.email) return d.email;
  } catch {}
  return null;
};

const filtered = rows.filter((r) => {
  const e = emailFor(r);
  return !filter || (e && e.toLowerCase().includes(filter.toLowerCase()));
});

console.log(`== auth events with an email (newest first): ${filtered.length} ==`);
if (!filtered.length) console.log('  (none)');
for (const r of filtered) {
  const e = emailFor(r) || '(no email)';
  console.log(`  ${fmt(r.at)}  ${r.event.padEnd(11)}  ${e.padEnd(34)}  ip=${(r.ip ?? '-').padEnd(15)}  ua=${(r.user_agent || '').slice(0, 40)}`);
}

// Distinct emails that show up ONLY in auth events but have no account — i.e.
// people who typed an email at the login/signup box but never registered.
console.log('\n== emails seen in auth events but with NO account ==');
const distinct = [...new Set(filtered.map(emailFor).filter(Boolean).map((e) => e.toLowerCase()))];
const orphans = distinct.filter(
  (e) => !db.prepare('SELECT 1 FROM users WHERE LOWER(email)=?').get(e),
);
if (!orphans.length) console.log('  (none — every email seen belongs to a real account)');
for (const e of orphans) {
  const attempts = filtered.filter((r) => (emailFor(r) || '').toLowerCase() === e);
  console.log(`  ${e.padEnd(34)} ${attempts.length} event(s), first ${fmt(Math.min(...attempts.map((a) => a.at)))}`);
}
