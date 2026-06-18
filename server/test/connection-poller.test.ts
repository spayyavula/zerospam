import { describe, it, expect, vi } from 'vitest';
import { tick, backoffMs } from '../src/connection-poller.js';
import { seedMailbox, seedConnection } from './helpers.js';
import { db } from '../src/db.js';
import { upsertConnection } from '../src/connections-repo.js';
import type { ProviderConnector, OAuthTokens } from '../src/connectors/types.js';

function acct(mb: number): number {
  return (db.prepare('SELECT account_id FROM mailboxes WHERE id = ?').get(mb) as { account_id: number }).account_id;
}

function fakeConnector(over: Partial<ProviderConnector> = {}): ProviderConnector {
  return {
    provider: 'gmail',
    verifyIdentity: vi.fn(async () => ({ email: 'x@gmail.com', cursor: '1' })),
    ensureFresh: vi.fn(async (t: OAuthTokens) => t),
    fetchSince: vi.fn(async () => ({
      messages: [{ providerMsgId: 'm1', raw: rawFrom('boss@acme.com', 'alice@gmail.com') }],
      nextCursor: '200',
    })),
    ...over,
  };
}

function rawFrom(from: string, to: string): Buffer {
  return Buffer.from(
    [`From: ${from}`, `To: ${to}`, `Subject: hi`, `Date: ${new Date().toUTCString()}`,
     `Message-ID: <${Math.random()}@t>`, ``, 'body'].join('\r\n'),
  );
}

describe('connection-poller backoff', () => {
  it('grows exponentially and caps at 1h', () => {
    expect(backoffMs(0)).toBe(60_000);
    expect(backoffMs(1)).toBe(120_000);
    expect(backoffMs(10)).toBe(3_600_000);
  });
});

describe('connection-poller tick', () => {
  it('ingests fetched messages and advances the cursor', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: '100',
    });
    await tick({ connectors: { gmail: fakeConnector() }, now: 1_000_000 });

    const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.cursor).toBe('200');
    expect(row.last_polled_at).toBe(1_000_000);
    expect(row.consecutive_failures).toBe(0);
    const msg = db.prepare("SELECT folder FROM messages WHERE mailbox_id = ?").get(mb) as any;
    expect(msg.folder).toBe('quarantine'); // boss@acme.com not whitelisted
  });

  it('marks needs_reconnect on auth failure', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: '1',
    });
    const c = fakeConnector({
      ensureFresh: vi.fn(async () => { const e: any = new Error('unauth'); e.authError = true; throw e; }),
    });
    await tick({ connectors: { gmail: c }, now: 2_000 });
    const row = db.prepare('SELECT status FROM connections WHERE id = ?').get(id) as any;
    expect(row.status).toBe('needs_reconnect');
  });

  it('records a transient failure (counter increments, status stays active)', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = upsertConnection({
      accountId: acct(mb), mailboxId: mb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: '1',
    });
    const c = fakeConnector({ fetchSince: vi.fn(async () => { throw new Error('503 upstream'); }) });
    await tick({ connectors: { gmail: c }, now: 3_000 });
    const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    expect(row.status).toBe('active');
    expect(row.consecutive_failures).toBe(1);
  });

  it('skips connections that are not yet due (within backoff window)', async () => {
    const mb = seedMailbox('alice@gmail.com');
    const id = seedConnection(acct(mb), mb, { status: 'active', lastPolledAt: 1000, consecutiveFailures: 1 });
    const c = fakeConnector();
    // backoff(1)=120s; lastPolled=1000ms, now=1000+60s → not due yet
    await tick({ connectors: { gmail: c }, now: 1000 + 60_000 });
    expect(c.fetchSince).not.toHaveBeenCalled();
    const row = db.prepare('SELECT last_polled_at FROM connections WHERE id = ?').get(id) as any;
    expect(row.last_polled_at).toBe(1000);
  });

  it('skips needs_reconnect connections', async () => {
    const mb = seedMailbox('alice@gmail.com');
    seedConnection(acct(mb), mb, { status: 'needs_reconnect' });
    const c = fakeConnector();
    await tick({ connectors: { gmail: c }, now: 9_999_999 });
    expect(c.fetchSince).not.toHaveBeenCalled();
  });
});

describe('connection-poller registry', () => {
  it('routes each connection to its provider connector', async () => {
    const gmb = seedMailbox('alice@gmail.com');
    const omb = seedMailbox('bob@outlook.com');
    const gid = upsertConnection({
      accountId: acct(gmb), mailboxId: gmb, provider: 'gmail',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: 'g0',
    });
    const oid = upsertConnection({
      accountId: acct(omb), mailboxId: omb, provider: 'outlook',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: 'o0',
    });

    const gmail = fakeConnector(); // provider 'gmail'; cursor -> '200'
    const outlook: ProviderConnector = {
      provider: 'outlook',
      verifyIdentity: vi.fn(async () => ({ email: 'bob@outlook.com', cursor: 'o0' })),
      ensureFresh: vi.fn(async (t: OAuthTokens) => t),
      fetchSince: vi.fn(async () => ({
        messages: [{ providerMsgId: 'om1', raw: rawFrom('news@beta.io', 'bob@outlook.com') }],
        nextCursor: 'o9',
      })),
    };

    await tick({ connectors: { gmail, outlook }, now: 5_000_000 });

    expect(gmail.fetchSince).toHaveBeenCalled();
    expect(outlook.fetchSince).toHaveBeenCalled();
    expect((db.prepare('SELECT cursor FROM connections WHERE id = ?').get(gid) as any).cursor).toBe('200');
    expect((db.prepare('SELECT cursor FROM connections WHERE id = ?').get(oid) as any).cursor).toBe('o9');
  });

  it('marks a connection needs_reconnect when no connector is registered for its provider', async () => {
    const omb = seedMailbox('bob@outlook.com');
    const oid = upsertConnection({
      accountId: acct(omb), mailboxId: omb, provider: 'outlook',
      tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 }, cursor: 'o0',
    });
    await tick({ connectors: { gmail: fakeConnector() }, now: 6_000_000 }); // no outlook connector
    expect((db.prepare('SELECT status FROM connections WHERE id = ?').get(oid) as any).status).toBe('needs_reconnect');
  });
});
