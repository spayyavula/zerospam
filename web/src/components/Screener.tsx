import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../api';
import type { ScreenerSender } from '../types';

type Props = {
  mailboxId: number;
  onDoneForNow: () => void;
  onChanged: () => void;
  onSuggestDomainExpand: (payload: { mailboxId: number; domain: string }) => void;
};

export default function Screener({ mailboxId, onDoneForNow, onChanged, onSuggestDomainExpand }: Props) {
  const [queue, setQueue] = useState<ScreenerSender[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    api.screenerList(mailboxId).then((rows) => {
      if (!alive) return;
      setQueue(rows);
      setIdx(0);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [mailboxId]);

  const current = queue[idx];

  const decide = async (kind: 'allow' | 'reject') => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (kind === 'allow') {
        const r = await api.screenerAllow(mailboxId, current.address);
        if (r?.suggest_domain_expand && r.domain) onSuggestDomainExpand({ mailboxId, domain: r.domain });
      } else {
        await api.screenerReject(mailboxId, current.address);
      }
      onChanged();
      setIdx((i) => i + 1);
    } catch {
      // leave the card in place on error
    } finally {
      setBusy(false);
    }
  };

  const total = queue.length;
  const done = loaded && (total === 0 || idx >= total);

  return (
    <section className="flex-1 min-w-0 bg-paper text-ink flex flex-col">
      <div className="h-14 px-6 border-b-2 border-rule-strong flex items-center">
        <span className="font-display text-xl font-semibold">The Screener</span>
        {total > 0 && !done && (
          <span className="ml-3 font-mono text-[11px] tracking-[0.1em] text-quiet">
            {idx + 1} / {total}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={onDoneForNow}
          className="font-mono text-[11px] tracking-[0.1em] uppercase text-quiet hover:text-ink"
        >
          Done for now
        </button>
      </div>

      <div className="flex-1 grid place-items-center p-8">
        {!loaded ? null : done ? (
          <div className="text-center">
            <div className="font-display text-2xl mb-1">All clear.</div>
            <div className="font-mono text-[11px] tracking-[0.1em] text-quiet uppercase">Nothing to screen</div>
          </div>
        ) : (
          <div className="w-full max-w-[560px]">
            <div className="font-mono text-[11px] tracking-[0.1em] text-quiet uppercase mb-2">Wants into your Inbox</div>
            <div className="font-display text-3xl leading-tight">{current.name || current.address}</div>
            <div className="font-mono text-[11px] text-quiet mt-1">
              {current.address} · {current.message_count} message{current.message_count === 1 ? '' : 's'} waiting
            </div>
            <div className="border-t-2 border-rule-strong mt-5 pt-5">
              <div className="font-display text-lg">{current.latest_subject || '(no subject)'}</div>
              <div className="font-body text-[14px] leading-7 text-ink-soft mt-2">
                {current.latest_preview || '(no preview)'}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button
                disabled={busy}
                onClick={() => decide('allow')}
                className="font-mono text-[11px] tracking-[0.12em] uppercase bg-signal text-signal-ink border-2 border-rule-strong px-5 py-2.5 inline-flex items-center gap-2 disabled:opacity-60"
              >
                <Check className="w-4 h-4" /> Yes → Inbox
              </button>
              <button
                disabled={busy}
                onClick={() => decide('reject')}
                className="font-mono text-[11px] tracking-[0.12em] uppercase border-2 border-rule-strong px-5 py-2.5 inline-flex items-center gap-2 hover:bg-paper-deep disabled:opacity-60"
              >
                <X className="w-4 h-4" /> No
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
