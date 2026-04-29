import { SMTPServer } from 'smtp-server';
import { db } from './db.js';
import { config } from './config.js';
import { ingest } from './ingest.js';

export function startSmtp() {
  const findMailbox = db.prepare('SELECT id FROM mailboxes WHERE address = ?');
  const findAlias = db.prepare(
    'SELECT id, expires_at, abused FROM aliases WHERE address = ?',
  );

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'],
    size: 25 * 1024 * 1024,
    banner: 'ZeroSpam ESMTP',

    onRcptTo(address, _session, callback) {
      const addr = address.address.toLowerCase();
      if (findMailbox.get(addr)) return callback();
      const alias = findAlias.get(addr) as
        | { id: number; expires_at: number | null; abused: number }
        | undefined;
      if (alias && !alias.abused && (!alias.expires_at || alias.expires_at >= Date.now())) {
        return callback();
      }
      return callback(new Error(`550 5.1.1 No such mailbox: ${address.address}`));
    },

    async onData(stream, session, callback) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of stream as AsyncIterable<Buffer>) {
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks);

        const recipients = session.envelope.rcptTo.map((r) => r.address);
        const ip = session.remoteAddress;

        const results = [];
        for (const rcpt of recipients) {
          const r = await ingest(raw, rcpt, ip);
          results.push({ rcpt, ...r });
        }

        // eslint-disable-next-line no-console
        console.log(`[smtp] received ${raw.length}B for ${recipients.join(',')}`, results.map((r) => `${r.rcpt}:${r.folder ?? 'unknown'}`).join(' '));
        callback();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[smtp] onData error', err);
        callback(new Error('451 4.3.0 Storage error, try again later'));
      }
    },
  });

  server.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[smtp] error', err);
  });

  server.listen(config.smtpPort, () => {
    // eslint-disable-next-line no-console
    console.log(`[smtp] listening on :${config.smtpPort}`);
  });

  return server;
}
