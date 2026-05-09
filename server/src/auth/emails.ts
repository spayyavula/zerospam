import { sendMessage } from '../sender.js';
import { getOrCreateSystemMailboxId } from '../system-mailbox.js';
import type { OtpPurpose } from './otp.js';

const SUBJECTS: Record<OtpPurpose, string> = {
  login: 'Your ZeroSpam sign-in code',
  signup: 'Claim your ZeroSpam inbox',
  password_set: 'Confirm your ZeroSpam password change',
  sensitive_op: 'Confirm your ZeroSpam request',
};

function bodyText(code: string, purpose: OtpPurpose): string {
  const head = purpose === 'signup' ? 'Welcome to ZeroSpam.' : 'Welcome back.';
  return [
    head,
    '',
    'Your six-digit code:',
    '',
    `   ${code}`,
    '',
    'It expires in 10 minutes.',
    '// you can always say no.',
    '',
    'If you did not request this, ignore this message.',
    '',
    '— Zero·Spam',
  ].join('\n');
}

export async function sendOtpEmail(opts: { to: string; code: string; purpose: OtpPurpose }): Promise<void> {
  const mailboxId = getOrCreateSystemMailboxId();
  await sendMessage({
    mailboxId,
    to: [opts.to],
    subject: SUBJECTS[opts.purpose],
    text: bodyText(opts.code, opts.purpose),
  });
}
