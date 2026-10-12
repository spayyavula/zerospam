import { useEffect, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { api } from '../api';
import type { Alias, AliasMode, AliasUsage, ForwardTarget, Mailbox } from '../types';
import {
  X,
  Plus,
  Copy,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Tag,
  Forward,
  MailCheck,
  RefreshCw,
} from 'lucide-react';

type Props = {
  mailboxes: Mailbox[];
  defaultMailboxId: number;
  onClose: () => void;
};

const TTL_OPTIONS: Array<{ label: string; days: number | null }> = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Never', days: null },
];

export const MODE_OPTIONS: Array<{ value: AliasMode; label: string; hint: string }> = [
  { value: 'store', label: 'Keep in ZeroSpam', hint: 'Deliver to this mailbox only' },
  { value: 'forward', label: 'Forward only', hint: 'Relay trusted mail to your real inbox; keep nothing here' },
  { value: 'both', label: 'Keep + forward', hint: 'Deliver here and relay trusted mail to your real inbox' },
];

const selectCls = 'bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm';

export default function AliasManager({ mailboxes, defaultMailboxId, onClose }: Props) {
  const [mailboxId, setMailboxId] = useState(defaultMailboxId);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [targets, setTargets] = useState<ForwardTarget[]>([]);
  const [usage, setUsage] = useState<AliasUsage | null>(null);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number | null>(30);
  const [mode, setMode] = useState<AliasMode>('store');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [newTarget, setNewTarget] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verified = targets.filter((t) => t.verified_at != null);

  const load = () => {
    api.listAliases(mailboxId).then(setAliases).catch(() => setAliases([]));
    api.aliasUsage().then(setUsage).catch(() => setUsage(null));
  };
  const loadTargets = () => api.forwardTargets().then(setTargets).catch(() => setTargets([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxId]);
  useEffect(() => {
    loadTargets();
  }, []);
  // Default the create form to the first verified forwarding address.
  useEffect(() => {
    if (targetId == null && verified.length) setTargetId(verified[0].id);
  }, [verified, targetId]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'failed');
    }
  };

  const create = () =>
    run(async () => {
      await api.createAlias({
        mailboxId,
        label: label.trim() || undefined,
        expiresInDays: days,
        mode,
        forwardTargetId: mode === 'store' ? null : targetId,
      });
      setLabel('');
      load();
    });

  const changeMode = (a: Alias, next: AliasMode) =>
    run(async () => {
      const tid = a.forward_target_id ?? verified[0]?.id ?? null;
      await api.patchAlias(a.id, { mode: next, forwardTargetId: next === 'store' ? a.forward_target_id : tid });
      load();
    });

  const changeTarget = (a: Alias, tid: number) =>
    run(async () => {
      await api.patchAlias(a.id, { forwardTargetId: tid });
      load();
    });

  const addTarget = () =>
    run(async () => {
      const email = newTarget.trim();
      if (!email) return;
      const r = await api.addForwardTarget(email);
      setNewTarget('');
      setNotice(r.verified ? `${r.email} is ready to use.` : `Check ${r.email} for a confirmation link.`);
      loadTargets();
    });

  const resendTarget = (t: ForwardTarget) =>
    run(async () => {
      await api.resendForwardTarget(t.id);
      setNotice(`Sent a new confirmation link to ${t.email}.`);
    });

  const removeTarget = (t: ForwardTarget) =>
    run(async () => {
      if (!confirm(`Remove ${t.email}? Aliases forwarding there will keep mail in ZeroSpam instead.`)) return;
      await api.deleteForwardTarget(t.id);
      if (targetId === t.id) setTargetId(null);
      loadTargets();
      load();
    });

  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      setCopied(s);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  const toggleAbuse = async (a: Alias) => {
    if (a.abused) await api.restoreAlias(a.id);
    else await api.abuseAlias(a.id);
    load();
  };

  const remove = async (a: Alias) => {
    if (!confirm(`Delete alias ${a.address}? Mail already received stays in your mailbox.`)) return;
    await api.deleteAlias(a.id);
    load();
  };

  const atCap = usage != null && usage.count >= usage.max;
  const needsTarget = mode !== 'store' && verified.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center gap-2">
          <Tag className="w-4 h-4 text-zsaccent" />
          <div className="font-medium">Disposable Aliases</div>
          <span className="text-xs text-zsmuted hidden sm:inline">
            One address per signup. Keep mail here, forward it to your real inbox, or both.
          </span>
          <div className="flex-1" />
          {usage && (
            <span
              className={`text-xs tabular-nums ${atCap ? 'text-zsdanger' : 'text-zsmuted'}`}
              data-testid="alias-usage"
            >
              {usage.count} / {usage.max}
            </span>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <section className="px-4 py-3 border-b border-zsborder space-y-2" aria-label="Forwarding addresses">
          <div className="flex items-center gap-2 text-xs text-zsmuted">
            <Forward className="w-3.5 h-3.5" />
            Forwarding addresses
            <span className="hidden sm:inline">· only mail from trusted senders is forwarded; replies go out as the alias</span>
          </div>
          {targets.length > 0 && (
            <ul className="space-y-1">
              {targets.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="font-mono truncate">{t.email}</span>
                  {t.verified_at != null ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zsok/20 text-zsok inline-flex items-center gap-1">
                      <MailCheck className="w-3 h-3" /> VERIFIED
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zsmuted/20 text-zsmuted">PENDING</span>
                      <button
                        onClick={() => resendTarget(t)}
                        className="text-xs text-zsaccent hover:underline inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Resend link
                      </button>
                    </>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => removeTarget(t)}
                    className="p-1 rounded hover:bg-zsdanger/20 text-zsdanger"
                    title="Remove forwarding address"
                    aria-label={`Remove ${t.email}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-12 gap-2">
            <input
              className="col-span-9 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              placeholder="you@gmail.com"
              type="email"
              aria-label="New forwarding address"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTarget()}
            />
            <button
              onClick={addTarget}
              className="col-span-3 border border-zsborder rounded px-2 py-1.5 text-sm hover:bg-zsborder/40 inline-flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add address
            </button>
          </div>
        </section>

        <div className="px-4 py-3 border-b border-zsborder space-y-2">
          <div className="grid grid-cols-12 gap-2 items-center">
            <span className="col-span-2 text-xs text-zsmuted">For mailbox:</span>
            <select
              className={`col-span-10 ${selectCls}`}
              value={mailboxId}
              onChange={(e) => setMailboxId(Number(e.target.value))}
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <input
              className="col-span-6 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              placeholder="label (e.g. 'newsletter:hackernews')"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <select
              className={`col-span-3 ${selectCls}`}
              value={days ?? 'never'}
              aria-label="Expires after"
              onChange={(e) => setDays(e.target.value === 'never' ? null : Number(e.target.value))}
            >
              {TTL_OPTIONS.map((o) => (
                <option key={o.label} value={o.days ?? 'never'}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={create}
              disabled={atCap || needsTarget}
              className="col-span-3 bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Generate alias
            </button>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <select
              className={`col-span-6 ${selectCls}`}
              value={mode}
              aria-label="Delivery"
              onChange={(e) => setMode(e.target.value as AliasMode)}
            >
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} title={o.hint}>
                  {o.label}
                </option>
              ))}
            </select>
            {mode !== 'store' && verified.length > 0 && (
              <select
                className={`col-span-6 ${selectCls}`}
                value={targetId ?? ''}
                aria-label="Forward to"
                onChange={(e) => setTargetId(Number(e.target.value))}
              >
                {verified.map((t) => (
                  <option key={t.id} value={t.id}>
                    → {t.email}
                  </option>
                ))}
              </select>
            )}
            {needsTarget && (
              <span className="col-span-6 text-xs text-zsmuted self-center">
                Add and confirm a forwarding address above first.
              </span>
            )}
          </div>
          {atCap && (
            <div className="text-xs text-zsdanger">
              You've reached the alias limit. Delete an old alias to make room.
            </div>
          )}
          {notice && <div className="text-xs text-zsok">{notice}</div>}
          {error && <div className="text-xs text-zsdanger">{error}</div>}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {aliases.length === 0 && (
            <li className="p-6 text-sm text-zsmuted">
              No aliases yet. Generate one for the next signup form.
            </li>
          )}
          {aliases.map((a) => {
            const expired = a.expires_at != null && a.expires_at < Date.now();
            const forwarding = a.mode !== 'store';
            return (
              <li key={a.id} className="px-4 py-3 border-b border-zsborder/60 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code
                      className={`font-mono text-sm truncate ${
                        a.abused ? 'line-through text-zsmuted' : 'text-zstext'
                      }`}
                    >
                      {a.address}
                    </code>
                    <button
                      onClick={() => copy(a.address)}
                      className="p-1 rounded hover:bg-zsborder/40 text-zsmuted"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {copied === a.address && <span className="text-xs text-zsok">Copied!</span>}
                    {a.abused ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zsdanger/20 text-zsdanger">
                        ABUSED
                      </span>
                    ) : null}
                    {expired && !a.abused && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zsmuted/20 text-zsmuted">
                        EXPIRED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zsmuted mt-0.5">
                    {a.label || 'no label'} · {a.received_count} received
                    {forwarding && ` · ${a.forwarded_count} forwarded · ${a.replied_count} replied`}
                    {a.last_seen ? ` · last ${formatDistanceToNowStrict(new Date(a.last_seen))} ago` : ''}
                    {a.expires_at != null && <> · expires {format(new Date(a.expires_at), 'PP')}</>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <select
                      className="bg-zsbg border border-zsborder rounded px-1.5 py-1 text-xs"
                      value={a.mode}
                      aria-label={`Delivery for ${a.address}`}
                      onChange={(e) => changeMode(a, e.target.value as AliasMode)}
                    >
                      {MODE_OPTIONS.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                          disabled={o.value !== 'store' && verified.length === 0}
                          title={o.hint}
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {forwarding && (
                      <select
                        className="bg-zsbg border border-zsborder rounded px-1.5 py-1 text-xs"
                        value={a.forward_target_id ?? ''}
                        aria-label={`Forward ${a.address} to`}
                        onChange={(e) => changeTarget(a, Number(e.target.value))}
                      >
                        {a.forward_target_id == null && <option value="">choose an address…</option>}
                        {verified.map((t) => (
                          <option key={t.id} value={t.id}>
                            → {t.email}
                          </option>
                        ))}
                      </select>
                    )}
                    {forwarding && a.forward_target_id == null && (
                      <span className="text-[11px] text-zsdanger">Not forwarding, so mail stays here.</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleAbuse(a)}
                  className={`p-1.5 rounded ${
                    a.abused ? 'hover:bg-zsok/20 text-zsok' : 'hover:bg-zsdanger/20 text-zsdanger'
                  }`}
                  title={a.abused ? 'Restore' : 'Mark abused (block all future mail and replies)'}
                >
                  {a.abused ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => remove(a)}
                  className="p-1.5 rounded hover:bg-zsdanger/20 text-zsdanger"
                  title="Delete alias"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
