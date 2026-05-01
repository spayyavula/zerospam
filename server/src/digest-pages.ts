// Server-rendered HTML pages for the public digest action flow.
// Style is deliberately close to the digest email so the confirm page
// doesn't read as a phishing landing.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SHELL_HEAD = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZeroSpam</title>
<style>
  body { margin:0; background:#f5f5f7; font-family:-apple-system,Segoe UI,Roboto,sans-serif; color:#222; }
  .card { max-width:520px; margin:48px auto; background:#fff; border:1px solid #e5e5ea; border-radius:10px; padding:24px; }
  h1 { font-size:20px; margin:0 0 12px; }
  p { font-size:14px; line-height:1.5; color:#444; }
  ul { padding-left:20px; }
  .muted { color:#777; font-size:12px; }
  .actions { margin-top:20px; display:flex; gap:8px; }
  .btn { display:inline-block; padding:10px 16px; border-radius:6px; text-decoration:none; font-weight:600; font-size:14px; border:0; cursor:pointer; }
  .btn-primary { background:#2563eb; color:#fff; }
  .btn-secondary { background:#fff; color:#444; border:1px solid #ccc; }
  .sender { font-weight:600; font-size:16px; word-break:break-all; }
</style>
</head><body>`;
const SHELL_FOOT = `</body></html>`;

export function renderConfirmPage(args: {
  token: string;
  sender: string;
  quarantinedCount: number;
}): string {
  const sender = escapeHtml(args.sender);
  const count = args.quarantinedCount;
  return `${SHELL_HEAD}
<div class="card">
  <h1>Trust this sender forever?</h1>
  <p class="sender">${sender}</p>
  <p>Currently <strong>${count} quarantined message${count === 1 ? '' : 's'}</strong> from this sender.</p>
  <p>Confirming will:</p>
  <ul>
    <li>Add a whitelist rule for <code>${sender}</code></li>
    <li>Move all currently-quarantined messages from this sender to your inbox</li>
    <li>Let future messages from this sender skip quarantine</li>
  </ul>
  <form method="POST" action="/public/digest/allow" class="actions">
    <input type="hidden" name="t" value="${escapeHtml(args.token)}">
    <button class="btn btn-primary" type="submit">Confirm</button>
    <a href="about:blank" class="btn btn-secondary">Cancel</a>
  </form>
</div>
${SHELL_FOOT}`;
}

export function renderSuccessPage(args: {
  sender: string;
  movedCount: number;
  alreadyTrusted: boolean;
  webmailUrl?: string;
}): string {
  const sender = escapeHtml(args.sender);
  const head = args.alreadyTrusted ? 'Already trusted.' : 'Sender trusted.';
  const link = args.webmailUrl
    ? `<a class="btn btn-primary" href="${escapeHtml(args.webmailUrl)}">Open webmail</a>`
    : '';
  return `${SHELL_HEAD}
<div class="card">
  <h1>${head}</h1>
  <p class="sender">${sender}</p>
  <p>${args.movedCount} message${args.movedCount === 1 ? '' : 's'} moved to your inbox.</p>
  <p class="muted">Future messages from this sender will skip quarantine. Mistake? Open webmail to remove the rule.</p>
  <div class="actions">${link}</div>
</div>
${SHELL_FOOT}`;
}

export function renderExpiredPage(): string {
  return `${SHELL_HEAD}
<div class="card">
  <h1>This link is expired or invalid.</h1>
  <p>Open your webmail and act on the sender from there. Quarantined messages still expire on their own schedule.</p>
</div>
${SHELL_FOOT}`;
}
