import { useEffect, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { api } from '../api';
import type { Alias, Mailbox } from '../types';
import {
  X,
  Plus,
  Copy,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Tag,
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

export default function AliasManager({ mailboxes, defaultMailboxId, onClose }: Props) {
  const [mailboxId, setMailboxId] = useState(defaultMailboxId);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number | null>(30);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listAliases(mailboxId).then(setAliases).catch(() => setAliases([]));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxId]);

  const create = async () => {
    setError(null);
    try {
      await api.createAlias({
        mailboxId,
        label: label.trim() || undefined,
        expiresInDays: days,
      });
      setLabel('');
      load();
    } catch (e: any) {
      setError(e?.message ?? 'failed');
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center gap-2">
          <Tag className="w-4 h-4 text-zsaccent" />
          <div className="font-medium">Disposable Aliases</div>
          <span className="text-xs text-zsmuted">
            One-shot addresses for signups. Auto-expire or one-click abuse to nuke.
          </span>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-zsborder space-y-2">
          <div className="grid grid-cols-12 gap-2 items-center">
            <span className="col-span-2 text-xs text-zsmuted">For mailbox:</span>
            <select
              className="col-span-10 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
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
              className="col-span-3 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              value={days ?? 'never'}
              onChange={(e) =>
                setDays(e.target.value === 'never' ? null : Number(e.target.value))
              }
            >
              {TTL_OPTIONS.map((o) => (
                <option key={o.label} value={o.days ?? 'never'}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={create}
              className="col-span-3 bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 inline-flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Generate alias
            </button>
          </div>
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
            return (
              <li
                key={a.id}
                className="px-4 py-3 border-b border-zsborder/60 flex items-center gap-3"
              >
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
                    {copied === a.address && (
                      <span className="text-xs text-zsok">Copied!</span>
                    )}
                    {a.abused && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zsdanger/20 text-zsdanger">
                        ABUSED
                      </span>
                    )}
                    {expired && !a.abused && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zsmuted/20 text-zsmuted">
                        EXPIRED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zsmuted mt-0.5">
                    {a.label || 'no label'} · {a.received_count} received
                    {a.last_seen
                      ? ` · last ${formatDistanceToNowStrict(new Date(a.last_seen))} ago`
                      : ''}
                    {a.expires_at != null && (
                      <>
                        {' '}· expires {format(new Date(a.expires_at), 'PP')}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleAbuse(a)}
                  className={`p-1.5 rounded ${
                    a.abused
                      ? 'hover:bg-zsok/20 text-zsok'
                      : 'hover:bg-zsdanger/20 text-zsdanger'
                  }`}
                  title={a.abused ? 'Restore' : 'Mark abused (block all future mail)'}
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
