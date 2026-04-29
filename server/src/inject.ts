// CLI test injector: drops a synthetic mail straight into the ingest pipeline,
// or speaks SMTP to a running server. Default mode is direct (no server needed).
//
// Usage:
//   npm run inject -- --to alice@x.co --from bob@y.co --subject "hi" --text "hello"
//   npm run inject -- --to alice@x.co --from bob@y.co --smtp   (sends via SMTP on port 2525)

import net from 'node:net';
import { ingest } from './ingest.js';
import { config } from './config.js';

type Args = {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  text: string;
  smtp: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Record<string, string | boolean> = {
    subject: '(test) hello',
    text: 'This is a test message from the ZeroSpam injector.',
    smtp: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--smtp') out.smtp = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        out[key] = val;
        i++;
      } else out[key] = true;
    }
  }
  if (!out.to || !out.from) {
    // eslint-disable-next-line no-console
    console.error('usage: inject --to <addr> --from <addr> [--subject ...] [--text ...] [--smtp]');
    process.exit(2);
  }
  return out as Args;
}

function buildEml(a: Args): Buffer {
  const fromHeader = a.fromName ? `"${a.fromName}" <${a.from}>` : a.from;
  return Buffer.from(
    [
      `From: ${fromHeader}`,
      `To: ${a.to}`,
      `Subject: ${a.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@inject.local>`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      a.text,
    ].join('\r\n'),
  );
}

async function viaSmtp(a: Args, raw: Buffer): Promise<void> {
  return new Promise((resolveP, reject) => {
    const sock = net.createConnection(config.smtpPort, '127.0.0.1');
    let buf = '';
    const steps = [
      `EHLO inject.local\r\n`,
      `MAIL FROM:<${a.from}>\r\n`,
      `RCPT TO:<${a.to}>\r\n`,
      `DATA\r\n`,
    ];
    let stepIdx = 0;
    let phase: 'cmd' | 'data' | 'wait-end' | 'quit' = 'cmd';

    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const lines = buf.split('\r\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line) continue;
        process.stdout.write(`< ${line}\n`);
        const code = line.slice(0, 3);
        if (line[3] === '-') continue; // multi-line continuation

        if (code.startsWith('4') || code.startsWith('5')) {
          reject(new Error(line));
          sock.end();
          return;
        }

        if (phase === 'cmd' && code.startsWith('2')) {
          if (stepIdx < steps.length) {
            const cmd = steps[stepIdx++];
            process.stdout.write(`> ${cmd.trim()}\n`);
            sock.write(cmd);
            if (steps[stepIdx - 1].startsWith('DATA')) phase = 'data';
          }
        } else if (phase === 'data' && code === '354') {
          sock.write(raw);
          sock.write('\r\n.\r\n');
          phase = 'wait-end';
        } else if (phase === 'wait-end' && code.startsWith('2')) {
          sock.write('QUIT\r\n');
          phase = 'quit';
        }
      }
    });
    sock.on('end', () => resolveP());
    sock.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = buildEml(args);

  if (args.smtp) {
    await viaSmtp(args, raw);
    // eslint-disable-next-line no-console
    console.log('sent via SMTP');
  } else {
    const r = await ingest(raw, args.to);
    if (!r) {
      // eslint-disable-next-line no-console
      console.error(`no mailbox: ${args.to}. Run \`npm run seed\` first.`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(`ingested -> ${r.folder} (${r.reason})`);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
