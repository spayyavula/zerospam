import { describe, it, expect, vi } from 'vitest';
import { GraphConnector } from '../src/connectors/graph.js';
import type { GraphApi, OAuthExchanger, OAuthTokens } from '../src/connectors/types.js';

const tokens: OAuthTokens = { accessToken: 'a', refreshToken: 'cache', expiresAt: Date.now() + 3600_000 };

function stubApi(over: Partial<GraphApi> = {}): GraphApi {
  return {
    getProfile: vi.fn(async () => ({ email: 'alice@outlook.com' })),
    seedCursor: vi.fn(async () => 'delta-TOKEN-0'),
    listDelta: vi.fn(async () => ({ addedMessageIds: ['m1', 'm2'], nextCursor: 'delta-TOKEN-1' })),
    getRawMessage: vi.fn(async (id: string) => Buffer.from(`raw-${id}`)),
    ...over,
  };
}

function stubExchanger(over: Partial<OAuthExchanger> = {}): OAuthExchanger {
  return {
    exchangeCode: vi.fn(async () => tokens),
    refresh: vi.fn(async () => ({ ...tokens, accessToken: 'fresh', expiresAt: Date.now() + 3600_000 })),
    authUrl: vi.fn((state: string) => `https://login.microsoftonline.com/common?state=${state}`),
    ...over,
  };
}

describe('GraphConnector', () => {
  it('verifyIdentity returns lowercased email and a seed cursor', async () => {
    const c = new GraphConnector(
      () => stubApi({ getProfile: vi.fn(async () => ({ email: 'Alice@Outlook.com' })) }),
      stubExchanger(),
    );
    expect(await c.verifyIdentity(tokens)).toEqual({ email: 'alice@outlook.com', cursor: 'delta-TOKEN-0' });
  });

  it('fetchSince collects added messages as raw buffers and advances the delta cursor', async () => {
    const c = new GraphConnector(() => stubApi(), stubExchanger());
    const r = await c.fetchSince(tokens, 'delta-TOKEN-0');
    expect(r.messages.map((m) => m.providerMsgId)).toEqual(['m1', 'm2']);
    expect(r.messages[0].raw.toString()).toBe('raw-m1');
    expect(r.nextCursor).toBe('delta-TOKEN-1');
  });

  it('ensureFresh refreshes when near expiry', async () => {
    const ex = stubExchanger();
    const c = new GraphConnector(() => stubApi(), ex);
    const out = await c.ensureFresh({ ...tokens, expiresAt: Date.now() + 30_000 }, Date.now());
    expect(ex.refresh).toHaveBeenCalledOnce();
    expect(out.accessToken).toBe('fresh');
  });

  it('ensureFresh does NOT refresh with comfortable life left', async () => {
    const ex = stubExchanger();
    const c = new GraphConnector(() => stubApi(), ex);
    const out = await c.ensureFresh(tokens, Date.now());
    expect(ex.refresh).not.toHaveBeenCalled();
    expect(out.accessToken).toBe('a');
  });
});
