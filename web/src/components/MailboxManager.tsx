import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Mailbox } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

export default function MailboxManager({ onClose, onChanged }: Props) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [address, setAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ttl, setTtl] = useState(168);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.mailboxes().then(setMailboxes);
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setError(null);
    if (!address.trim()) return;
    try {
      await api.createMailbox({
        address: address.trim().toLowerCase(),
        displayName: displayName.trim() || undefined,
        quarantineTtlHours: ttl,
      });
      setAddress('');
      setDisplayName('');
      setTtl(168);
      load();
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? 'failed');
    }
  };

  const updateTtl = async (m: Mailbox, hours: number) => {
    if (hours === m.quarantine_ttl_hours) return;
    await api.patchMailbox(m.id, { quarantineTtlHours: hours });
    load();
  };

  const remove = async (m: Mailbox) => {
    if (!confirm(`Delete mailbox ${m.address} and ALL its mail?`)) return;
    await api.deleteMailbox(m.id);
    load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center">
          <div className="font-medium">Mailboxes</div>
          <div className="text-xs text-zsmuted ml-3">
            Each mailbox accepts mail at its full address. Quarantine TTL controls when non-whitelisted mail expires.
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-zsborder grid grid-cols-12 gap-2">
          <input
            className="col-span-5 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
            placeholder="alice@yourdomain.co"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="col-span-3 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
            placeholder="display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <div className="col-span-3 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={8760}
              className="flex-1 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value) || 168)}
            />
            <span className="text-xs text-zsmuted">h TTL</span>
          </div>
          <button
            onClick={create}
            className="col-span-1 bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 inline-flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
          {error && <div className="col-span-12 text-xs text-zsdanger">{error}</div>}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {mailboxes.map((m) => (
            <li key={m.id} className="px-4 py-2 border-b border-zsborder/60 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{m.address}</div>
                <div className="text-xs text-zsmuted">{m.display_name ?? '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={m.quarantine_ttl_hours}
                  min={1}
                  max={8760}
                  onBlur={(e) => updateTtl(m, Number(e.target.value) || m.quarantine_ttl_hours)}
                  className="w-20 bg-zsbg border border-zsborder rounded px-2 py-1 text-sm text-right"
                />
                <span className="text-xs text-zsmuted">h</span>
              </div>
              <button
                onClick={() => remove(m)}
                className="p-1.5 rounded hover:bg-zsdanger/20 text-zsdanger"
                title="Delete mailbox + all mail"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
          {mailboxes.length === 0 && <li className="p-6 text-sm text-zsmuted">No mailboxes yet.</li>}
        </ul>
      </div>
    </div>
  );
}
