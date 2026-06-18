import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createReadStream, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db, runInTx } from './db.js';
import type { AttachmentRow, MessageRow } from './db.js';
import { deleteRaw, deleteAttachmentFile } from './storage.js';
import { bus } from './events.js';
import { config } from './config.js';
import { ingest } from './ingest.js';
import { sendMessage } from './sender.js';
import { ensureDkim, dnsRecord } from './dkim.js';
import { authRoutes } from './routes/auth.js';
import { screenerRoutes } from './routes/screener.js';
import { gmailOAuthRoutes } from './routes/oauth-gmail.js';
import { outlookOAuthRoutes } from './routes/oauth-outlook.js';
import { connectionsRoutes } from './routes/connections.js';
import { renderPrivacyPolicyPage, renderTermsOfServicePage } from './legal-pages.js';
import { requireAuth } from './requireAuth.js';
import { SESSION_COOKIE_NAME } from './sessions.js';
import { getScreenerCounts } from './screener.js';
import { registerOpenApi } from './openapi/register.js';

/**
 * Serve the built web SPA (web/dist): static files first, then a catch-all
 * not-found handler that returns index.html for client-side routes. Only
 * GET/HEAD requests outside the server's own route prefixes get the SPA;
 * unknown /api, /auth, /public routes still return a JSON 404.
 */
export async function registerWebSpa(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, { root, wildcard: false });

  const SERVER_PREFIXES = ['/api', '/auth/', '/public/'];
  app.setNotFoundHandler((req, reply) => {
    const isServerRoute = SERVER_PREFIXES.some((p) => req.url === p || req.url.startsWith(p));
    if ((req.method === 'GET' || req.method === 'HEAD') && !isServerRoute) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });
}

// ---- SSRF guard for the image proxy ----
// Block requests whose host resolves into private / loopback / link-local /
// reserved space (incl. the 169.254.169.254 cloud-metadata endpoint), so an
// attacker-supplied <img> URL can't be used to probe internal services.
function ipv4Blocked(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

function ipBlocked(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return ipv4Blocked(ip);
  if (fam === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (mapped) return ipv4Blocked(mapped[1]);
    const head = parseInt(lower.split(':')[0] || '0', 16);
    if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    return false;
  }
  return true; // not a parseable IP → block
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, ''); // strip IPv6 literal brackets
  if (isIP(host)) {
    if (ipBlocked(host)) throw new Error('blocked-address');
    return;
  }
  let records: { address: string }[];
  try {
    records = await dnsLookup(host, { all: true });
  } catch {
    throw new Error('dns-failed');
  }
  if (!records.length || records.some((r) => ipBlocked(r.address))) {
    throw new Error('blocked-address');
  }
}

// Fetch following redirects manually so every hop's host is re-validated; a
// 3xx that points at an internal address is rejected rather than followed.
async function safeFetchImage(rawUrl: string): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new Error('bad-url');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad-protocol');
    await assertPublicHost(parsed.hostname);
    const resp = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'ZeroSpamMail/1.0 (image proxy; +noreferrer)',
        Accept: 'image/*',
      },
    });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (!loc) return resp;
      current = new URL(loc, current).toString();
      continue;
    }
    return resp;
  }
  throw new Error('too-many-redirects');
}

