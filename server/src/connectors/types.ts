export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};

export type FetchedMessage = {
  providerMsgId: string;
  raw: Buffer;
};

// Minimal Gmail surface the connector calls. The real impl wraps googleapis;
// tests pass a stub.
export interface GmailApi {
  getProfile(): Promise<{ emailAddress: string; historyId: string }>;
  listHistory(startHistoryId: string): Promise<{ addedMessageIds: string[]; historyId: string }>;
  getRawMessage(id: string): Promise<Buffer>;
}

// Exchanges/refreshes OAuth codes & tokens. Real impl wraps google-auth-library.
export interface OAuthExchanger {
  exchangeCode(code: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<OAuthTokens>;
  authUrl(state: string): string;
}

export interface ProviderConnector {
  provider: 'gmail' | 'outlook';
  verifyIdentity(tokens: OAuthTokens): Promise<{ email: string; cursor: string }>;
  ensureFresh(tokens: OAuthTokens, now: number): Promise<OAuthTokens>;
  fetchSince(
    tokens: OAuthTokens,
    cursor: string,
  ): Promise<{ messages: FetchedMessage[]; nextCursor: string }>;
}
