// Polls each active connection on an interval, fetching new provider mail and
// running it through ingest(). Mirrors the shape of sweeper.ts / digester.ts.

import { db } from './db.js';
import type { Connection } from './db.js';
import { ingest } from './ingest.js';
import { config } from './config.js';
import { GmailConnector } from './connectors/gmail.js';
import { googleApiFor, googleExchanger } from './connectors/gmail-google.js';
import { GraphConnector } from './connectors/graph.js';
import { graphApiFor, msExchanger } from './connectors/graph-ms.js';
import type { ProviderConnector } from './connectors/types.js';
import {
  getDecryptedTokens, persistTokens, recordPollSuccess, recordPollFailure, markNeedsReconnect,
} from './connections-repo.js';

const ONE_HOUR_MS = 3_600_000;

export function backoffMs(failures: number): number {
  return Math.min(60_000 * 2 ** failures, ONE_HOUR_MS);
}

function isAuthError(e: unknown): boolean {
  if (e && typeof e === 'object' && (e as any).authError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /401|unauthor|invalid_grant|invalid credentials/i.test(msg);
}

type ConnectorRegistry = Partial<Record<'gmail' | 'outlook', ProviderConnector>>;

function defaultRegistry(): ConnectorRegistry {
  return {
    gmail: new GmailConnector(googleApiFor, googleExchanger),
    outlook: new GraphConnector(graphApiFor, msExchanger),
  };
}

export async function tick(opts: { connectors?: ConnectorRegistry; now: number }): Promise<void> {
  const registry = opts.connectors ?? defaultRegistry();
  const now = opts.now;

  const rows = db
    .prepare("SELECT * FROM connections WHERE status = 'active' ORDER BY id")
    .all() as Connection[];

  for (const conn of rows) {
    const due = conn.last_polled_at == null || conn.last_polled_at + backoffMs(conn.consecutive_failures) <= now;
    if (!due) continue;

    const mailbox = db.prepare('SELECT address FROM mailboxes WHERE id = ?').get(conn.mailbox_id) as
      | { address: string }
      | undefined;
    if (!mailbox) continue;

    const connector = registry[conn.provider];
    if (!connector) {
      markNeedsReconnect(conn.id, `no connector registered for provider ${conn.provider}`);
      continue;
    }

    try {
      const stored = getDecryptedTokens(conn.id);
      if (!stored) {
        markNeedsReconnect(conn.id, 'token decrypt failed');
        continue;
      }
      const fresh = await connector.ensureFresh(stored, now);
      if (fresh.accessToken !== stored.accessToken || fresh.expiresAt !== stored.expiresAt) {
        persistTokens(conn.id, fresh);
      }
      const { messages, nextCursor } = await connector.fetchSince(fresh, conn.cursor ?? '');
      for (const m of messages) {
        try {
          await ingest(m.raw, mailbox.address);
        } catch (e) {
          // One bad message must not stall the connection; log and continue.
          // eslint-disable-next-line no-console
          console.error('[poller] ingest failed', conn.id, m.providerMsgId, e);
        }
      }
      recordPollSuccess(conn.id, nextCursor, now);
    } catch (e) {
      if (isAuthError(e)) {
        markNeedsReconnect(conn.id, e instanceof Error ? e.message : String(e));
      } else {
        recordPollFailure(conn.id, e instanceof Error ? e.message : String(e), now);
      }
    }
  }
}

export function startConnectionPoller(): void {
  const intervalMs = config.connectionPollIntervalSec * 1000;
  setInterval(() => {
    tick({ now: Date.now() }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[poller] tick error', e);
    });
  }, intervalMs).unref();
}
