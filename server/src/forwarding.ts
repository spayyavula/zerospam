// Alias forwarding, reverse-alias replies and the abuse limits around them.
// Design: docs/superpowers/specs/2026-10-12-alias-forwarding-design.md
//
// Forwarded mail cannot keep the original From (SES only relays verified identities, and
// it would fail DMARC at the destination), so every forward is rewritten to come From a
// per-contact *reverse alias* on our own domain. That same address is the Reply-To, which
// is what lets the user reply from Gmail/Outlook without exposing their real address.

import { createHash, randomBytes } from 'node:crypto';
import { simpleParser } from 'mailparser';
import type { ParsedMail, AddressObject } from 'mailparser';
import { customAlphabet, nanoid } from 'nanoid';
import { db } from './db.js';
import type { Alias, ForwardTarget, ReverseAlias } from './db.js';
import { config } from './config.js';
import { buildTransport, sendMessage } from './sender.js';
import { ensureDkim } from './dkim.js';
import { checkAuth } from './mailauth.js';
import { recordAudit } from './audit.js';
import { getOrCreateSystemMailboxId } from './system-mailbox.js';
import {
  splitMessage,
  keepHeaders,
  hasHeader,
  buildMessage,
  formatAddress,
  formatAddressList,
  type HeaderField,
} from './mail-headers.js';

export const REVERSE_PREFIX = 'rv.';
export const LOOP_HEADER = 'X-ZeroSpam-Forwarded';

/** Headers carried over from the original message; everything else is dropped. */
const PASSTHROUGH_HEADERS = [
  'Subject',
  'Date',
  'Message-ID',
  'MIME-Version',
  'Content-Type',
  'Content-Transfer-Encoding',
  'Content-Language',
  'In-Reply-To',
  'References',
  'List-Id',
  'List-Unsubscribe',
  'List-Unsubscribe-Post',
  'Thread-Topic',
  'Thread-Index',
] as const;

const reverseLocal = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export type OutboundKind = 'forward' | 'reply';

const countEvents = db.prepare(
  'SELECT COUNT(*) AS c FROM outbound_events WHERE account_id = ? AND kind = ? AND at >= ?',
);
const insertEvent = db.prepare('INSERT INTO outbound_events (account_id, kind, at) VALUES (?, ?, ?)');
const pruneEvents = db.prepare('DELETE FROM outbound_events WHERE at < ?');

function limitFor(kind: OutboundKind): number {
  return kind === 'forward' ? config.aliases.forwardMaxPerHour : config.aliases.replyMaxPerHour;
}

export function isRateLimited(accountId: number, kind: OutboundKind, now = Date.now()): boolean {
  const { c } = countEvents.get(accountId, kind, now - 3_600_000) as { c: number };
  return c >= limitFor(kind);
}

export function recordOutbound(accountId: number, kind: OutboundKind, now = Date.now()): void {
  insertEvent.run(accountId, kind, now);
}

/** Called by the sweeper: drop counter rows older than 24 h. */
export function pruneOutboundEvents(now = Date.now()): void {
  pruneEvents.run(now - 24 * 3_600_000);
}

// ---------------------------------------------------------------------------
// Forward targets
// ---------------------------------------------------------------------------

export class ForwardTargetError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function listForwardTargets(accountId: number): Array<Omit<ForwardTarget, 'verify_token_hash'>> {
  return db
    .prepare(
      `SELECT id, account_id, email, verified_at, verify_expires_at, created_at
       FROM forward_targets WHERE account_id = ? ORDER BY created_at`,
    )
    .all(accountId) as Array<Omit<ForwardTarget, 'verify_token_hash'>>;
}

export function getForwardTarget(accountId: number, id: number): ForwardTarget | undefined {
  return db
    .prepare('SELECT * FROM forward_targets WHERE id = ? AND account_id = ?')
    .get(id, accountId) as ForwardTarget | undefined;
}

function isHostedDomain(domain: string): boolean {
  return !!db.prepare('SELECT 1 FROM domains WHERE name = ?').get(domain.toLowerCase());
}

/**
 * Create a forward target. Returns the raw verification token when the address still needs
 * verifying (the caller emails it), or null when it was verified on creation because it is
 * already a verified login email of a user in this account.
 */
