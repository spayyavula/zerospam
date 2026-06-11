import { startSmtp } from './smtp.js';
import { startApi } from './api.js';
import { startSweeper } from './sweeper.js';
import { startDigester } from './digester.js';
import { startConnectionPoller } from './connection-poller.js';

async function main() {
  startSmtp();
  await startApi();
  startSweeper();
  startDigester();
  startConnectionPoller();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
