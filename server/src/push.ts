// New-mail push notifications for the mobile app (docs/android-app-spec.md §4.1).
//
// The app registers an Expo push token per device. When mail lands in a mailbox's Inbox
// (never Screener or Quarantine — keeping those quiet is the product), we send one
// notification to every signed-in device of that account through Expo's push service,
// which delivers via Firebase Cloud Messaging on Android.
//
// Fire-and-forget: failures are logged and never affect ingest.

import { db } from './db.js';
import { bus, type AppEvent } from './events.js';
import { config } from './config.js';
import { isAccountEntitled } from './billing.js';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

export const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: { messageId: string; mailboxId: number };
  channelId: 'mail';
  sound: 'default';
  priority: 'high';
};

type Ticket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

export type PushSender = (messages: PushMessage[]) => Promise<Ticket[]>;

const expoSender: PushSender = async (messages) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (config.push.expoAccessToken) headers.Authorization = `Bearer ${config.push.expoAccessToken}`;
  const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
  if (!res.ok) throw new Error(`expo push ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: Ticket[] };
  return json.data ?? [];
};

let sender: PushSender = expoSender;

/** Test hook: replace the network call. Pass null to restore the real sender. */
export function setPushSenderForTests(fn: PushSender | null): void {
  sender = fn ?? expoSender;
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function buildNotification(
  msg: { from_name: string | null; from_address: string; subject: string | null },
  mailboxAddress: string,
  preview: boolean,
): { title: string; body: string } {
  if (!preview) return { title: 'New message', body: `In ${mailboxAddress}` };
  return {
    title: clip(msg.from_name?.trim() || msg.from_address, 80),
    body: clip(msg.subject?.trim() || '(no subject)', 140),
  };
}

/** Send the notification for one newly stored Inbox message. Resolves when done; never throws. */
export async function notifyNewMail(mailboxId: number, messageId: string): Promise<number> {
  try {
    const mailbox = db.prepare('SELECT address, account_id FROM mailboxes WHERE id = ?').get(mailboxId) as
      | { address: string; account_id: number }
      | undefined;
    if (!mailbox || !isAccountEntitled(mailbox.account_id)) return 0;

    const msg = db
      .prepare('SELECT from_name, from_address, subject, folder FROM messages WHERE id = ?')
      .get(messageId) as { from_name: string | null; from_address: string; subject: string | null; folder: string } | undefined;
    if (!msg || msg.folder !== 'inbox') return 0;

    const devices = db
      .prepare(
        `SELECT d.id, d.expo_push_token AS token, d.push_preview AS preview
         FROM devices d JOIN users u ON u.id = d.user_id
         WHERE u.account_id = ? AND d.revoked_at IS NULL AND d.expo_push_token IS NOT NULL`,
      )
      .all(mailbox.account_id) as { id: number; token: string; preview: number }[];
    if (devices.length === 0) return 0;

    let sent = 0;
    for (let i = 0; i < devices.length; i += BATCH) {
      const chunk = devices.slice(i, i + BATCH);
      const messages: PushMessage[] = chunk.map((d) => ({
        to: d.token,
        ...buildNotification(msg, mailbox.address, d.preview === 1),
        data: { messageId, mailboxId },
        channelId: 'mail',
        sound: 'default',
        priority: 'high',
      }));
      const tickets = await sender(messages);
      tickets.forEach((t, j) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered' && chunk[j]) {
          // The app was uninstalled or the token rotated; stop sending to it.
          db.prepare('UPDATE devices SET expo_push_token = NULL WHERE id = ? AND expo_push_token = ?').run(chunk[j].id, chunk[j].token);
        } else {
          // eslint-disable-next-line no-console
          console.warn('[push] ticket error', t.details?.error ?? t.message);
        }
      });
    }
    return sent;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[push] send failed', err instanceof Error ? err.message : err);
    return 0;
  }
}

/** Subscribe to new-mail events. Returns an unsubscribe function. No-op unless PUSH_ENABLED. */
export function startPush(): () => void {
  if (!config.push.enabled) return () => {};
  const handler = (e: AppEvent) => {
    if (e.type === 'message:new' && e.folder === 'inbox') void notifyNewMail(e.mailboxId, e.messageId);
  };
  bus.on('event', handler);
  return () => bus.off('event', handler);
}
