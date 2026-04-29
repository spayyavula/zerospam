import { useEffect, useState } from 'react';
import { api } from '../api';
import { X, Copy, ShieldCheck } from 'lucide-react';

type Domain = { id: number; name: string; dkim_selector: string | null; dkim_public_pem: string | null };
type DnsRec = { host: string; type: 'TXT'; value: string; copyPaste: string };

export default function DkimPanel({ onClose }: { onClose: () => void }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dns, setDns] = useState<DnsRec | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.domains().then((d: any) => {
      setDomains(d);
      if (d[0]) setActiveId(d[0].id);
    });
  }, []);

  useEffect(() => {
    if (activeId == null) return;
    api.domainDns(activeId).then(setDns);
  }, [activeId]);

  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-zsok" />
          <div className="font-medium">DKIM DNS records</div>
          <span className="text-xs text-zsmuted">
            Publish each domain's TXT record so receiving servers can verify your signature.
          </span>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-zsborder flex items-center gap-2">
          <span className="text-xs text-zsmuted">Domain:</span>
          <select
            className="bg-zsbg border border-zsborder rounded px-2 py-1 text-sm"
            value={activeId ?? ''}
            onChange={(e) => setActiveId(Number(e.target.value))}
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {dns && (
          <div className="p-4 space-y-3 overflow-auto">
            <Field label="Host" value={dns.host} onCopy={copy} />
            <Field label="Type" value={dns.type} onCopy={copy} />
            <Field label="Value" value={dns.value} onCopy={copy} mono />
            <div className="border-t border-zsborder pt-3">
              <div className="text-xs uppercase tracking-wider text-zsmuted mb-1">Copy-paste record</div>
              <div className="flex items-start gap-2">
                <pre className="flex-1 bg-zsbg border border-zsborder rounded p-2 text-xs font-mono whitespace-pre-wrap break-all">
                  {dns.copyPaste}
                </pre>
                <button
                  onClick={() => copy(dns.copyPaste)}
                  className="px-2 py-1.5 rounded bg-zsborder/40 hover:bg-zsborder text-xs inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="text-xs text-zsmuted">
              Verify with <code className="font-mono">dig TXT {dns.host.replace(/\.$/, '')}</code> after
              the record propagates. The first signed message after that should show DKIM ✓ in
              receivers' UIs.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onCopy, mono }: { label: string; value: string; onCopy: (s: string) => void; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zsmuted mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm ${mono ? 'font-mono break-all' : ''}`}>
          {value}
        </div>
        <button
          onClick={() => onCopy(value)}
          className="p-1.5 rounded bg-zsborder/40 hover:bg-zsborder"
          title="Copy"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
