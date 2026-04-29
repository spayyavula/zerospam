import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import type { MessageSummary } from '../types';
import { api } from '../api';
import { senderRisk } from '../utils/sender';
import {
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  Paperclip,
  EyeOff,
  Clock,
} from 'lucide-react';

type Props = {
  messages: MessageSummary[];
  mailboxId: number;
  onChanged: () => void;
  onExit: () => void;
};

function ttlBadge(expiresAt: number | null): string | null {
  if (!expiresAt) return null;
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const hours = ms / 3_600_000;
  if (hours < 48) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export default function ProbationaryWall({ messages, onChanged, onExit }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const trust = async (id: string) => {
    setBusyId(id);
    try {
      await api.trustSender(id);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await api.remove(id);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex-1 min-w-0 bg-zsbg border-l border-zsborder flex flex-col">
      <div className="h-12 px-4 border-b border-zsborder flex items-center gap-3">
        <div className="font-medium">Probationary Inbox</div>
        <div className="text-xs text-zsmuted">
          {messages.length} held back. ✓ trust + move to inbox · × delete forever.
        </div>
        <div className="flex-1" />
        <button
          onClick={onExit}
          className="text-xs px-2 py-1 rounded bg-zsborder/40 hover:bg-zsborder"
        >
          List view
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zsmuted text-sm">
          Quarantine is empty. The whitelist is doing its job.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {messages.map((m) => {
              const risk = senderRisk(m.from_name, m.from_address);
              const ttl = ttlBadge(m.expires_at);
              const isBusy = busyId === m.id;
              return (
                <article
                  key={m.id}
                  className={`bg-zspanel border border-zsborder rounded-lg p-3 flex flex-col gap-2 fade-in ${isBusy ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {m.from_name || m.from_address}
                      </div>
                      <div className="text-xs text-zsmuted truncate">
                        {m.from_address}
                      </div>
                    </div>
                    <span className="text-[10px] text-zsmuted shrink-0">
                      {formatDistanceToNowStrict(new Date(m.received_at))}
                    </span>
                  </div>

                  <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
                    {m.subject || '(no subject)'}
                  </div>
                  <div className="text-xs text-zsmuted line-clamp-3 min-h-[3rem]">
                    {m.preview || ''}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {risk && (
                      <span
                        className="inline-flex items-center gap-1 text-zsdanger"
                        title={risk}
                      >
                        <ShieldAlert className="w-3 h-3" />
                        spoof
                      </span>
                    )}
                    {(m.tracker_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-zsdanger">
                        <EyeOff className="w-3 h-3" />
                        {m.tracker_count}
                      </span>
                    )}
                    {m.attachment_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-zsmuted">
                        <Paperclip className="w-3 h-3" />
                        {m.attachment_count}
                      </span>
                    )}
                    {ttl && (
                      <span className="inline-flex items-center gap-1 text-zsmuted">
                        <Clock className="w-3 h-3" />
                        {ttl}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      disabled={isBusy}
                      onClick={() => trust(m.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-zsok/20 text-zsok rounded py-1.5 text-xs hover:bg-zsok/30"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Trust
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => remove(m.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-zsdanger/15 text-zsdanger rounded py-1.5 text-xs hover:bg-zsdanger/25"
                    >
                      <X className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                  <div className="text-[10px] text-zsmuted text-center mt-0.5 inline-flex items-center justify-center gap-1">
                    <Check className="w-3 h-3" />
                    Or do nothing — auto-deletes by TTL.
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
