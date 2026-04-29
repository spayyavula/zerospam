import { useEffect, useState } from 'react';
import { api } from '../api';
import type { WhitelistRule } from '../types';
import { Plus, X } from 'lucide-react';

type Props = {
  mailboxId: number;
  onClose: () => void;
};

export default function WhitelistPanel({ mailboxId, onClose }: Props) {
  const [rules, setRules] = useState<WhitelistRule[]>([]);
  const [kind, setKind] = useState<'address' | 'domain' | 'regex'>('address');
  const [pattern, setPattern] = useState('');
  const [note, setNote] = useState('');

  const load = () => api.whitelist(mailboxId).then(setRules);
  useEffect(() => {
    load();
  }, [mailboxId]);

  const add = async () => {
    if (!pattern.trim()) return;
    await api.addRule({ mailboxId, kind, pattern: pattern.trim(), note: note.trim() || undefined });
    setPattern('');
    setNote('');
    load();
  };

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 px-4 border-b border-zsborder flex items-center">
        <div className="font-medium">Whitelist</div>
        <div className="text-xs text-zsmuted ml-3">
          Only these senders land in Inbox. Everything else expires from Quarantine.
        </div>
        <div className="flex-1" />
        <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="px-4 py-3 border-b border-zsborder bg-zspanel/40">
        <div className="grid grid-cols-12 gap-2">
          <select
            className="col-span-3 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
          >
            <option value="address">address</option>
            <option value="domain">domain</option>
            <option value="regex">regex</option>
          </select>
          <input
            className="col-span-5 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
            placeholder={
              kind === 'address'
                ? 'alice@trusted.co'
                : kind === 'domain'
                  ? 'trusted.co'
                  : '^.*@(github|gitlab)\\.com$'
            }
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
          <input
            className="col-span-3 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
            placeholder="note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            onClick={add}
            className="col-span-1 bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 inline-flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {rules.length === 0 && (
          <li className="p-6 text-sm text-zsmuted">
            No rules yet. Without rules, all incoming mail goes to Quarantine.
          </li>
        )}
        {rules.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-2 px-4 py-2 border-b border-zsborder/60 hover:bg-zsborder/20"
          >
            <span className="text-xs uppercase tracking-wide text-zsmuted w-16">{r.kind}</span>
            <span className="text-sm flex-1 truncate font-mono">{r.pattern}</span>
            {r.note && <span className="text-xs text-zsmuted truncate max-w-[40%]">{r.note}</span>}
            <button
              onClick={async () => {
                await api.removeRule(r.id);
                load();
              }}
              className="p-1 rounded hover:bg-zsdanger/20 text-zsdanger"
              title="Remove rule"
            >
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
