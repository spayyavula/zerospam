// Real googleapis-backed factory + OAuth exchanger for GmailConnector.
import { google } from 'googleapis';
import type { GmailApi, OAuthExchanger, OAuthTokens } from './types.js';
import { config, gmailRedirectUri } from '../config.js';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function oauthClient() {
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, gmailRedirectUri());
}

export const googleExchanger: OAuthExchanger = {
  authUrl(state: string): string {
    return oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token every time
      scope: SCOPES,
      state,
    });
  },
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const { tokens } = await oauthClient().getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('google did not return both access and refresh tokens');
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
    };
  },
  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new Error('google refresh returned no access token');
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: credentials.expiry_date ?? Date.now() + 3600_000,
    };
  },
};

export function googleApiFor(tokens: OAuthTokens): GmailApi {
  const auth = oauthClient();
  auth.setCredentials({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
  const gmail = google.gmail({ version: 'v1', auth });
  return {
    async getProfile() {
      const res = await gmail.users.getProfile({ userId: 'me' });
      return {
        emailAddress: res.data.emailAddress ?? '',
        historyId: String(res.data.historyId ?? '0'),
      };
    },
    async listHistory(startHistoryId: string) {
      const added: string[] = [];
      let pageToken: string | undefined;
      let latest = startHistoryId;
      do {
        const res = await gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          historyTypes: ['messageAdded'],
          pageToken,
        });
        if (res.data.historyId) latest = String(res.data.historyId);
        for (const h of res.data.history ?? []) {
          for (const m of h.messagesAdded ?? []) {
            if (m.message?.id) added.push(m.message.id);
          }
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return { addedMessageIds: [...new Set(added)], historyId: latest };
    },
    async getRawMessage(id: string) {
      const res = await gmail.users.messages.get({ userId: 'me', id, format: 'raw' });
      return Buffer.from(String(res.data.raw ?? ''), 'base64url');
    },
  };
}
