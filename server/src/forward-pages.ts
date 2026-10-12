// Server-rendered pages for confirming a forwarding address. Same GET-confirm /
// POST-act split as the digest pages, so mail-client link pre-fetchers can't
// verify an address on the user's behalf.
import { SHELL_HEAD, SHELL_FOOT, escapeHtml } from './digest-pages.js';

export function renderForwardConfirmPage(args: { token: string; email: string }): string {
  return `${SHELL_HEAD}
<div class="card">
  <h1>Forward ZeroSpam alias mail here?</h1>
  <p class="sender">${escapeHtml(args.email)}</p>
  <p>Confirming lets your ZeroSpam aliases forward mail from trusted senders to this address. Replies you send to forwarded mail will go out from the alias, never from this address.</p>
  <form method="POST" action="/public/forward/verify" class="actions">
    <input type="hidden" name="t" value="${escapeHtml(args.token)}">
    <button class="btn btn-primary" type="submit">Confirm</button>
    <a href="about:blank" class="btn btn-secondary">Cancel</a>
  </form>
</div>
${SHELL_FOOT}`;
}

export function renderForwardVerifiedPage(args: { email: string; webmailUrl?: string }): string {
  const link = args.webmailUrl
    ? `<a class="btn btn-primary" href="${escapeHtml(args.webmailUrl)}">Open webmail</a>`
    : '';
  return `${SHELL_HEAD}
<div class="card">
  <h1>Forwarding address confirmed.</h1>
  <p class="sender">${escapeHtml(args.email)}</p>
  <p class="muted">Pick this address on any alias in webmail to start forwarding.</p>
  <div class="actions">${link}</div>
</div>
${SHELL_FOOT}`;
}

export function renderForwardExpiredPage(): string {
  return `${SHELL_HEAD}
<div class="card">
  <h1>This link is expired or invalid.</h1>
  <p>Open webmail and resend the confirmation from the Aliases panel.</p>
</div>
${SHELL_FOOT}`;
}
