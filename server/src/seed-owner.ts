import { createOwner, getOwnerByEmail } from './users.js';

export type SeedOwnerOpts = { argv: string[] };

function parse(argv: string[]): { email?: string; password?: string } {
  const out: { email?: string; password?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email') out.email = argv[++i];
    else if (argv[i] === '--password') out.password = argv[++i];
  }
  return out;
}

async function promptVisible(question: string): Promise<string> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function promptHidden(question: string): Promise<string> {
  // Best-effort hidden input: turn off echo via raw mode. Falls back to visible input
  // when not attached to a TTY (e.g. piped input). Always-non-blocking.
  if (!process.stdin.isTTY) return promptVisible(question);
  process.stdout.write(question);
  return new Promise<string>((resolve, reject) => {
    let buf = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (raw: string) => {
      for (const ch of raw) {
        if (ch === '\n' || ch === '\r') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(buf);
        }
        if (ch === '') {
          // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          return reject(new Error('cancelled'));
        }
        if (ch === '' || ch === '\b') {
          // backspace
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

export async function runSeedOwner(opts: SeedOwnerOpts): Promise<void> {
  const flags = parse(opts.argv);
  const email = flags.email ?? (await promptVisible('Owner email: ')).trim();
  if (!email) throw new Error('email is required');
  if (getOwnerByEmail(email)) {
    throw new Error(`Owner already exists: ${email}`);
  }
  const password = flags.password ?? (await promptHidden('Owner password (>=12 chars): '));
  if (password.length < 12) throw new Error('password must be >= 12 chars');
  const id = await createOwner({ email, password });
  // eslint-disable-next-line no-console
  console.log(`✓ owner created: ${email} (id=${id})`);
}

// Direct invocation
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeedOwner({ argv: process.argv.slice(2) }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
