import { startSmtp } from './smtp.js';
import { startApi } from './api.js';
import { startSweeper } from './sweeper.js';
import { startDigester } from './digester.js';
import { startConnectionPoller } from './connection-poller.js';
import { closeAll, type Closer } from './shutdown.js';
import { config, assertBillingConfig } from './config.js';
import { startPendingTrials, startBillingTicker } from './billing.js';

async function main() {
  assertBillingConfig(config.billing, config.publicBaseUrl);
  if (config.billing.enabled) {
    const started = startPendingTrials();
    // eslint-disable-next-line no-console
    if (started) console.log(`[billing] started the free trial for ${started} existing account(s)`);
  }
  const smtp = startSmtp();
  const app = await startApi();
  startSweeper();
  startDigester();
  startConnectionPoller();
  startBillingTicker();

  const closers: Closer[] = [
    { name: 'smtp', close: () => new Promise<void>((res) => smtp.close(() => res())) },
    { name: 'api', close: () => app.close() },
  ];

  let shuttingDown = false;
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      // eslint-disable-next-line no-console
      console.log(`[shutdown] ${sig} received, closing servers…`);
      closeAll(closers).then((errors) => {
        for (const e of errors) {
          // eslint-disable-next-line no-console
          console.error(`[shutdown] ${e.name} failed to close`, e.err);
        }
        process.exit(0);
      });
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
