import type {
  GraphApi,
  OAuthExchanger,
  OAuthTokens,
  ProviderConnector,
  FetchedMessage,
} from './types.js';

const REFRESH_SKEW_MS = 2 * 60 * 1000; // refresh if < 2 min of life left

export class GraphConnector implements ProviderConnector {
  readonly provider = 'outlook' as const;

  constructor(
    private readonly apiFor: (tokens: OAuthTokens) => GraphApi,
    private readonly oauth: OAuthExchanger,
  ) {}

  async verifyIdentity(tokens: OAuthTokens): Promise<{ email: string; cursor: string }> {
    const api = this.apiFor(tokens);
    const profile = await api.getProfile();
    const cursor = await api.seedCursor();
    return { email: profile.email.toLowerCase(), cursor };
  }

  async ensureFresh(tokens: OAuthTokens, now: number): Promise<OAuthTokens> {
    if (tokens.expiresAt - now > REFRESH_SKEW_MS) return tokens;
    return this.oauth.refresh(tokens.refreshToken);
  }

  async fetchSince(
    tokens: OAuthTokens,
    cursor: string,
  ): Promise<{ messages: FetchedMessage[]; nextCursor: string }> {
    const api = this.apiFor(tokens);
    const { addedMessageIds, nextCursor } = await api.listDelta(cursor);
    const messages: FetchedMessage[] = [];
    for (const id of addedMessageIds) {
      messages.push({ providerMsgId: id, raw: await api.getRawMessage(id) });
    }
    return { messages, nextCursor };
  }
}
