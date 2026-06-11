import type {
  GmailApi,
  OAuthExchanger,
  OAuthTokens,
  ProviderConnector,
  FetchedMessage,
} from './types.js';

const REFRESH_SKEW_MS = 2 * 60 * 1000; // refresh if < 2 min of life left

export class GmailConnector implements ProviderConnector {
  readonly provider = 'gmail' as const;

  constructor(
    // factory builds a Gmail API client bound to a set of tokens
    private readonly apiFor: (tokens: OAuthTokens) => GmailApi,
    private readonly oauth: OAuthExchanger,
  ) {}

  async verifyIdentity(tokens: OAuthTokens): Promise<{ email: string; cursor: string }> {
    const profile = await this.apiFor(tokens).getProfile();
    return { email: profile.emailAddress.toLowerCase(), cursor: profile.historyId };
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
    const { addedMessageIds, historyId } = await api.listHistory(cursor);
    const messages: FetchedMessage[] = [];
    for (const id of addedMessageIds) {
      messages.push({ providerMsgId: id, raw: await api.getRawMessage(id) });
    }
    return { messages, nextCursor: historyId };
  }
}
