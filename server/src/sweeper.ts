import { db, runInTx } from './db.js';
import { deleteRaw, deleteAttachmentFile } from './storage.js';
import { config } from './config.js';
import { bus } from './events.js';

const findExpired = db.prepare(`
  SELECT id, mailbox_id, raw_path FROM messages
  WHERE folder = 'quarantine' AND expires_at IS NOT NULL AND expires_at < ?
`);
const findAttachmentPaths = db.prepare(
  'SELECT path FROM attachments WHERE message_id = ?',
);
const deleteMsg = db.prepare('DELETE FROM messages WHERE id = ?');

export function startSweeper() {
  const tick = () => {
    const now = Date.now();
    const expired = findExpired.all(now) as { id: string; mailbox_id: number; raw_path: string }[];
    if (expired.length === 0) return;

    // Collect attachment paths *before* deleting (CASCADE will remove the rows).
    const attachmentPaths: string[] = [];
    for (const r of expired) {
      const rows = findAttachmentPaths.all(r.id) as { path: string }[];
      for (const a of rows) attachmentPaths.push(a.path);
    }

    runInTx(() => {
      for (const r of expired) deleteMsg.run(r.id);
    });

    for (const r of expired) {
      deleteRaw(r.raw_path);
      bus.publish({ type: 'message:deleted', mailboxId: r.mailbox_id, messageId: r.id });
    }
    for (const p of attachmentPaths) deleteAttachmentFile(p);

    // eslint-disable-next-line no-console
    console.log(
      `[sweeper] purged ${expired.length} expired quarantine message(s), ${attachmentPaths.length} attachment file(s)`,
    );
  };

  // initial sweep so stale data isn't shown after a restart
  tick();
  const interval = setInterval(tick, config.sweeperIntervalSec * 1000);
  return () => clearInterval(interval);
}
