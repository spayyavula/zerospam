// Pure HTML and plaintext rendering for the quarantine digest email.
// No I/O, no secrets, no template engine — string concatenation with explicit escaping.

export type DigestSenderRow = {
  fromAddress: string;
  fromName: string | null;
  messageCount: number;
  latestSubject: string | null;
  latestReceivedAt: number;
  allowToken: string;
};

export type DigestContent = {
  mailboxId: number;
  mailboxAddress: string;
  rows: DigestSenderRow[];
  totalSendersInQuarantine: number;
  windowStart: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(ms: number): string {
  return new Date(ms).toUTCString();
}

function actionUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/public/digest/allow?t=${encodeURIComponent(token)}`;
}

export function renderHtml(content: DigestContent, baseUrl: string): string {
  const overflow = content.totalSendersInQuarantine - content.rows.length;
  const overflowFooter =
    overflow > 0
      ? `<tr><td style="padding:12px 16px;color:#888;font-size:12px;">+${overflow} more senders in quarantine — review in webmail.</td></tr>`
      : '';

  const rows = content.rows
    .map((r) => {
      const label = r.fromName
        ? `${escapeHtml(r.fromName)} &lt;${escapeHtml(r.fromAddress)}&gt;`
        : escapeHtml(r.fromAddress);
      const subj = r.latestSubject ? escapeHtml(r.latestSubject) : '(no subject)';
      const url = escapeHtml(actionUrl(baseUrl, r.allowToken));
      return `
<tr>
  <td style="padding:14px 16px;border-bottom:1px solid #eee;">
    <div style="font-weight:600;color:#222;">${label}</div>
    <div style="font-size:13px;color:#555;margin-top:2px;">
      ${r.messageCount} message${r.messageCount === 1 ? '' : 's'} • latest: ${subj} • ${escapeHtml(fmtDate(r.latestReceivedAt))}
    </div>
    <div style="margin-top:10px;">
      <a href="${url}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">
        Allow forever
      </a>
    </div>
  </td>
</tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e5ea;">
      <tr>
        <td style="padding:18px 16px;border-bottom:1px solid #e5e5ea;">
          <div style="font-size:18px;font-weight:700;">ZeroSpam quarantine digest</div>
          <div style="font-size:13px;color:#666;margin-top:2px;">${escapeHtml(content.mailboxAddress)}</div>
          <div style="font-size:13px;color:#666;margin-top:8px;">
            ${content.rows.length} sender${content.rows.length === 1 ? '' : 's'} waiting for your decision.
          </div>
        </td>
      </tr>
      ${rows}
      ${overflowFooter}
      <tr>
        <td style="padding:14px 16px;background:#fafafa;font-size:12px;color:#888;">
          Click "Allow forever" to release a sender's queued messages and trust them going forward.
          Anything you don't act on will expire from quarantine automatically.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderText(content: DigestContent, baseUrl: string): string {
  const lines: string[] = [];
  lines.push(`ZeroSpam quarantine digest — ${content.mailboxAddress}`);
  lines.push(
    `${content.rows.length} sender${content.rows.length === 1 ? '' : 's'} waiting for your decision.`,
  );
  lines.push('');

  for (const r of content.rows) {
    const label = r.fromName ? `${r.fromName} <${r.fromAddress}>` : r.fromAddress;
    const subj = r.latestSubject ?? '(no subject)';
    lines.push(`* ${label}`);
    lines.push(
      `  ${r.messageCount} message${r.messageCount === 1 ? '' : 's'} | latest: ${subj} | ${fmtDate(r.latestReceivedAt)}`,
    );
    lines.push(`  Allow forever: ${actionUrl(baseUrl, r.allowToken)}`);
    lines.push('');
  }

  const overflow = content.totalSendersInQuarantine - content.rows.length;
  if (overflow > 0) {
    lines.push(`+${overflow} more senders in quarantine — review in webmail.`);
    lines.push('');
  }

  lines.push(
    'Click "Allow forever" to release a sender\'s queued messages and trust them going forward.',
  );
  lines.push("Anything you don't act on will expire from quarantine automatically.");

  return lines.join('\n');
}
