// server/test/fixtures/owner.ts
import { createOwner, setTotpSecret } from '../../src/users.js';
import { generateTotpSecret } from '../../src/totp.js';
import { createSession, SESSION_COOKIE_NAME } from '../../src/sessions.js';
import { config } from '../../src/config.js';

export async function seedOwner(input: {
  email?: string;
  password?: string;
  totp?: boolean;
} = {}): Promise<{
  userId: number;
  email: string;
  password: string;
  totpSecret: string | null;
}> {
  const email = input.email ?? 'owner@example.com';
  const password = input.password ?? 'hunter2-correct-horse-battery';
  const userId = await createOwner({ email, password });
  let totpSecret: string | null = null;
  if (input.totp) {
    totpSecret = generateTotpSecret();
    setTotpSecret(userId, totpSecret);
  }
  return { userId, email, password, totpSecret };
}

export function makeSessionCookie(userId: number): string {
  const { cookieValue } = createSession(userId, config.sessionSecret);
  return `${SESSION_COOKIE_NAME}=${cookieValue}`;
}
