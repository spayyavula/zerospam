import type { FastifyInstance } from 'fastify';
import { db, runInTx } from '../db.js';
import { config } from '../config.js';
import { signState, verifyState } from '../oauth-state.js';
import { GraphConnector } from '../connectors/graph.js';
import { graphApiFor, msExchanger, outlookAuthUrl } from '../connectors/graph-ms.js';
import { upsertConnection } from '../connections-repo.js';
import type { GraphApi, OAuthExchanger, OAuthTokens } from '../connectors/types.js';

// Swappable deps for tests (no network).
let exchanger: OAuthExchanger = msExchanger;
let apiFor: (t: OAuthTokens) => GraphApi = graphApiFor;
let authUrl: (state: string) => Promise<string> = outlookAuthUrl;
export function __setOutlookOAuthDeps(deps: {
  exchanger?: OAuthExchanger;
  apiFor?: (t: OAuthTokens) => GraphApi;
  authUrl?: (state: string) => Promise<string>;
}): void {
  if (deps.exchanger) exchanger = deps.exchanger;
  if (deps.apiFor) apiFor = deps.apiFor;
  if (deps.authUrl) authUrl = deps.authUrl;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export async function outlookOAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/oauth/outlook/start', async (req, reply) => {
    const account = (req as any).account;
    const user = (req as any).user;
    if (!account?.id || !user?.id) return reply.code(401).send({ error: 'unauthorized' });
    if (!config.microsoft.clientId || !config.microsoft.clientSecret) {
      return reply
        .code(503)
        .send({ error: 'Outlook connect unavailable: MICROSOFT_CLIENT_ID/SECRET not configured' });
    }
    const state = signState(
      { v: 1, userId: user.id, accountId: account.id, exp: Date.now() + STATE_TTL_MS },
      config.sessionSecret,
    );
    return reply.redirect(await authUrl(state));
  });

  // Public via PUBLIC_PREFIXES; the signed state token is the auth proof and
  // binds to the originating account.
  app.get('/api/oauth/outlook/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return reply.code(400).send({ error: 'missing code/state' });
    const payload = verifyState(state, config.sessionSecret, Date.now());
    if (!payload) return reply.code(400).send({ error: 'invalid or expired state' });

    let tokens: OAuthTokens;
    let identity: { email: string; cursor: string };
    try {
      const connector = new GraphConnector(apiFor, exchanger);
      tokens = await exchanger.exchangeCode(code);
      identity = await connector.verifyIdentity(tokens);
    } catch (e: any) {
      app.log.error({ err: e }, 'outlook oauth callback failed');
      return reply.code(502).send({ error: 'oauth exchange failed' });
    }

    runInTx(() => {
      let mb = db.prepare('SELECT id FROM mailboxes WHERE address = ?').get(identity.email) as
        | { id: number }
        | undefined;
      if (!mb) {
        const domainName = identity.email.split('@')[1];
        const dom = db
          .prepare(
            `INSERT INTO domains (name, created_at, account_id) VALUES (?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET name = excluded.name RETURNING id`,
          )
          .get(domainName, Date.now(), payload.accountId) as { id: number };
        mb = db
          .prepare(
            `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, account_id, provider, created_at)
             VALUES (?, ?, ?, ?, ?, 'outlook', ?) RETURNING id`,
          )
          .get(identity.email, dom.id, null, config.quarantineTtlHours, payload.accountId, Date.now()) as {
          id: number;
        };
      }
      upsertConnection({
        accountId: payload.accountId,
        mailboxId: mb.id,
        provider: 'outlook',
        tokens,
        cursor: identity.cursor,
      });
    });

    return reply.redirect(`${config.publicBaseUrl || ''}/?connected=outlook`);
  });
}
