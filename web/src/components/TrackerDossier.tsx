import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TrackerHit } from '../types';
import { Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  messageId: string;
  count: number;
};

export default function TrackerDossier({ messageId, count }: Props) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<TrackerHit[]>([]);

  useEffect(() => {
    if (!open) return;
    api.trackers(messageId).then((r) => setHits(r.hits));
  }, [open, messageId]);

  if (count === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-zsdanger hover:underline"
        title="Tap to see what each tracker would have learned."
      >
        <EyeOff className="w-3.5 h-3.5" />
        {count} tracker{count === 1 ? '' : 's'} blocked
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-2 bg-zsdanger/5 border border-zsdanger/20 rounded p-2 text-xs space-y-2 max-w-2xl">
          {hits.length === 0 && <div className="text-zsmuted">Loading…</div>}
          {hits.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  h.invisible ? 'bg-zsdanger' : 'bg-yellow-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zstext">{h.provider}</span>
                  {h.invisible && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zsdanger/20 text-zsdanger text-[10px]">
                      <Eye className="w-2.5 h-2.5" />
                      invisible 1×1
                    </span>
                  )}
                </div>
                <div className="text-zsmuted truncate font-mono mt-0.5" title={h.url}>
                  {h.url}
                </div>
                <div className="text-zsmuted mt-0.5">
                  Would have learned:{' '}
                  <span className="text-zstext">{h.learns.join(', ')}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-zsdanger/20 text-zsmuted">
            All blocked — sender has no idea you opened this. Toggle &quot;Show remote content&quot;
            to allow them through the local image proxy (still hides your IP).
          </div>
        </div>
      )}
    </div>
  );
}