export function createForwardTarget(
  accountId: number,
  rawEmail: string,
  now = Date.now(),
): { target: ForwardTarget; token: string | null } {
  const email = rawEmail.trim().toLowerCase();
  const domain = email.split('@')[1] ?? '';
  if (!domain || isHostedDomain(domain)) {
    // Forwarding into one of our own domains would loop back through ingest.
    throw new ForwardTargetError('forwarding address must be outside ZeroSpam', 400);
  }
  const existing = db
    .prepare('SELECT id FROM forward_targets WHERE account_id = ? AND email = ?')
    .get(accountId, email);
  if (existing) throw new ForwardTargetError('forwarding address already added', 409);
  const { c } = db
    .prepare('SELECT COUNT(*) AS c FROM forward_targets WHERE account_id = ?')
    .get(accountId) as { c: number };
  if (c >= config.aliases.forwardTargetsMaxPerAccount) {
    throw new ForwardTargetError(
      `forwarding address limit reached (${config.aliases.forwardTargetsMaxPerAccount})`,
      403,
    );
  }

  const ownsLogin = db
    .prepare('SELECT 1 FROM users WHERE account_id = ? AND email = ? AND email_verified_at IS NOT NULL')
    .get(accountId, email);

  let token: string | null = null;
  let tokenHash: string | null = null;
  let tokenExp: number | null = null;
  if (!ownsLogin) {
    token = randomBytes(32).toString('base64url');
    tokenHash = hashToken(token);
    tokenExp = now + config.aliases.verifyTokenExpiryHours * 3_600_000;
  }
  const target = db
    .prepare(
      `INSERT INTO forward_targets (account_id, email, verified_at, verify_token_hash, verify_expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(accountId, email, ownsLogin ? now : null, tokenHash, tokenExp, now) as ForwardTarget;
  return { target, token };
}

/** Issue a fresh verification token for an unverified target. */
export function reissueVerifyToken(accountId: number, id: number, now = Date.now()): { target: ForwardTarget; token: string } {
  const target = getForwardTarget(accountId, id);
  if (!target) throw new ForwardTargetError('forwarding address not found', 404);
  if (target.verified_at) throw new ForwardTargetError('forwarding address already verified', 409);
  const token = randomBytes(32).toString('base64url');
  db.prepare('UPDATE forward_targets SET verify_token_hash = ?, verify_expires_at = ? WHERE id = ?').run(
    hashToken(token),
    now + config.aliases.verifyTokenExpiryHours * 3_600_000,
    id,
  );
  return { target, token };
}

/** Look up a pending target by its raw token without consuming it (for the confirm page). */
export function peekVerifyToken(token: string, now = Date.now()): ForwardTarget | undefined {
  if (!token) return undefined;
  return db
    .prepare(
      `SELECT * FROM forward_targets
       WHERE verify_token_hash = ? AND verified_at IS NULL AND verify_expires_at >= ?`,
    )
    .get(hashToken(token), now) as ForwardTarget | undefined;
}

/** Consume a token: marks the target verified. Single-use. */
export function consumeVerifyToken(token: string, now = Date.now()): ForwardTarget | undefined {
  const target = peekVerifyToken(token, now);
  if (!target) return undefined;
  db.prepare(
    'UPDATE forward_targets SET verified_at = ?, verify_token_hash = NULL, verify_expires_at = NULL WHERE id = ?',
  ).run(now, target.id);
  return { ...target, verified_at: now, verify_token_hash: null, verify_expires_at: null };
}

export function deleteForwardTarget(accountId: number, id: number): boolean {
  const r = db.prepare('DELETE FROM forward_targets WHERE id = ? AND account_id = ?').run(id, accountId);
  return Number(r.changes) > 0;
}

export async function sendTargetVerificationEmail(email: string, token: string): Promise<void> {
  if (!config.publicBaseUrl) throw new Error('PUBLIC_BASE_URL is unset; cannot build verification link');
  const link = `${config.publicBaseUrl}/public/forward/verify?t=${encodeURIComponent(token)}`;
  await sendMessage({
    mailboxId: getOrCreateSystemMailboxId(),
    to: [email],
    subject: 'Confirm your ZeroSpam forwarding address',
    text: [
      'Someone asked ZeroSpam to forward alias mail to this address.',
      '',
      'If that was you, confirm here:',
      '',
      `   ${link}`,
      '',
      `The link expires in ${config.aliases.verifyTokenExpiryHours} hours.`,
      'If you did not request this, ignore this message — nothing will be forwarded.',
      '',
      '— Zero·Spam',
    ].join('\n'),
  });
}

// ---------------------------------------------------------------------------
// Reverse aliases
// ---------------------------------------------------------------------------

export type ReverseAliasContext = ReverseAlias & {
  alias_address: string;
  alias_abused: number;
  alias_expires_at: number | null;
  forward_target_id: number | null;
  account_id: number;
  domain_id: number;
};

const findReverseByAddress = db.prepare(`
  SELECT r.*, a.address AS alias_address, a.abused AS alias_abused, a.expires_at AS alias_expires_at,
         a.forward_target_id, m.account_id, m.domain_id
  FROM reverse_aliases r
  JOIN aliases a ON a.id = r.alias_id
  JOIN mailboxes m ON m.id = a.mailbox_id
  WHERE r.address = ?
`);

export function isReverseAddress(address: string): boolean {
  return address.toLowerCase().startsWith(REVERSE_PREFIX);
}

/** Returns the reverse alias only if its parent alias is still active. */
export function findActiveReverseAlias(address: string, now = Date.now()): ReverseAliasContext | undefined {
  const r = findReverseByAddress.get(address.toLowerCase()) as ReverseAliasContext | undefined;
  if (!r) return undefined;
  if (r.alias_abused) return undefined;
  if (r.alias_expires_at && r.alias_expires_at < now) return undefined;
  return r;
}

function addressTaken(address: string): boolean {
  return !!(
    db.prepare('SELECT 1 FROM reverse_aliases WHERE address = ?').get(address) ||
    db.prepare('SELECT 1 FROM aliases WHERE address = ?').get(address) ||
    db.prepare('SELECT 1 FROM mailboxes WHERE address = ?').get(address)
  );
}

export function getOrCreateReverseAlias(
  aliasId: number,
  domain: string,
  contactAddress: string,
  contactName: string | null,
): ReverseAlias {
  const contact = contactAddress.toLowerCase();
  const existing = db
    .prepare('SELECT * FROM reverse_aliases WHERE alias_id = ? AND contact_address = ?')
    .get(aliasId, contact) as ReverseAlias | undefined;
  if (existing) {
    if (contactName && contactName !== existing.contact_name) {
      db.prepare('UPDATE reverse_aliases SET contact_name = ? WHERE id = ?').run(contactName, existing.id);
      return { ...existing, contact_name: contactName };
    }
    return existing;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const address = `${REVERSE_PREFIX}${reverseLocal()}@${domain}`.toLowerCase();
    if (addressTaken(address)) continue;
    return db
      .prepare(
        `INSERT INTO reverse_aliases (alias_id, contact_address, contact_name, address, created_at)
         VALUES (?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(aliasId, contact, contactName, address, Date.now()) as ReverseAlias;
  }
  throw new Error('could not allocate a reverse alias address');
}

// ---------------------------------------------------------------------------
// Forwarding (alias → user's real inbox)
// ---------------------------------------------------------------------------

export type ForwardableAlias = Pick<Alias, 'id' | 'address' | 'mode' | 'forward_target_id'> & {
  account_id: number;
  domain_id: number;
};

export type ForwardOutcome = { ok: true } | { ok: false; reason: string };

function addressesOf(obj: AddressObject | AddressObject[] | undefined): Array<{ address: string; name: string }> {
  if (!obj) return [];
  const list = Array.isArray(obj) ? obj : [obj];
  const out: Array<{ address: string; name: string }> = [];
  for (const group of list) {
    for (const v of group.value ?? []) {
      // Flatten RFC 5322 groups ("team: a@x, b@y;")
      const members = v.group?.length ? v.group : [v];
      for (const m of members) {
        if (m.address) out.push({ address: m.address.toLowerCase(), name: m.name ?? '' });
      }
    }
  }
  return out;
}

function dedupe<T extends { address: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((e) => (seen.has(e.address) ? false : (seen.add(e.address), true)));
}

/** "Jane Doe (jane at x.com)" — the readable sender shown in the user's real inbox. */
function forwardedDisplayName(name: string, address: string): string {
  const pretty = address.replace('@', ' at ');
  return name ? `${name} (${pretty})` : pretty;
}

function verifiedTargetFor(accountId: number, targetId: number | null): ForwardTarget | undefined {
  if (!targetId) return undefined;
  const t = getForwardTarget(accountId, targetId);
  return t?.verified_at ? t : undefined;
}

async function relay(raw: Buffer, domainId: number, envelopeTo: string): Promise<void> {
  const domain = ensureDkim(domainId);
  if (!domain.dkim_selector || !domain.dkim_private_pem) {
    throw new Error(`DKIM not initialized for ${domain.name}`);
  }
  await buildTransport().sendMail({
    raw,
    envelope: { from: `bounces@${domain.name}`, to: [envelopeTo] },
    dkim: {
      domainName: domain.name,
      keySelector: domain.dkim_selector,
      privateKey: domain.dkim_private_pem,
    },
  });
}

/**
 * Forward one alias message to the alias's verified target. Never throws: a failed
 * forward returns `{ ok:false }` so ingest can fall back to storing the message.
 */
export async function forwardAliasMessage(
  raw: Buffer,
  parsed: ParsedMail,
  alias: ForwardableAlias,
): Promise<ForwardOutcome> {
  try {
    const { fields, body } = splitMessage(raw);
    if (hasHeader(fields, LOOP_HEADER)) return { ok: false, reason: 'loop' };

    const target = verifiedTargetFor(alias.account_id, alias.forward_target_id);
    if (!target) return { ok: false, reason: 'no-verified-target' };
    if (isRateLimited(alias.account_id, 'forward')) return { ok: false, reason: 'rate-limited' };

    const domain = alias.address.split('@')[1];
    const aliasAddr = alias.address.toLowerCase();
    const sender = addressesOf(parsed.from)[0];
    if (!sender) return { ok: false, reason: 'no-sender' };

    const fromRev = getOrCreateReverseAlias(alias.id, domain, sender.address, sender.name || null);

    // Every other participant also gets a reverse alias so reply-all stays private.
    const mapParticipant = (p: { address: string; name: string }) => {
      if (p.address === aliasAddr) return { address: aliasAddr, name: null };
      if (p.address === target.email) return null; // never echo the user's real address
      const rev = getOrCreateReverseAlias(alias.id, domain, p.address, p.name || null);
      return { address: rev.address, name: forwardedDisplayName(p.name, p.address) };
    };
    const to = dedupe(addressesOf(parsed.to))
      .map(mapParticipant)
      .filter((x): x is { address: string; name: string | null } => !!x);
    const cc = dedupe(addressesOf(parsed.cc))
      .map(mapParticipant)
      .filter((x): x is { address: string; name: string | null } => !!x);

    const out: HeaderField[] = [
      { name: 'From', value: formatAddress(forwardedDisplayName(sender.name, sender.address), fromRev.address) },
      { name: 'Reply-To', value: fromRev.address },
      { name: 'To', value: to.length ? formatAddressList(to) : aliasAddr },
      ...(cc.length ? [{ name: 'Cc', value: formatAddressList(cc) }] : []),
      ...keepHeaders(fields, PASSTHROUGH_HEADERS),
      { name: LOOP_HEADER, value: aliasAddr },
    ];

    await relay(buildMessage(out, body), alias.domain_id, target.email);
    recordOutbound(alias.account_id, 'forward');
    db.prepare('UPDATE aliases SET forwarded_count = forwarded_count + 1 WHERE id = ?').run(alias.id);
    db.prepare('UPDATE reverse_aliases SET last_used_at = ? WHERE id = ?').run(Date.now(), fromRev.id);
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[forward] failed', alias.address, err);
    return { ok: false, reason: 'relay-error' };
  }
}

// ---------------------------------------------------------------------------
// Reverse-alias replies (user's real inbox → contact, as the alias)
// ---------------------------------------------------------------------------

export type ReplyOutcome =
  | { status: 'sent'; contact: string }
  | { status: 'rejected'; reason: string };

/** SMTP should answer 451 so the user's provider retries the reply later. */
export function replyRateLimited(reverseAddress: string): boolean {
  const rev = findActiveReverseAlias(reverseAddress);
  return !!rev && isRateLimited(rev.account_id, 'reply');
}

export async function handleReverseReply(
  raw: Buffer,
  reverseAddress: string,
  clientIp?: string,
  envelopeFrom?: string,
): Promise<ReplyOutcome> {
  const rev = findActiveReverseAlias(reverseAddress);
  if (!rev) return { status: 'rejected', reason: 'unknown-reverse-alias' };

  const reject = (reason: string, detail: Record<string, unknown> = {}): ReplyOutcome => {
    recordAudit({
      event: 'alias.reply.rejected',
      detail: { reason, reverse: rev.address, alias: rev.alias_address, ...detail },
      ip: clientIp ?? null,
    });
    return { status: 'rejected', reason };
  };

  const target = verifiedTargetFor(rev.account_id, rev.forward_target_id);
  if (!target) return reject('no-verified-target');

  const [parsed, auth] = await Promise.all([simpleParser(raw), checkAuth(raw, clientIp, envelopeFrom)]);
  const from = addressesOf(parsed.from)[0]?.address;
  if (from !== target.email) return reject('sender-not-owner', { from });
  // Same bar as DMARC: the From domain must be authenticated by an aligned DKIM or SPF
  // pass. Requiring a literal DMARC *pass* would reject every domain that simply never
  // published a DMARC record, even when its mail is properly signed.
  if (config.aliases.replyRequireDmarc && !auth.fromAuthenticated) {
    return reject('sender-not-authenticated', {
      from,
      dmarc: auth.dmarcPass,
      dkim: auth.dkimPass,
      spf: auth.spfPass,
    });
  }

  const domain = rev.alias_address.split('@')[1];
  // Map reverse aliases that belong to THIS alias back to their real contacts. Anything
  // else (the user's own address, other aliases' reverse addresses, addresses the user
  // typed directly) is left out of the rewritten headers.
  const known = db
    .prepare('SELECT address, contact_address, contact_name FROM reverse_aliases WHERE alias_id = ?')
    .all(rev.alias_id) as Array<{ address: string; contact_address: string; contact_name: string | null }>;
  const byReverse = new Map(known.map((k) => [k.address, k]));
  const mapBack = (list: Array<{ address: string }>) =>
    dedupe(
      list
        .map((p) => byReverse.get(p.address))
        .filter((k): k is NonNullable<typeof k> => !!k)
        .map((k) => ({ address: k.contact_address, name: k.contact_name })),
    );
  let to = mapBack(addressesOf(parsed.to));
  const cc = mapBack(addressesOf(parsed.cc)).filter((c) => !to.some((t) => t.address === c.address));
  if (!to.length) to = [{ address: rev.contact_address, name: rev.contact_name }];

  const { fields, body } = splitMessage(raw);
  const out: HeaderField[] = [
    { name: 'From', value: rev.alias_address },
    { name: 'To', value: formatAddressList(to) },
    ...(cc.length ? [{ name: 'Cc', value: formatAddressList(cc) }] : []),
    // The user's own Message-ID reveals their mail provider; mint one on our domain.
    { name: 'Message-ID', value: `<${nanoid()}@${domain}>` },
    ...keepHeaders(
      fields,
      PASSTHROUGH_HEADERS.filter((h) => h !== 'Message-ID'),
    ),
  ];
  if (!hasHeader(out, 'Date')) out.push({ name: 'Date', value: new Date().toUTCString() });

  await relay(buildMessage(out, body), rev.domain_id, rev.contact_address);
  recordOutbound(rev.account_id, 'reply');
  db.prepare('UPDATE aliases SET replied_count = replied_count + 1 WHERE id = ?').run(rev.alias_id);
  db.prepare('UPDATE reverse_aliases SET last_used_at = ? WHERE id = ?').run(Date.now(), rev.id);
  return { status: 'sent', contact: rev.contact_address };
}