// CSP allows inline <script> blocks in the built index.html (e.g. Vite's
// pre-paint theme setter) by their sha256 hash rather than 'unsafe-inline', so
// only those exact, build-pinned scripts run. Computed from the served file at
// startup, so it auto-tracks changes; empty in dev (Vite serves the SPA itself).
function spaInlineScriptHashes(distPath: string): string[] {
  try {
    const html = readFileSync(join(distPath, 'index.html'), 'utf8');
    const hashes: string[] = [];
    const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      if (!m[1].trim()) continue;
      // The HTML parser normalizes CR/CRLF to LF before the CSP hash is computed,
      // so normalize here too (built index.html may have CRLF on Windows).
      const body = m[1].replace(/\r\n?/g, '\n');
      hashes.push(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
    return hashes;
  } catch {
    return [];
  }
}

export async function startApi(opts: { inject?: boolean } = {}) {
  const app = Fastify({ logger: { level: config.logLevel }, trustProxy: config.trustProxy });
  await app.register(cookie);
  // Security headers (ASVS V14.4). HSTS only takes effect over HTTPS (prod, behind
  // Caddy TLS). The CSP is tuned for the React SPA; revisit if assets fail to load.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...spaInlineScriptHashes(config.webDistPath)],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    // The webmail loads proxied remote images; COEP would block them.
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);   // same-origin / non-browser
      if (origin === config.publicBaseUrl) return cb(null, true); // the app's own origin
      if (config.allowedOrigins.includes(origin)) return cb(null, true);
      // Disallowed: reply WITHOUT CORS headers rather than throwing. Throwing
      // turns every request carrying a foreign Origin — including same-origin
      // asset loads the browser tags `crossorigin` — into a 500. cb(null,false)
      // just omits Access-Control-Allow-Origin, which is the correct rejection.
      cb(null, false);
    },
    credentials: true,
  });

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body: string, done) => {
      try {
        const params = new URLSearchParams(body);
        const out: Record<string, string> = {};
        for (const [k, v] of params) out[k] = v;
        done(null, out);
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  await app.register(rateLimit, { global: false });

  await registerOpenApi(app);

  // Public routes (no auth) — health check + login/logout
  const PUBLIC_PREFIXES = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/signup',
    '/auth/verify',
    '/public/digest/allow',
    '/api/oauth/gmail/callback',
    '/api/oauth/outlook/callback',
    '/openapi.json',
    '/docs',
  ];
  // CSRF defense-in-depth on top of the SameSite=Lax session cookie: reject any
  // state-changing request that carries our session cookie but whose Origin is
  // cross-site. Cookie-less (Bearer/native mobile) clients are unaffected — they
  // aren't subject to browser CSRF. Missing Origin falls through to SameSite.
  const csrfAllowedOrigins = new Set(
    [...config.allowedOrigins, config.publicBaseUrl].filter(Boolean),
  );
  app.addHook('preHandler', async (req, reply) => {
    const method = req.method;
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const cookies = (req as any).cookies as Record<string, string> | undefined;
      const origin = req.headers.origin as string | undefined;
      if (cookies?.[SESSION_COOKIE_NAME] && origin && !csrfAllowedOrigins.has(origin)) {
        reply.code(403).send({ error: 'csrf-origin-rejected' });
        return;
      }
    }
    if (PUBLIC_PREFIXES.some((p) => req.url === p || req.url.startsWith(p + '?'))) return;
    // Static assets and SPA navigation (anything that is not a server route)
    // are public — only server routes go through auth.
    const SERVER_PREFIXES = ['/api', '/auth/', '/public/'];
    const isServerRoute = SERVER_PREFIXES.some((p) => req.url === p || req.url.startsWith(p));
    if (!isServerRoute && (req.method === 'GET' || req.method === 'HEAD')) return;
    // Test-only auth shim. Hard-gated to non-production so a stray inject flag
    // can never bypass auth on a live deployment.
    if (opts.inject && !config.isProd) {
      const a = req.headers['x-test-account'];
      const u = req.headers['x-test-user'];
      if (a) {
        (req as any).account = { id: Number(a) };
        (req as any).user = { id: Number(u ?? a) };
        return;
      }
    }
    await requireAuth(req as any, reply as any);
  });

  await app.register(authRoutes);
  await app.register(screenerRoutes);
  await app.register((await import('./routes/signup.js')).signupRoutes);
  await app.register(gmailOAuthRoutes);
  await app.register(outlookOAuthRoutes);
  await app.register(connectionsRoutes);

  app.get('/privacy-policy', async (_req, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(renderPrivacyPolicyPage());
  });

  app.get('/terms-of-service', async (_req, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(renderTermsOfServicePage());
  });

  app.get('/api/health', async () => ({ ok: true }));

  // ---- mailboxes ----
  function ownsMailbox(accountId: number, mailboxId: number): boolean {
    const r = db
      .prepare('SELECT 1 FROM mailboxes WHERE id = ? AND account_id = ?')
      .get(mailboxId, accountId);
    return !!r;
  }

  function ownsMessage(accountId: number, messageId: string): boolean {
    const r = db
      .prepare(`
        SELECT 1 FROM messages m
        JOIN mailboxes b ON b.id = m.mailbox_id
        WHERE m.id = ? AND b.account_id = ?
      `)
      .get(messageId, accountId);
    return !!r;
  }

  function ownsAttachment(accountId: number, attachmentId: number): boolean {
    const r = db
      .prepare(`
        SELECT 1 FROM attachments a
        JOIN messages m ON m.id = a.message_id
        JOIN mailboxes b ON b.id = m.mailbox_id
        WHERE a.id = ? AND b.account_id = ?
      `)
      .get(attachmentId, accountId);
    return !!r;
  }

  function ownsDraft(accountId: number, draftId: string): boolean {
    const r = db
      .prepare(`
        SELECT 1 FROM drafts d
        JOIN mailboxes b ON b.id = d.mailbox_id
        WHERE d.id = ? AND b.account_id = ?
      `)
      .get(draftId, accountId);
    return !!r;
  }

  function ownsAlias(accountId: number, aliasId: number): boolean {
    const r = db
      .prepare(`
        SELECT 1 FROM aliases a
        JOIN mailboxes b ON b.id = a.mailbox_id
        WHERE a.id = ? AND b.account_id = ?
      `)
      .get(aliasId, accountId);
    return !!r;
  }

  app.get('/api/mailboxes', async (req) => {
    const accountId = (req as any).account?.id ?? 0;
    return db
      .prepare(`SELECT * FROM mailboxes WHERE account_id = ? ORDER BY address`)
      .all(accountId);
  });

  const newMailboxSchema = z.object({
    address: z.string().email(),
    displayName: z.string().optional(),
    quarantineTtlHours: z.coerce.number().int().min(1).max(8760).default(168),
  });

  app.post('/api/mailboxes', async (req, reply) => {
    const body = newMailboxSchema.parse(req.body);
    const addr = body.address.toLowerCase();
    const domain = addr.split('@')[1];
    if (!domain) return reply.code(400).send({ error: 'invalid address' });
    const existing = db.prepare('SELECT id FROM mailboxes WHERE address = ?').get(addr);
    if (existing) return reply.code(409).send({ error: 'mailbox exists' });
    const dom = db
      .prepare(
        `INSERT INTO domains (name, created_at) VALUES (?, ?)
         ON CONFLICT(name) DO UPDATE SET name = excluded.name
         RETURNING id`,
      )
      .get(domain, Date.now()) as { id: number };
    ensureDkim(dom.id);
    const result = db
      .prepare(
        `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, created_at)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(addr, dom.id, body.displayName ?? null, body.quarantineTtlHours, Date.now()) as {
      id: number;
    };
    return { id: result.id };
  });

  const patchMailboxSchema = z.object({
    displayName: z.string().nullable().optional(),
    quarantineTtlHours: z.coerce.number().int().min(1).max(8760).optional(),
    screenerSlaHours: z.coerce.number().int().min(1).max(720).optional(),
    screener_sla_hours: z.coerce.number().int().min(1).max(720).optional(),
    digestEnabled: z.boolean().optional(),
    digestHour: z.coerce.number().int().min(0).max(23).optional(),
    digestRecipientMode: z.enum(['external', 'loopback']).optional(),
    ownerEmail: z.string().email().nullable().optional(),
  });

  app.patch('/api/mailboxes/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const id = Number((req.params as { id: string }).id);
    if (!ownsMailbox(accountId, id)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const parsed = patchMailboxSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'invalid-body' });
    }
    const body = parsed.data;
    const screenerSlaHours = body.screenerSlaHours ?? body.screener_sla_hours;

    // Validate cross-field constraints based on the post-merge state.
    const current = db
      .prepare('SELECT digest_enabled, digest_recipient_mode, owner_email FROM mailboxes WHERE id = ?')
      .get(id) as
      | { digest_enabled: number; digest_recipient_mode: 'external' | 'loopback'; owner_email: string | null }
      | undefined;
    if (!current) return reply.code(404).send({ error: 'mailbox not found' });

    const nextEnabled = body.digestEnabled ?? Boolean(current.digest_enabled);
    const nextMode = body.digestRecipientMode ?? current.digest_recipient_mode;
    const nextOwner = body.ownerEmail !== undefined ? body.ownerEmail : current.owner_email;

    if (nextEnabled && nextMode === 'external' && !nextOwner) {
      return reply.code(400).send({ error: 'owner_email is required when external digest is enabled' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(body.displayName);
    }
    if (body.quarantineTtlHours !== undefined) {
      fields.push('quarantine_ttl_hours = ?');
      values.push(body.quarantineTtlHours);
    }
    if (screenerSlaHours !== undefined) {
      fields.push('screener_sla_hours = ?');
      values.push(screenerSlaHours);
    }
    if (body.digestEnabled !== undefined) {
      fields.push('digest_enabled = ?');
      values.push(body.digestEnabled ? 1 : 0);
    }
    if (body.digestHour !== undefined) {
      fields.push('digest_hour = ?');
      values.push(body.digestHour);
    }
    if (body.digestRecipientMode !== undefined) {
      fields.push('digest_recipient_mode = ?');
      values.push(body.digestRecipientMode);
    }
    if (body.ownerEmail !== undefined) {
      fields.push('owner_email = ?');
      values.push(body.ownerEmail);
    }
    if (!fields.length) return { ok: true };
    values.push(id);
    db.prepare(`UPDATE mailboxes SET ${fields.join(', ')} WHERE id = ?`).run(...(values as any[]));

    if (nextEnabled && nextMode === 'loopback') {
      const { ensureDigestSelfWhitelist } = await import('./digester.js');
      ensureDigestSelfWhitelist(id);
    }
    return { ok: true };
  });

  app.delete('/api/mailboxes/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const id = Number((req.params as { id: string }).id);
    if (!ownsMailbox(accountId, id)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const msgs = db
      .prepare('SELECT raw_path FROM messages WHERE mailbox_id = ?')
      .all(id) as { raw_path: string }[];
    const atts = db
      .prepare(
        'SELECT path FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE mailbox_id = ?)',
      )
      .all(id) as { path: string }[];
    db.prepare('DELETE FROM mailboxes WHERE id = ?').run(id);
    for (const m of msgs) deleteRaw(m.raw_path);
    for (const a of atts) deleteAttachmentFile(a.path);
    return { ok: true };
  });

  app.get('/api/mailboxes/:id/counts', async (req, reply) => {
    const { id } = req.params as { id: string };
    const accountId = (req as any).account?.id ?? 0;
    if (!ownsMailbox(accountId, Number(id))) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const rows = db
      .prepare(
        `SELECT folder, COUNT(*) AS total, SUM(CASE WHEN read=0 THEN 1 ELSE 0 END) AS unread
         FROM messages WHERE mailbox_id = ? GROUP BY folder`,
      )
      .all(Number(id)) as { folder: string; total: number; unread: number }[];
    const out: Record<string, { total: number; unread: number }> = {
      inbox: { total: 0, unread: 0 },
      screener: { total: 0, unread: 0 },
      quarantine: { total: 0, unread: 0 },
      sent: { total: 0, unread: 0 },
      trash: { total: 0, unread: 0 },
      drafts: { total: 0, unread: 0 },
    };
    for (const r of rows) out[r.folder] = { total: r.total, unread: r.unread };
    const draftsCount = (db
      .prepare('SELECT COUNT(*) AS c FROM drafts WHERE mailbox_id = ?')
      .get(Number(id)) as { c: number }).c;
    out.drafts = { total: draftsCount, unread: 0 };
    out.screener = getScreenerCounts(Number(id));
    return out;
  });

  // ---- messages ----
  const listQ = z.object({
    mailboxId: z.coerce.number(),
    folder: z.enum(['inbox', 'quarantine', 'sent', 'trash']),
    limit: z.coerce.number().min(1).max(200).default(100),
    offset: z.coerce.number().min(0).default(0),
  });

  app.get('/api/messages', async (req, reply) => {
    const q = listQ.parse(req.query);
    const accountId = (req as any).account?.id ?? 0;
    if (!ownsMailbox(accountId, q.mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    return db
      .prepare(
        `SELECT id, mailbox_id, folder, from_address, from_name, to_addresses, subject, preview,
                received_at, expires_at, read, starred, spf_pass, dkim_pass, dmarc_pass,
                whitelist_match, size_bytes, attachment_count
         FROM messages
         WHERE mailbox_id = ? AND folder = ?
         ORDER BY received_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(q.mailboxId, q.folder, q.limit, q.offset);
  });

  // ---- search ----
  // FTS5 across all folders for the mailbox; ranks by relevance.
  const searchQ = z.object({
    mailboxId: z.coerce.number(),
    q: z.string().min(1),
    folder: z.enum(['inbox', 'quarantine', 'sent', 'trash']).optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
  });

  app.get('/api/search', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const mailboxId = Number((req.query as { mailboxId?: string }).mailboxId);
    if (!ownsMailbox(accountId, mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const { q, folder, limit } = searchQ.parse(req.query);
    // Sanitize the FTS query — escape double quotes and wrap each term as a prefix match.
    // Users get "boss" → matches boss, bossy, etc. without needing FTS5 syntax.
    const terms = q
      .replace(/"/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"*`);
    if (!terms.length) return [];
    const ftsExpr = terms.join(' ');
    const rows = folder
      ? db
          .prepare(
            `SELECT m.id, m.mailbox_id, m.folder, m.from_address, m.from_name, m.subject, m.preview,
                    m.received_at, m.expires_at, m.read, m.starred, m.attachment_count, m.whitelist_match
             FROM messages_fts f
             JOIN messages m ON m.id = f.message_id
             WHERE f.mailbox_id = ? AND f.messages_fts MATCH ? AND m.folder = ?
             ORDER BY rank LIMIT ?`,
          )
          .all(mailboxId, ftsExpr, folder, limit)
      : db
          .prepare(
            `SELECT m.id, m.mailbox_id, m.folder, m.from_address, m.from_name, m.subject, m.preview,
                    m.received_at, m.expires_at, m.read, m.starred, m.attachment_count, m.whitelist_match
             FROM messages_fts f
             JOIN messages m ON m.id = f.message_id
             WHERE f.mailbox_id = ? AND f.messages_fts MATCH ?
             ORDER BY rank LIMIT ?`,
          )
          .all(mailboxId, ftsExpr, limit);
    return rows;
  });

  app.get('/api/messages/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    return row;
  });

  app.get('/api/messages/:id/trackers', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const row = db
      .prepare('SELECT tracker_count, tracker_details FROM messages WHERE id = ?')
      .get(id) as { tracker_count: number; tracker_details: string | null } | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    let hits: unknown[] = [];
    try {
      hits = row.tracker_details ? JSON.parse(row.tracker_details) : [];
    } catch {
      hits = [];
    }
    return { count: row.tracker_count, hits };
  });

  // Image proxy: when the user clicks "show remote content", img tags are rewritten
  // through this route. We fetch the image with stripped Referer/UA, validate the
  // content type, then stream back. The sender's tracking endpoint sees a request
  // from our server, not from the user's browser/IP.
  app.get('/api/proxy/image', async (req, reply) => {
    const url = (req.query as { url?: string }).url ?? '';
    if (!/^https?:\/\//i.test(url)) {
      return reply.code(400).send({ error: 'bad url' });
    }
    let resp: Response;
    try {
      resp = await safeFetchImage(url);
    } catch (e: any) {
      const msg = e?.message ?? 'fetch failed';
      // Don't leak internal-topology detail; collapse SSRF rejections to 400.
      if (msg === 'blocked-address' || msg === 'bad-url' || msg === 'bad-protocol') {
        return reply.code(400).send({ error: 'bad url' });
      }
      return reply.code(502).send({ error: msg });
    }
    if (!resp.ok || !resp.body) {
      return reply.code(resp.status || 502).send({ error: `upstream ${resp.status}` });
    }
    const ct = resp.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) {
      return reply.code(415).send({ error: 'not an image' });
    }
    const len = resp.headers.get('content-length');
    if (len && Number(len) > 10 * 1024 * 1024) {
      return reply.code(413).send({ error: 'too large' });
    }
    reply.header('Content-Type', ct);
    reply.header('Cache-Control', 'public, max-age=3600');
    reply.header('Referrer-Policy', 'no-referrer');
    return reply.send(resp.body);
  });

  app.get('/api/messages/:id/attachments', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    return db
      .prepare(
        'SELECT id, filename, content_type, size_bytes, cid, inline FROM attachments WHERE message_id = ? ORDER BY id',
      )
      .all(id);
  });

  app.get('/api/attachments/:id/download', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsAttachment(accountId, Number(id))) return reply.code(404).send({ error: 'attachment not found' });
    const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(id)) as
      | AttachmentRow
      | undefined;
    if (!att) return reply.code(404).send({ error: 'not found' });
    let stat;
    try {
      stat = statSync(att.path);
    } catch {
      return reply.code(410).send({ error: 'file gone' });
    }
    const filename = (att.filename ?? `attachment-${att.id}`).replace(/"/g, '');
    reply.header('Content-Type', att.content_type ?? 'application/octet-stream');
    reply.header('Content-Length', stat.size);
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(createReadStream(att.path));
  });

  app.post('/api/messages/:id/read', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const body = (req.body as { read?: boolean }) ?? {};
    db.prepare('UPDATE messages SET read = ? WHERE id = ?').run(body.read === false ? 0 : 1, id);
    const row = db.prepare('SELECT mailbox_id FROM messages WHERE id = ?').get(id) as { mailbox_id: number } | undefined;
    if (row) bus.publish({ type: 'message:updated', mailboxId: row.mailbox_id, messageId: id });
    return { ok: true };
  });

  app.post('/api/messages/:id/star', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const body = (req.body as { starred?: boolean }) ?? {};
    db.prepare('UPDATE messages SET starred = ? WHERE id = ?').run(body.starred ? 1 : 0, id);
    const row = db.prepare('SELECT mailbox_id FROM messages WHERE id = ?').get(id) as { mailbox_id: number } | undefined;
    if (row) bus.publish({ type: 'message:updated', mailboxId: row.mailbox_id, messageId: id });
    return { ok: true };
  });

  app.post('/api/messages/:id/move', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const folder = z
      .object({ folder: z.enum(['inbox', 'quarantine', 'trash']) })
      .parse(req.body).folder;
    const row = db.prepare('SELECT mailbox_id FROM messages WHERE id = ?').get(id) as { mailbox_id: number } | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    if (folder === 'quarantine') {
      db.prepare('UPDATE messages SET folder = ? WHERE id = ?').run(folder, id);
    } else {
      db.prepare('UPDATE messages SET folder = ?, expires_at = NULL WHERE id = ?').run(folder, id);
    }
    bus.publish({ type: 'message:updated', mailboxId: row.mailbox_id, messageId: id });
    return { ok: true };
  });

  app.delete('/api/messages/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const row = db.prepare('SELECT mailbox_id, raw_path FROM messages WHERE id = ?').get(id) as
      | { mailbox_id: number; raw_path: string }
      | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    const atts = db
      .prepare('SELECT path FROM attachments WHERE message_id = ?')
      .all(id) as { path: string }[];
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    deleteRaw(row.raw_path);
    for (const a of atts) deleteAttachmentFile(a.path);
    bus.publish({ type: 'message:deleted', mailboxId: row.mailbox_id, messageId: id });
    return { ok: true };
  });

  // ---- bulk ----
  const bulkSchema = z.object({
    ids: z.array(z.string()).min(1).max(500),
    action: z.enum([
      'mark-read',
      'mark-unread',
      'star',
      'unstar',
      'move-trash',
      'move-inbox',
      'move-quarantine',
      'delete',
      'trust-sender',
    ]),
  });

  app.post('/api/messages/bulk', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { ids: rawIds, action } = bulkSchema.parse(req.body);
    // Filter to only IDs owned by the caller's account
    const ownedRows = rawIds.length === 0
      ? []
      : (db.prepare(`
          SELECT m.id FROM messages m
          JOIN mailboxes b ON b.id = m.mailbox_id
          WHERE b.account_id = ? AND m.id IN (${rawIds.map(() => '?').join(',')})
        `).all(accountId, ...rawIds) as { id: string }[]);
    const ownedIdSet = new Set(ownedRows.map((r) => r.id));
    const ids = rawIds.filter((id) => ownedIdSet.has(id));

    if (ids.length === 0) return { ok: true, affected: 0 };

    const placeholders = ids.map(() => '?').join(',');

    const affectedMailboxes = new Set<number>();
    const rows = db
      .prepare(`SELECT id, mailbox_id, from_address, raw_path FROM messages WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string; mailbox_id: number; from_address: string; raw_path: string }>;
    for (const r of rows) affectedMailboxes.add(r.mailbox_id);

    runInTx(() => {
      switch (action) {
        case 'mark-read':
          db.prepare(`UPDATE messages SET read = 1 WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'mark-unread':
          db.prepare(`UPDATE messages SET read = 0 WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'star':
          db.prepare(`UPDATE messages SET starred = 1 WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'unstar':
          db.prepare(`UPDATE messages SET starred = 0 WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'move-trash':
          db.prepare(`UPDATE messages SET folder = 'trash', expires_at = NULL WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'move-inbox':
          db.prepare(`UPDATE messages SET folder = 'inbox', expires_at = NULL WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'move-quarantine':
          db.prepare(`UPDATE messages SET folder = 'quarantine' WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'delete':
          db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...ids);
          break;
        case 'trust-sender': {
          const seen = new Set<string>();
          const ins = db.prepare(
            'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
          );
          const now = Date.now();
          for (const r of rows) {
            const key = `${r.mailbox_id}|${r.from_address}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const exists = db
              .prepare(
                'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
              )
              .get(r.mailbox_id, 'address', r.from_address);
            if (!exists) ins.run(r.mailbox_id, 'address', r.from_address, 'trust-sender (bulk)', now);
          }
          db.prepare(
            `UPDATE messages SET folder = 'inbox', expires_at = NULL WHERE id IN (${placeholders})`,
          ).run(...ids);
          break;
        }
      }
    });

    if (action === 'delete') {
      for (const r of rows) deleteRaw(r.raw_path);
      const atts = db
        .prepare(`SELECT path FROM attachments WHERE message_id IN (${placeholders})`)
        .all(...ids) as { path: string }[];
      for (const a of atts) deleteAttachmentFile(a.path);
    }

    for (const mid of affectedMailboxes) {
      if (action === 'trust-sender') bus.publish({ type: 'whitelist:changed', mailboxId: mid });
      for (const r of rows.filter((x) => x.mailbox_id === mid)) {
        bus.publish({
          type: action === 'delete' ? 'message:deleted' : 'message:updated',
          mailboxId: mid,
          messageId: r.id,
        });
      }
    }

    return { ok: true, affected: rows.length };
  });

  app.post('/api/quarantine/:mailboxId/purge', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const mailboxId = Number((req.params as { mailboxId: string }).mailboxId);
    if (!ownsMailbox(accountId, mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const rows = db
      .prepare("SELECT id, raw_path FROM messages WHERE mailbox_id = ? AND folder = 'quarantine'")
      .all(mailboxId) as { id: string; raw_path: string }[];
    const atts = db
      .prepare(
        "SELECT path FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE mailbox_id = ? AND folder = 'quarantine')",
      )
      .all(mailboxId) as { path: string }[];
    runInTx(() => {
      db.prepare("DELETE FROM messages WHERE mailbox_id = ? AND folder = 'quarantine'").run(
        mailboxId,
      );
    });
    for (const r of rows) {
      deleteRaw(r.raw_path);
      bus.publish({ type: 'message:deleted', mailboxId, messageId: r.id });
    }
    for (const a of atts) deleteAttachmentFile(a.path);
    return { ok: true, purged: rows.length };
  });

  // ---- whitelist ----
  app.get('/api/whitelist', async (req, reply) => {
    const { mailboxId } = z.object({ mailboxId: z.coerce.number() }).parse(req.query);
    const accountId = (req as any).account?.id ?? 0;
    if (!ownsMailbox(accountId, mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    return db
      .prepare('SELECT * FROM whitelist_rules WHERE mailbox_id = ? ORDER BY id')
      .all(mailboxId);
  });

  const ruleIn = z.object({
    mailboxId: z.number(),
    kind: z.enum(['address', 'domain', 'regex']),
    pattern: z.string().min(1),
    note: z.string().optional(),
  });

  app.post('/api/whitelist', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const r = ruleIn.parse(req.body);
    if (!ownsMailbox(accountId, r.mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const result = db
      .prepare(
        'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
      )
      .get(r.mailboxId, r.kind, r.pattern, r.note ?? null, Date.now()) as { id: number };
    bus.publish({ type: 'whitelist:changed', mailboxId: r.mailboxId });
    return { id: result.id };
  });

  app.delete('/api/whitelist/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    const owned = db.prepare(`
      SELECT 1 FROM whitelist_rules w
      JOIN mailboxes b ON b.id = w.mailbox_id
      WHERE w.id = ? AND b.account_id = ?
    `).get(Number(id), accountId);
    if (!owned) {
      return reply.code(404).send({ error: 'whitelist rule not found' });
    }
    const row = db.prepare('SELECT mailbox_id FROM whitelist_rules WHERE id = ?').get(Number(id)) as
      | { mailbox_id: number }
      | undefined;
    db.prepare('DELETE FROM whitelist_rules WHERE id = ?').run(Number(id));
    if (row) bus.publish({ type: 'whitelist:changed', mailboxId: row.mailbox_id });
    return { ok: true };
  });

  // Convenience: whitelist the sender of a quarantined message and move it to inbox.
  app.post('/api/messages/:id/trust-sender', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
    if (!msg) return reply.code(404).send({ error: 'not found' });
    const exists = db
      .prepare('SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?')
      .get(msg.mailbox_id, 'address', msg.from_address);
    if (!exists) {
      db.prepare(
        'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(msg.mailbox_id, 'address', msg.from_address, 'trust-sender', Date.now());
    }
    db.prepare("UPDATE messages SET folder='inbox', expires_at=NULL WHERE id = ?").run(id);
    bus.publish({ type: 'whitelist:changed', mailboxId: msg.mailbox_id });
    bus.publish({ type: 'message:updated', mailboxId: msg.mailbox_id, messageId: id });
    return { ok: true };
  });

  // ---- drafts ----
  const draftIn = z.object({
    mailboxId: z.coerce.number(),
    to: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
    bcc: z.array(z.string()).optional(),
    subject: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    inReplyTo: z.string().nullable().optional(),
    references: z.string().nullable().optional(),
    replyToMessageId: z.string().nullable().optional(),
  });

  const draftPatch = draftIn.partial().omit({ mailboxId: true });

  app.get('/api/drafts', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const mailboxId = Number((req.query as { mailboxId?: string }).mailboxId);
    if (!ownsMailbox(accountId, mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    return db
      .prepare(
        `SELECT id, mailbox_id, to_addresses, cc_addresses, bcc_addresses,
                subject, body_text, body_html, in_reply_to, references_header,
                reply_to_message_id, created_at, updated_at
         FROM drafts WHERE mailbox_id = ? ORDER BY updated_at DESC`,
      )
      .all(mailboxId);
  });

  app.get('/api/drafts/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsDraft(accountId, id)) return reply.code(404).send({ error: 'draft not found' });
    const row = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id);
    if (!row) return reply.code(404).send({ error: 'not found' });
    return row;
  });

  app.post('/api/drafts', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const b = draftIn.parse(req.body);
    if (!ownsMailbox(accountId, b.mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const id = (await import('nanoid')).nanoid();
    const now = Date.now();
    db.prepare(
      `INSERT INTO drafts (id, mailbox_id, to_addresses, cc_addresses, bcc_addresses,
                           subject, body_text, body_html, in_reply_to, references_header,
                           reply_to_message_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      b.mailboxId,
      b.to?.length ? JSON.stringify(b.to) : null,
      b.cc?.length ? JSON.stringify(b.cc) : null,
      b.bcc?.length ? JSON.stringify(b.bcc) : null,
      b.subject ?? null,
      b.text ?? null,
      b.html ?? null,
      b.inReplyTo ?? null,
      b.references ?? null,
      b.replyToMessageId ?? null,
      now,
      now,
    );
    return { id };
  });

  app.patch('/api/drafts/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsDraft(accountId, id)) return reply.code(404).send({ error: 'draft not found' });
    const b = draftPatch.parse(req.body);
    const exists = db.prepare('SELECT id FROM drafts WHERE id = ?').get(id);
    if (!exists) return reply.code(404).send({ error: 'not found' });

    const fields: string[] = [];
    const values: unknown[] = [];
    if (b.to !== undefined) {
      fields.push('to_addresses = ?');
      values.push(b.to?.length ? JSON.stringify(b.to) : null);
    }
    if (b.cc !== undefined) {
      fields.push('cc_addresses = ?');
      values.push(b.cc?.length ? JSON.stringify(b.cc) : null);
    }
    if (b.bcc !== undefined) {
      fields.push('bcc_addresses = ?');
      values.push(b.bcc?.length ? JSON.stringify(b.bcc) : null);
    }
    if (b.subject !== undefined) {
      fields.push('subject = ?');
      values.push(b.subject ?? null);
    }
    if (b.text !== undefined) {
      fields.push('body_text = ?');
      values.push(b.text ?? null);
    }
    if (b.html !== undefined) {
      fields.push('body_html = ?');
      values.push(b.html ?? null);
    }
    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);
    db.prepare(`UPDATE drafts SET ${fields.join(', ')} WHERE id = ?`).run(
      ...(values as any[]),
    );
    return { ok: true };
  });

  app.delete('/api/drafts/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsDraft(accountId, id)) return reply.code(404).send({ error: 'draft not found' });
    db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
    return { ok: true };
  });

  app.post('/api/drafts/:id/send', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    const draft = db
      .prepare(
        `SELECT d.* FROM drafts d
         JOIN mailboxes m ON m.id = d.mailbox_id
         WHERE d.id = ? AND m.account_id = ?`,
      )
      .get(id, accountId) as
      | {
          mailbox_id: number;
          to_addresses: string | null;
          cc_addresses: string | null;
          bcc_addresses: string | null;
          subject: string | null;
          body_text: string | null;
          body_html: string | null;
          in_reply_to: string | null;
          references_header: string | null;
        }
      | undefined;
    if (!draft) return reply.code(404).send({ error: 'draft not found' });
    const to = draft.to_addresses ? (JSON.parse(draft.to_addresses) as string[]) : [];
    if (!to.length) return reply.code(400).send({ error: 'draft has no recipients' });
    try {
      const r = await sendMessage({
        mailboxId: draft.mailbox_id,
        to,
        cc: draft.cc_addresses ? (JSON.parse(draft.cc_addresses) as string[]) : undefined,
        bcc: draft.bcc_addresses ? (JSON.parse(draft.bcc_addresses) as string[]) : undefined,
        subject: draft.subject ?? '(no subject)',
        text: draft.body_text ?? undefined,
        html: draft.body_html ?? undefined,
        inReplyTo: draft.in_reply_to ?? undefined,
        references: draft.references_header ?? undefined,
        draftId: id,
      });
      return r;
    } catch (e: any) {
      app.log.error({ err: e }, 'draft send failed');
      return reply.code(400).send({ error: e?.message ?? 'send failed' });
    }
  });

  // ---- reply prefill ----
  app.get('/api/messages/:id/reply', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    if (!ownsMessage(accountId, id)) return reply.code(404).send({ error: 'message not found' });
    const mode = z
      .object({ mode: z.enum(['reply', 'reply-all', 'forward']).default('reply') })
      .parse(req.query).mode;
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as
      | MessageRow
      | undefined;
    if (!msg) return reply.code(404).send({ error: 'not found' });

    const mailbox = db
      .prepare('SELECT * FROM mailboxes WHERE id = ?')
      .get(msg.mailbox_id) as { address: string } | undefined;
    const ourAddress = mailbox?.address.toLowerCase() ?? '';
    const origTo = msg.to_addresses ? (JSON.parse(msg.to_addresses) as string[]) : [];
    const origCc = msg.cc_addresses ? (JSON.parse(msg.cc_addresses) as string[]) : [];

    // Build the original Message-ID for In-Reply-To. We don't always have one stored,
    // but we know our synthetic format and that incoming messages have it in the raw eml.
    // Best-effort: parse from raw .eml.
    let origMsgId: string | null = null;
    try {
      const raw = (await import('node:fs')).readFileSync(msg.raw_path, 'utf8');
      const m = raw.match(/^Message-ID:\s*(<[^>]+>)/im);
      if (m) origMsgId = m[1];
    } catch {
      // ignore
    }
    const refs = [msg.in_reply_to, origMsgId].filter(Boolean).join(' ');

    const date = new Date(msg.received_at);
    const dateStr = date.toUTCString();
    const senderLabel = msg.from_name
      ? `${msg.from_name} <${msg.from_address}>`
      : msg.from_address;

    function quote(text: string | null): string {
      if (!text) return '';
      return text
        .split(/\r?\n/)
        .map((l) => `> ${l}`)
        .join('\n');
    }

    function rePrefix(s: string | null, p: 'Re' | 'Fwd'): string {
      const subj = (s ?? '').trim();
      const re = new RegExp(`^${p}:\\s*`, 'i');
      return re.test(subj) ? subj : `${p}: ${subj || '(no subject)'}`;
    }

    if (mode === 'forward') {
      const subject = rePrefix(msg.subject, 'Fwd');
      const text =
        `\n\n---------- Forwarded message ----------\n` +
        `From: ${senderLabel}\n` +
        `Date: ${dateStr}\n` +
        `Subject: ${msg.subject ?? ''}\n` +
        `To: ${origTo.join(', ')}\n\n` +
        (msg.body_text ?? '');
      return {
        mode,
        mailboxId: msg.mailbox_id,
        to: [],
        cc: [],
        subject,
        text,
        inReplyTo: null,
        references: null,
        replyToMessageId: msg.id,
      };
    }

    const subject = rePrefix(msg.subject, 'Re');
    const head = `\n\nOn ${dateStr}, ${senderLabel} wrote:\n`;
    const text = head + quote(msg.body_text);
    const to = [msg.from_address];
    let cc: string[] = [];
    if (mode === 'reply-all') {
      const seen = new Set([ourAddress, msg.from_address.toLowerCase()]);
      cc = [...origTo, ...origCc].filter((a) => {
        const k = a.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    return {
      mode,
      mailboxId: msg.mailbox_id,
      to,
      cc,
      subject,
      text,
      inReplyTo: origMsgId,
      references: refs || null,
      replyToMessageId: msg.id,
    };
  });

  // ---- domains / DKIM ----
  app.get('/api/domains', async () => {
    const rows = db
      .prepare('SELECT id, name, created_at, dkim_selector, dkim_public_pem FROM domains ORDER BY name')
      .all();
    return rows;
  });

  app.get('/api/domains/:id/dns', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const dom = ensureDkim(Number(id));
      return dnsRecord(dom);
    } catch {
      return reply.code(404).send({ error: 'no such domain' });
    }
  });

  // ---- send ----
  const sendSchema = z.object({
    mailboxId: z.coerce.number(),
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().default('(no subject)'),
    text: z.string().optional(),
    html: z.string().optional(),
    inReplyTo: z.string().nullable().optional(),
    references: z.string().nullable().optional(),
  });

  app.post('/api/send', async (req, reply) => {
    try {
      const body = sendSchema.parse(req.body);
      const accountId = (req as any).account?.id;
      if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
      if (!ownsMailbox(accountId, body.mailboxId)) {
        return reply.code(404).send({ error: 'mailbox not found' });
      }
      const result = await sendMessage(body);
      return result;
    } catch (e: any) {
      app.log.error({ err: e }, 'send failed');
      return reply.code(400).send({ error: e?.message ?? 'send failed' });
    }
  });

  // ---- aliases (disposable per-signup addresses) ----
  app.get('/api/aliases', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const mailboxId = Number((req.query as { mailboxId?: string }).mailboxId);
    if (!ownsMailbox(accountId, mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    return db
      .prepare(
        'SELECT * FROM aliases WHERE mailbox_id = ? ORDER BY created_at DESC',
      )
      .all(mailboxId);
  });

  const aliasIn = z.object({
    mailboxId: z.coerce.number(),
    label: z.string().optional(),
    localPart: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,40}$/i).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
  });

  function randomLocal(): string {
    const adj = ['quiet', 'fast', 'tiny', 'bold', 'calm', 'wise', 'dark', 'lush', 'pale', 'keen'];
    const noun = ['otter', 'lark', 'pine', 'bay', 'fern', 'oak', 'reed', 'finch', 'hare', 'kite'];
    const a = adj[Math.floor(Math.random() * adj.length)];
    const n = noun[Math.floor(Math.random() * noun.length)];
    const d = Math.random().toString(36).slice(2, 6);
    return `${a}-${n}-${d}`;
  }

  app.post('/api/aliases', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const b = aliasIn.parse(req.body);
    if (!ownsMailbox(accountId, b.mailboxId)) {
      return reply.code(404).send({ error: 'mailbox not found' });
    }
    const mb = db.prepare('SELECT * FROM mailboxes WHERE id = ?').get(b.mailboxId) as
      | { address: string; domain_id: number }
      | undefined;
    if (!mb) return reply.code(404).send({ error: 'mailbox not found' });
    const dom = db.prepare('SELECT name FROM domains WHERE id = ?').get(mb.domain_id) as
      | { name: string }
      | undefined;
    if (!dom) return reply.code(500).send({ error: 'domain missing' });

    let attempt = 0;
    let address = '';
    while (attempt < 6) {
      const local = b.localPart ?? randomLocal();
      address = `${local}@${dom.name}`.toLowerCase();
      const exists = db.prepare('SELECT id FROM aliases WHERE address = ?').get(address);
      const collidesWithMailbox = db
        .prepare('SELECT id FROM mailboxes WHERE address = ?')
        .get(address);
      if (!exists && !collidesWithMailbox) break;
      if (b.localPart) return reply.code(409).send({ error: 'address already in use' });
      attempt++;
    }
    const expires_at =
      b.expiresInDays == null ? null : Date.now() + b.expiresInDays * 86_400_000;
    const result = db
      .prepare(
        `INSERT INTO aliases (mailbox_id, address, label, expires_at, abused, received_count, last_seen, created_at)
         VALUES (?, ?, ?, ?, 0, 0, NULL, ?) RETURNING id`,
      )
      .get(b.mailboxId, address, b.label ?? null, expires_at, Date.now()) as { id: number };
    return { id: result.id, address, expires_at };
  });

  app.post('/api/aliases/:id/abuse', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const id = Number((req.params as { id: string }).id);
    if (!ownsAlias(accountId, id)) {
      return reply.code(404).send({ error: 'alias not found' });
    }
    db.prepare('UPDATE aliases SET abused = 1 WHERE id = ?').run(id);
    return { ok: true };
  });

  app.post('/api/aliases/:id/restore', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const id = Number((req.params as { id: string }).id);
    if (!ownsAlias(accountId, id)) {
      return reply.code(404).send({ error: 'alias not found' });
    }
    db.prepare('UPDATE aliases SET abused = 0 WHERE id = ?').run(id);
    return { ok: true };
  });

  app.delete('/api/aliases/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const id = Number((req.params as { id: string }).id);
    if (!ownsAlias(accountId, id)) {
      return reply.code(404).send({ error: 'alias not found' });
    }
    db.prepare('DELETE FROM aliases WHERE id = ?').run(id);
    return { ok: true };
  });

  // ---- public digest action routes ----
  // No auth, no CORS. Rate-limited (config.rateLimitAuthPerMin) and
  // single-use via the digest_tokens_used jti store: a token that already
  // ran the action returns the expired page so leaked links cannot be
  // replayed until exp.
  app.get('/public/digest/allow', {
    config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { renderConfirmPage, renderExpiredPage } = await import('./digest-pages.js');
    const { verify } = await import('./digest-token.js');
    const { loadDigestSigningSecret } = await import('./config.js');
    const t = (req.query as { t?: string }).t ?? '';
    const payload = verify(t, loadDigestSigningSecret(), Date.now());
    if (!payload) {
      reply.type('text/html');
      return renderExpiredPage();
    }
    const mb = db
      .prepare('SELECT id FROM mailboxes WHERE id = ?')
      .get(payload.mailboxId) as { id: number } | undefined;
    if (!mb) {
      reply.type('text/html');
      return renderExpiredPage();
    }
    const tokenHash = createHash('sha256').update(t).digest('hex');
    const alreadyUsed = db
      .prepare('SELECT 1 FROM digest_tokens_used WHERE token_hash = ?')
      .get(tokenHash);
    if (alreadyUsed) {
      reply.type('text/html');
      return renderExpiredPage();
    }
    const count = (db
      .prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE mailbox_id = ? AND folder = 'quarantine' AND from_address = ?",
      )
      .get(payload.mailboxId, payload.sender.toLowerCase()) as { c: number }).c;
    reply.type('text/html');
    return renderConfirmPage({ token: t, sender: payload.sender, quarantinedCount: count });
  });

  app.post('/public/digest/allow', {
    config: { rateLimit: { max: config.rateLimitAuthPerMin, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { renderSuccessPage, renderExpiredPage } = await import('./digest-pages.js');
    const { verify } = await import('./digest-token.js');
    const { loadDigestSigningSecret } = await import('./config.js');

    const body = (req.body ?? {}) as { t?: string };
    const t = body.t ?? '';
    if (!t) return reply.code(400).send({ error: 'missing token' });

    const payload = verify(t, loadDigestSigningSecret(), Date.now());
    if (!payload) {
      reply.type('text/html');
      return renderExpiredPage();
    }
    const mb = db
      .prepare('SELECT id FROM mailboxes WHERE id = ?')
      .get(payload.mailboxId) as { id: number } | undefined;
    if (!mb) {
      reply.type('text/html');
      return renderExpiredPage();
    }

    // Atomic single-use: INSERT OR IGNORE returns changes=0 if the hash
    // is already present, which races safely against concurrent POSTs.
    const tokenHash = createHash('sha256').update(t).digest('hex');
    const claim = db
      .prepare('INSERT OR IGNORE INTO digest_tokens_used (token_hash, used_at) VALUES (?, ?)')
      .run(tokenHash, Date.now());
    if (claim.changes === 0) {
      reply.type('text/html');
      return renderExpiredPage();
    }

    const sender = payload.sender.toLowerCase();
    const ruleExists = db
      .prepare(
        'SELECT id FROM whitelist_rules WHERE mailbox_id = ? AND kind = ? AND pattern = ?',
      )
      .get(payload.mailboxId, 'address', sender) as { id: number } | undefined;
    const alreadyTrusted = Boolean(ruleExists);

    let movedIds: string[] = [];
    runInTx(() => {
      if (!ruleExists) {
        db.prepare(
          'INSERT INTO whitelist_rules (mailbox_id, kind, pattern, note, created_at) VALUES (?, ?, ?, ?, ?)',
        ).run(payload.mailboxId, 'address', sender, 'digest:allow-forever', Date.now());
      }
      const toMove = db
        .prepare(
          "SELECT id FROM messages WHERE mailbox_id = ? AND folder = 'quarantine' AND from_address = ?",
        )
        .all(payload.mailboxId, sender) as { id: string }[];
      movedIds = toMove.map((x) => x.id);
      if (movedIds.length) {
        db.prepare(
          `UPDATE messages SET folder = 'inbox', expires_at = NULL
            WHERE mailbox_id = ? AND folder = 'quarantine' AND from_address = ?`,
        ).run(payload.mailboxId, sender);
      }
    });

    if (!alreadyTrusted) {
      bus.publish({ type: 'whitelist:changed', mailboxId: payload.mailboxId });
    }
    for (const mid of movedIds) {
      bus.publish({ type: 'message:updated', mailboxId: payload.mailboxId, messageId: mid });
    }

    reply.type('text/html');
    return renderSuccessPage({
      sender: payload.sender,
      movedCount: movedIds.length,
      alreadyTrusted,
      webmailUrl: config.publicBaseUrl,
    });
  });

  // ---- SSE ----
  app.get('/api/events', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`: hello\n\n`);
    const handler = (e: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
    };
    bus.on('event', handler);
    const ka = setInterval(() => reply.raw.write(`: ka\n\n`), 25_000);
    req.raw.on('close', () => {
      clearInterval(ka);
      bus.off('event', handler);
    });
  });

  // ---- test injection (bypasses SMTP) ----
  app.post('/api/inject', async (req) => {
    const body = z
      .object({
        to: z.string().email(),
        from: z.string().email(),
        fromName: z.string().optional(),
        subject: z.string().default('(no subject)'),
        text: z.string().default(''),
        html: z.string().optional(),
      })
      .parse(req.body);
    const fromHeader = body.fromName ? `"${body.fromName}" <${body.from}>` : body.from;
    const baseHeaders = [
      `From: ${fromHeader}`,
      `To: ${body.to}`,
      `Subject: ${body.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@inject.local>`,
      `MIME-Version: 1.0`,
    ];
    let raw: Buffer;
    if (body.html) {
      // multipart/alternative so both plain text and HTML are present.
      const boundary = `bndry-${Math.random().toString(36).slice(2)}`;
      const parts = [
        ...baseHeaders,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        body.text || '',
        `--${boundary}`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        body.html,
        `--${boundary}--`,
      ];
      raw = Buffer.from(parts.join('\r\n'));
    } else {
      raw = Buffer.from(
        [...baseHeaders, `Content-Type: text/plain; charset=utf-8`, ``, body.text].join('\r\n'),
      );
    }
    const r = await ingest(raw, body.to);
    return r ?? { error: 'no such mailbox' };
  });

  // Serve the built SPA in non-test runs. (Tests use opts.inject and exercise
  // registerWebSpa directly against a temp dir.)
  await registerWebSpa(app, config.webDistPath);

  if (opts.inject) {
    await app.ready();
    return app;
  }
  await app.listen({ port: config.apiPort, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${config.apiPort}`);
  return app;
}
