import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Mailbox } from '../types';
import { X, Plus, Trash2, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import ConnectionsPanel from './ConnectionsPanel';

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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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

  const updateScreenerSla = async (m: Mailbox, hours: number) => {
    if (hours === m.screener_sla_hours) return;
    await api.patchMailbox(m.id, { screenerSlaHours: hours });
    load();
  };

  const remove = async (m: Mailbox) => {
    if (!confirm(`Delete mailbox ${m.address} and ALL its mail?`)) return;
    await api.deleteMailbox(m.id);
    load();
    onChanged();
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveDigest = async (
    m: Mailbox,
    fields: {
      digestEnabled?: boolean;
      digestHour?: number;
      digestRecipientMode?: 'external' | 'loopback';
      ownerEmail?: string | null;
    },
  ) => {
    try {
      await api.patchMailbox(m.id, fields);
      load();
    } catch (e: any) {
      alert(e?.message ?? 'save failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center">
          <div className="font-medium">Mailboxes</div>
          <div className="text-xs text-zsmuted ml-3">
            Each mailbox accepts mail at its full address. Quarantine TTL controls when non-whitelisted mail expires.
          </div>
          <div className="flex-1" />
          <button onClick={onClose} title="Close" className="p-1.5 rounded hover:bg-zsborder/40">
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
              aria-label="New mailbox quarantine TTL in hours"
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
            title="Create mailbox"
            className="col-span-1 bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 inline-flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
          {error && <div className="col-span-12 text-xs text-zsdanger">{error}</div>}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {mailboxes.map((m) => {
            const isOpen = expanded.has(m.id);
            return (
              <li key={m.id} className="border-b border-zsborder/60">
                <div className="px-4 py-2 flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(m.id)}
                    className="p-1 rounded hover:bg-zsborder/40"
                    title="Digest settings"
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.address}</div>
                    <div className="text-xs text-zsmuted">{m.display_name ?? '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.digest_enabled === 1 && (
                      <span className="text-xs text-zsaccent inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> digest @ {String(m.digest_hour).padStart(2, '0')}:00
                      </span>
                    )}
                    <input
                      type="number"
                      aria-label="Quarantine TTL hours"
                      defaultValue={m.quarantine_ttl_hours}
                      min={1}
                      max={8760}
                      onBlur={(e) => updateTtl(m, Number(e.target.value) || m.quarantine_ttl_hours)}
                      className="w-20 bg-zsbg border border-zsborder rounded px-2 py-1 text-sm text-right"
                    />
                    <span className="text-xs text-zsmuted">h</span>
                    <input
                      type="number"
                      aria-label="Screener SLA hours"
                      defaultValue={m.screener_sla_hours}
                      min={1}
                      max={720}
                      onBlur={(e) => updateScreenerSla(m, Number(e.target.value) || m.screener_sla_hours)}
                      className="w-20 bg-zsbg border border-zsborder rounded px-2 py-1 text-sm text-right"
                    />
                    <span className="text-xs text-zsmuted">h screen</span>
                  </div>
                  <button
                    onClick={() => remove(m)}
                    className="p-1.5 rounded hover:bg-zsdanger/20 text-zsdanger"
                    title="Delete mailbox + all mail"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {isOpen && <DigestSettings mailbox={m} onSave={(f) => saveDigest(m, f)} />}
              </li>
            );
          })}
          {mailboxes.length === 0 && <li className="p-6 text-sm text-zsmuted">No mailboxes yet.</li>}
        </ul>
        <div className="px-4 py-4 border-t border-zsborder">
          <ConnectionsPanel />
        </div>
      </div>
    </div>
  );
}

function DigestSettings({
  mailbox,
  onSave,
}: {
  mailbox: Mailbox;
  onSave: (fields: {
    digestEnabled?: boolean;
    digestHour?: number;
    digestRecipientMode?: 'external' | 'loopback';
    ownerEmail?: string | null;
  }) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(mailbox.digest_enabled === 1);
  const [hour, setHour] = useState(mailbox.digest_hour);
  const [mode, setMode] = useState<'external' | 'loopback'>(mailbox.digest_recipient_mode);
  const [ownerEmail, setOwnerEmail] = useState(mailbox.owner_email ?? '');

  const save = async () => {
    await onSave({
      digestEnabled: enabled,
      digestHour: hour,
      digestRecipientMode: mode,
      ownerEmail: ownerEmail.trim() || null,
    });
  };

  return (
    <div className="px-4 pb-4 pt-1 bg-zsbg/30 border-t border-zsborder/40 grid grid-cols-12 gap-3 text-sm">
      <label className="col-span-12 inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Email me a daily digest of quarantined senders</span>
      </label>

      <label className="col-span-6 flex items-center gap-2">
        <span className="text-xs text-zsmuted">Time of day:</span>
        <select
          className="bg-zsbg border border-zsborder rounded px-2 py-1 text-sm"
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          disabled={!enabled}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>
              {String(i).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>

      <fieldset className="col-span-12 grid grid-cols-12 gap-2">
        <legend className="col-span-12 text-xs text-zsmuted">Send digest to:</legend>
        <label className="col-span-12 inline-flex items-center gap-2">
          <input
            type="radio"
            name={`mode-${mailbox.id}`}
            checked={mode === 'external'}
            onChange={() => setMode('external')}
            disabled={!enabled}
          />
          <span>An external inbox</span>
          <input
            type="email"
            className="flex-1 bg-zsbg border border-zsborder rounded px-2 py-1 text-sm"
            placeholder="alice@gmail.com"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            disabled={!enabled || mode !== 'external'}
          />
        </label>
        <label className="col-span-12 inline-flex items-center gap-2">
          <input
            type="radio"
            name={`mode-${mailbox.id}`}
            checked={mode === 'loopback'}
            onChange={() => setMode('loopback')}
            disabled={!enabled}
          />
          <span>This mailbox itself (loopback — appears in your ZeroSpam inbox)</span>
        </label>
      </fieldset>

      <div className="col-span-12 flex items-center justify-between">
        {mailbox.digest_last_error ? (
          <span className="text-xs text-zsdanger truncate" title={mailbox.digest_last_error}>
            last error: {mailbox.digest_last_error}
          </span>
        ) : (
          <span className="text-xs text-zsmuted">
            {mailbox.last_digest_sent_at
              ? `last sent: ${new Date(mailbox.last_digest_sent_at).toLocaleString()}`
              : 'no digest sent yet'}
          </span>
        )}
        <button
          onClick={save}
          className="bg-zsaccent text-zsbg rounded px-3 py-1 text-sm font-medium hover:opacity-90"
        >
          Save digest settings
        </button>
      </div>
    </div>
  );
}
