// server/test/fixtures/owner.ts
import { createOwner, setTotpSecret } from '../../src/users.js';
import { generateTotpSecret } from '../../src/totp.js';
import { createSession, SESSION_COOKIE_NAME } from '../../src/sessions.js';
import { config } from '../../src/config.js';
import { db } from '../../src/db.js';

export async function seedOwner(input: {
  email?: string;
  password?: string;
  totp?: boolean;
  verified?: boolean;
} = {}): Promise<{
  userId: number;
  accountId: number;
  email: string;
  password: string;
  totpSecret: string | null;
}> {
  const email = input.email ?? 'owner@example.com';
  const password = input.password ?? 'hunter2-correct-horse-battery';
  const userId = await createOwner({ email, password, verified: input.verified !== false });
  const accountRow = db.prepare('SELECT account_id FROM users WHERE id = ?').get(userId) as { account_id: number };
  let totpSecret: string | null = null;
  if (input.totp) {
    totpSecret = generateTotpSecret();
    setTotpSecret(userId, totpSecret);
  }
  return { userId, accountId: accountRow.account_id, email, password, totpSecret };
}

export function makeSessionCookie(userId: number): string {
  const { cookieValue } = createSession(userId, config.sessionSecret);
  return `${SESSION_COOKIE_NAME}=${cookieValue}`;
}
