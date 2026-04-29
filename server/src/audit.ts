import { db } from './db.js';

export type AuditEvent =
  | 'login.ok'
  | 'login.fail'
  | 'logout'
  | 'password.changed'
  | 'totp.enabled'
  | 'totp.disabled'
  | 'totp.fail'
  | 'device.pair'
  | 'device.revoke'
  | 'device.signout';

export type RecordAuditInput = {
  event: AuditEvent | (string & {}); // allow forward-compat strings
  userId?: number | null;
  detail?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

const stmt = db.prepare(
  `INSERT INTO audit_log (user_id, event, detail, ip, user_agent, at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

export function recordAudit(input: RecordAuditInput): void {
  stmt.run(
    input.userId ?? null,
    input.event,
    input.detail ? JSON.stringify(input.detail) : null,
    input.ip ?? null,
    input.userAgent ?? null,
    Date.now(),
  );
}
