import { describe, it, expect, vi } from 'vitest';
import { GmailConnector } from '../src/connectors/gmail.js';
import type { GmailApi, OAuthExchanger, OAuthTokens } from '../src/connectors/types.js';

const tokens: OAuthTokens = { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000 };

function stubApi(over: Partial<GmailApi> = {}): GmailApi {
  return {
    getProfile: vi.fn(async () => ({ emailAddress: 'alice@gmail.com', historyId: '100' })),
    listHistory: vi.fn(async () => ({ addedMessageIds: ['m1', 'm2'], historyId: '105' })),
    getRawMessage: vi.fn(async (id: string) => Buffer.from(`raw-${id}`)),
    ...over,
  };
}

function stubExchanger(over: Partial<OAuthExchanger> = {}): OAuthExchanger {
  return {
    exchangeCode: vi.fn(async () => tokens),
    refresh: vi.fn(async () => ({ ...tokens, accessToken: 'fresh', expiresAt: Date.now() + 3600_000 })),
    authUrl: vi.fn((state: string) => `https://consent?state=${state}`),
    ...over,
  };
}

describe('GmailConnector', () => {
  it('verifyIdentity returns email and seed cursor (current historyId)', async () => {
    const c = new GmailConnector(() => stubApi(), stubExchanger());
    expect(await c.verifyIdentity(tokens)).toEqual({ email: 'alice@gmail.com', cursor: '100' });
  });

  it('fetchSince collects added messages as raw buffers and advances cursor', async () => {
    const c = new GmailConnector(() => stubApi(), stubExchanger());
    const r = await c.fetchSince(tokens, '100');
    expect(r.messages.map((m) => m.providerMsgId)).toEqual(['m1', 'm2']);
    expect(r.messages[0].raw.toString()).toBe('raw-m1');
    expect(r.nextCursor).toBe('105');
  });

  it('ensureFresh refreshes when the access token is near expiry', async () => {
    const ex = stubExchanger();
    const c = new GmailConnector(() => stubApi(), ex);
    const nearExpiry = { ...tokens, expiresAt: Date.now() + 30_000 };
    const out = await c.ensureFresh(nearExpiry, Date.now());
    expect(ex.refresh).toHaveBeenCalledOnce();
    expect(out.accessToken).toBe('fresh');
  });

  it('ensureFresh does NOT refresh when the token has comfortable life left', async () => {
    const ex = stubExchanger();
    const c = new GmailConnector(() => stubApi(), ex);
    const out = await c.ensureFresh(tokens, Date.now());
    expect(ex.refresh).not.toHaveBeenCalled();
    expect(out.accessToken).toBe('a');
  });
});
