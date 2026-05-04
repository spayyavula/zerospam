import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';

type Props = {
  mailboxId: number;
  domain: string;
  onClose: () => void;
  onChanged: () => void;
};

export default function DomainExpandToast({ mailboxId, domain, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [doneText, setDoneText] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(onClose, doneText ? 2500 : 5000);
    return () => clearTimeout(t);
  }, [doneText, onClose]);

  const onExpand = async () => {
    setBusy(true);
    try {
      const r = await api.screenerAllowDomain(mailboxId, domain);
      setDoneText(`Moved ${r.moved} messages from @${domain}`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const node = (
    <div className="fixed z-[70] right-4 bottom-4 w-[min(92vw,360px)] rounded-lg border border-zsborder bg-zspanel shadow-lg p-3 text-sm">
      {doneText ? (
        <div className="text-zstext">{doneText}</div>
      ) : (
        <>
          <div className="text-zstext">Trusted this sender. Expand to everyone at @{domain}?</div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              className="px-2.5 py-1.5 rounded border border-zsborder hover:bg-zsborder/30 text-xs"
              onClick={onClose}
            >
              Dismiss
            </button>
            <button
              onClick={onExpand}
              disabled={busy}
              className="px-2.5 py-1.5 rounded text-xs font-medium bg-zsaccent text-zsbg hover:opacity-90 disabled:opacity-70"
            >
              Trust everyone @{domain}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(node, document.body);
}
