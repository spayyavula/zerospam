// Real @azure/msal-node + @microsoft/microsoft-graph-client adapter for GraphConnector.
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import type { GraphApi, OAuthExchanger, OAuthTokens } from './types.js';
import { config, outlookRedirectUri } from '../config.js';

const GRAPH_SCOPES = ['Mail.Read', 'offline_access', 'openid', 'profile', 'email', 'User.Read'];
const DELTA_PATH = '/me/mailFolders/inbox/messages/delta';

function cca(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: config.microsoft.clientId,
      clientSecret: config.microsoft.clientSecret,
      authority: `https://login.microsoftonline.com/${config.microsoft.tenant}`,
    },
  });
}

export const msExchanger: OAuthExchanger = {
  // Microsoft's auth URL is async (see outlookAuthUrl); the route awaits that
  // instead. This sync variant exists only to satisfy the interface and throws
  // to make misuse obvious. GraphConnector never calls authUrl.
  authUrl(): string {
    throw new Error('use outlookAuthUrl for Microsoft (async)');
  },
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const client = cca();
    const result = await client.acquireTokenByCode({
      code,
      scopes: GRAPH_SCOPES,
      redirectUri: outlookRedirectUri(),
    });
    if (!result) throw new Error('msal returned no result for acquireTokenByCode');
    return {
      accessToken: result.accessToken,
      refreshToken: client.getTokenCache().serialize(),
      expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600_000,
    };
  },
  async refresh(serializedCache: string): Promise<OAuthTokens> {
    const client = cca();
    client.getTokenCache().deserialize(serializedCache);
    const accounts = await client.getTokenCache().getAllAccounts();
    const account = accounts[0];
    if (!account) {
      const e = new Error('no cached account for silent refresh') as Error & { authError?: boolean };
      e.authError = true;
      throw e;
    }
    const result = await client.acquireTokenSilent({ account, scopes: GRAPH_SCOPES });
    if (!result) {
      const e = new Error('msal acquireTokenSilent returned null') as Error & { authError?: boolean };
      e.authError = true;
      throw e;
    }
    return {
      accessToken: result.accessToken,
      refreshToken: client.getTokenCache().serialize(),
      expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600_000,
    };
  },
};

// Microsoft's auth URL is async; the route awaits this instead of the sync authUrl.
export async function outlookAuthUrl(state: string): Promise<string> {
  return cca().getAuthCodeUrl({ scopes: GRAPH_SCOPES, redirectUri: outlookRedirectUri(), state });
}

function clientFor(accessToken: string): Client {
  return Client.init({ authProvider: (done) => done(null, accessToken) });
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function graphApiFor(tokens: OAuthTokens): GraphApi {
  const client = clientFor(tokens.accessToken);
  return {
    async getProfile() {
      const me = await client.api('/me').select(['mail', 'userPrincipalName']).get();
      return { email: (me.mail ?? me.userPrincipalName ?? '') as string };
    },
    async seedCursor() {
      // Drain the initial delta WITHOUT ingesting; keep only the final deltaLink.
      let res = await client.api(DELTA_PATH).select('id').get();
      while (res['@odata.nextLink']) {
        res = await client.api(res['@odata.nextLink'] as string).get();
      }
      return (res['@odata.deltaLink'] as string | undefined) ?? '';
    },
    async listDelta(cursor: string) {
      const added: string[] = [];
      const collect = (r: { value?: Array<Record<string, unknown>> }) => {
        for (const m of r.value ?? []) {
          if (m['@removed']) continue;
          if (m.id) added.push(m.id as string);
        }
      };
      let res = await client.api(cursor || DELTA_PATH).get();
      collect(res);
      while (res['@odata.nextLink']) {
        res = await client.api(res['@odata.nextLink'] as string).get();
        collect(res);
      }
      const next = (res['@odata.deltaLink'] as string | undefined) ?? cursor;
      return { addedMessageIds: [...new Set(added)], nextCursor: next };
    },
    async getRawMessage(id: string) {
      const stream = (await client
        .api(`/me/messages/${id}/$value`)
        .getStream()) as unknown as NodeJS.ReadableStream;
      return streamToBuffer(stream);
    },
  };
}
