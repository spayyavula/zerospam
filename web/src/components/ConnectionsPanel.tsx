import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Connection } from '../types';

export default function ConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnections(await api.connections());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDisconnect = async (c: Connection) => {
    if (!window.confirm(`Disconnect ${c.email}? Imported mail is kept.`)) return;
    await api.disconnect(c.id);
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Connected accounts</h3>
        <div className="flex items-center gap-2">
          <a
            href={api.gmailConnectUrl()}
            className="px-3 py-1.5 rounded bg-zsaccent text-zsbg text-sm font-medium"
          >
            Connect Gmail
          </a>
          <a
            href={api.outlookConnectUrl()}
            className="px-3 py-1.5 rounded bg-zsaccent text-zsbg text-sm font-medium"
          >
            Connect Outlook
          </a>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zsmuted">Loading…</p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-zsmuted">No connected accounts yet.</p>
      ) : (
        <ul className="divide-y divide-zsborder">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{c.email}</div>
                <div className="text-xs text-zsmuted">
                  {c.provider} · <span>{c.status}</span>
                  {c.status === 'needs_reconnect' && (
                    <a
                      href={c.provider === 'outlook' ? api.outlookConnectUrl() : api.gmailConnectUrl()}
                      className="ml-2 text-zsaccent underline"
                    >
                      Reconnect
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDisconnect(c)}
                className="text-xs px-2 py-1 rounded border border-zsborder hover:bg-zsborder/40"
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
