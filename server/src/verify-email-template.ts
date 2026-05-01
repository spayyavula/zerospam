function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type VerifyEmailContent = {
  username: string;
  verifyUrl: string;
  expiresHours: number;
};

export function renderVerifyEmailHtml(c: VerifyEmailContent): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;border:1px solid #e5e5ea;">
      <tr><td style="padding:24px;">
        <div style="font-size:18px;font-weight:700;">Welcome to ZeroSpam, ${escapeHtml(c.username)}.</div>
        <p style="font-size:14px;line-height:1.5;color:#444;">
          Please verify your email so we can finish setting up your inbox at
          <code>${escapeHtml(c.username)}@zero-spam.email</code>.
        </p>
        <div style="margin:20px 0;">
          <a href="${escapeHtml(c.verifyUrl)}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
            Verify email
          </a>
        </div>
        <p style="font-size:12px;color:#888;">
          This link expires in ${c.expiresHours} hours. If you didn't sign up, you can ignore this message.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderVerifyEmailText(c: VerifyEmailContent): string {
  return [
    `Welcome to ZeroSpam, ${c.username}.`,
    ``,
    `Please verify your email so we can finish setting up your inbox at ${c.username}@zero-spam.email.`,
    ``,
    `Verify: ${c.verifyUrl}`,
    ``,
    `This link expires in ${c.expiresHours} hours. If you didn't sign up, you can ignore this message.`,
  ].join('\n');
}
