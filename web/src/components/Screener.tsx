import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, X } from 'lucide-react';
import { api } from '../api';
import type { ScreenerSender } from '../types';

type Props = {
  mailboxId: number;
  onDoneForNow: () => void;
  onChanged: () => void;
  onSuggestDomainExpand: (payload: { mailboxId: number; domain: string }) => void;
};

function initials(name: string | null, address: string): string {
  const source = (name?.trim() || address.split('@')[0] || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

function hueFromAddress(address: string): number {
  let h = 0;
  for (let i = 0; i < address.length; i += 1) {
    h = (h * 31 + address.charCodeAt(i)) % 360;
  }
  return h;
}

const AVATAR_BG_CLASSES = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
];

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Screener({ mailboxId, onDoneForNow, onChanged, onSuggestDomainExpand }: Props) {
  const [rows, setRows] = useState<ScreenerSender[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = async () => {
    setRows(await api.screenerList(mailboxId));
  };

  useEffect(() => {
    load();
  }, [mailboxId]);

  const totalMessages = useMemo(
    () => rows.reduce((sum, r) => sum + r.message_count, 0),
    [rows],
  );

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(key));
    try {
      await fn();
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(key);
        return next;
      });
    }
  };

  const allowSender = async (row: ScreenerSender) => {
    setRows((prev) => prev.filter((x) => x.address !== row.address));
    await withBusy(`allow:${row.address}`, async () => {
      try {
        const r = await api.screenerAllow(mailboxId, row.address);
        onChanged();
        if (r.suggest_domain_expand && r.domain) {
          onSuggestDomainExpand({ mailboxId, domain: r.domain });
        }
      } catch {
        await load();
      }
    });
  };

  const rejectSender = async (row: ScreenerSender) => {
    setRows((prev) => prev.filter((x) => x.address !== row.address));
    await withBusy(`reject:${row.address}`, async () => {
      try {
        await api.screenerReject(mailboxId, row.address);
        onChanged();
      } catch {
        await load();
      }
    });
  };

  return (
    <section className="flex-1 min-w-0 bg-zsbg">
      <div className="h-12 px-4 border-b border-zsborder flex items-center gap-3 bg-zspanel">
        <div className="text-sm font-medium">
          Screener
          <span className="ml-2 text-zsmuted font-normal">{rows.length} senders, {totalMessages} messages</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={onDoneForNow}
          className="text-xs px-2.5 py-1.5 rounded border border-zsborder hover:bg-zsborder/30"
        >
          Done for now
        </button>
      </div>

      <div className="p-3 space-y-2 overflow-y-auto h-[calc(100%-3rem)]">
        {rows.length === 0 && (
          <div className="border border-zsborder rounded-lg p-6 text-center text-zsmuted text-sm">
            No new senders in your Screener queue.
          </div>
        )}

        {rows.map((row) => {
          const avatarClass = AVATAR_BG_CLASSES[hueFromAddress(row.address) % AVATAR_BG_CLASSES.length];
          const isExpanded = expanded.has(row.address);
          const isBusy = busy.has(`allow:${row.address}`) || busy.has(`reject:${row.address}`);
          return (
            <article
              key={row.address}
              className="screener-row border border-zsborder rounded-lg bg-zspanel/40 hover:bg-zspanel/60 transition-colors"
            >
              <div className="px-3 py-2 flex items-start gap-3">
                <div
                  className={`mt-0.5 w-8 h-8 rounded-full grid place-items-center text-xs font-semibold text-white ${avatarClass}`}
                >
                  {initials(row.name, row.address)}
                </div>

                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.address)) next.delete(row.address);
                      else next.add(row.address);
                      return next;
                    })
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{row.name || row.address}</span>
                    {row.name && <span className="text-xs text-zsmuted truncate">&lt;{row.address}&gt;</span>}
                    <span className="text-xs text-zsmuted ml-auto inline-flex items-center gap-1 shrink-0">
                      <Clock3 className="w-3 h-3" /> {timeAgo(row.latest_received_at)}
                    </span>
                  </div>
                  <div className="text-sm text-zstext truncate mt-0.5">{row.latest_subject}</div>
                  <div className="text-xs text-zsmuted truncate mt-0.5">
                    {row.latest_preview || '(no preview)'}
                    <span className="ml-2">{row.message_count} message{row.message_count === 1 ? '' : 's'}</span>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={isBusy}
                    onClick={() => allowSender(row)}
                    className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium bg-zsok/20 text-zsok hover:bg-zsok/30 disabled:opacity-60"
                  >
                    <Check className="w-3.5 h-3.5" /> Yes
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => rejectSender(row)}
                    className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium bg-zsdanger/20 text-zsdanger hover:bg-zsdanger/30 disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" /> No
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="screener-expand border-t border-zsborder/70 px-3 py-2 space-y-1.5">
                  {row.messages.map((m) => (
                    <div key={m.id} className="rounded border border-zsborder/70 bg-zsbg/40 p-2">
                      <div className="flex items-center gap-2 text-xs text-zsmuted">
                        <span>{new Date(m.received_at).toLocaleString()}</span>
                        {m.read === 0 && <span className="text-zsaccent">unread</span>}
                      </div>
                      <div className="text-sm mt-0.5">{m.subject || '(no subject)'}</div>
                      <div className="text-xs text-zsmuted mt-0.5">{m.preview || '(no preview)'}</div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
