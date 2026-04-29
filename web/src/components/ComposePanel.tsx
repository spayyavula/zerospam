import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ComposeInitial, Mailbox } from '../types';
import { Send, X, ShieldCheck, Save, Trash2 } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

// Convert a plaintext seed (e.g. a reply quote) into a minimal HTML doc the
// editor can render: escape <, >, &, then wrap each non-empty paragraph in <p>.
function plaintextToHtml(text: string | undefined): string {
  if (!text) return '';
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

type Props = {
  mailboxes: Mailbox[];
  defaultMailboxId: number;
  initial?: ComposeInitial;
  draftId?: string;
  onClose: () => void;
  onSent: () => void;
  onDraftSaved?: () => void;
};

function parseAddrs(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinAddrs(arr?: string[] | null): string {
  return arr && arr.length ? arr.join(', ') : '';
}

export default function ComposePanel({
  mailboxes,
  defaultMailboxId,
  initial,
  draftId: initialDraftId,
  onClose,
  onSent,
  onDraftSaved,
}: Props) {
  const [mailboxId, setMailboxId] = useState(initial?.mailboxId ?? defaultMailboxId);
  const [to, setTo] = useState(joinAddrs(initial?.to));
  const [cc, setCc] = useState(joinAddrs(initial?.cc));
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [bodyHtml, setBodyHtml] = useState(() => plaintextToHtml(initial?.text));
  const [bodyText, setBodyText] = useState(initial?.text ?? '');
  const [showCc, setShowCc] = useState(!!initial?.cc?.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const inReplyTo = initial?.inReplyTo ?? null;
  const references = initial?.references ?? null;
  const replyToMessageId = initial?.replyToMessageId ?? null;
  const dirty = useRef(false);

  // Autosave: debounce 1.5s after the last edit. Creates a draft on first save,
  // PATCHes thereafter. Skipped while a send is in flight.
  useEffect(() => {
    if (!dirty.current || busy) return;
    const handle = setTimeout(async () => {
      try {
        setDraftStatus('saving');
        if (draftId) {
          await api.patchDraft(draftId, {
            to: parseAddrs(to),
            cc: showCc ? parseAddrs(cc) : [],
            subject,
            text: bodyText,
            html: bodyHtml || undefined,
          });
        } else {
          // Don't create an empty draft — wait until the user has typed something meaningful.
          if (!to.trim() && !subject.trim() && !bodyText.trim()) {
            setDraftStatus('idle');
            return;
          }
          const r = await api.createDraft({
            mailboxId,
            to: parseAddrs(to),
            cc: showCc ? parseAddrs(cc) : undefined,
            subject,
            text: bodyText,
            html: bodyHtml || undefined,
            inReplyTo,
            references,
            replyToMessageId,
          });
          setDraftId(r.id);
        }
        setDraftStatus('saved');
        onDraftSaved?.();
      } catch {
        setDraftStatus('idle');
      }
    }, 1500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, subject, bodyHtml, bodyText, showCc, mailboxId]);

  const markDirty = (fn: (v: string) => void) => (v: string) => {
    dirty.current = true;
    setDraftStatus('idle');
    fn(v);
  };

  const doSend = async () => {
    setError(null);
    setStatus(null);
    const toAddrs = parseAddrs(to);
    if (!toAddrs.length) {
      setError('At least one recipient is required.');
      return;
    }
    setBusy(true);
    try {
      let r;
      if (draftId) {
        // Make sure latest values are persisted, then send the draft so the server
        // is the single source of truth for what's transmitted.
        await api.patchDraft(draftId, {
          to: toAddrs,
          cc: showCc ? parseAddrs(cc) : [],
          subject,
          text: bodyText,
          html: bodyHtml || undefined,
        });
        r = await api.sendDraft(draftId);
      } else {
        r = await api.send({
          mailboxId,
          to: toAddrs,
          cc: showCc ? parseAddrs(cc) : undefined,
          subject: subject || '(no subject)',
          text: bodyText,
          html: bodyHtml || undefined,
          inReplyTo,
          references,
        });
      }
      setStatus(
        `Sent. DKIM-signed.${r.whitelistAdded > 0 ? ` Trust-on-send: ${r.whitelistAdded} new whitelist rule(s).` : ''}`,
      );
      onSent();
      setTimeout(onClose, 1100);
    } catch (e: any) {
      setError(e?.message ?? 'send failed');
    } finally {
      setBusy(false);
    }
  };

  const discardDraft = async () => {
    if (!draftId) {
      onClose();
      return;
    }
    if (!confirm('Discard this draft?')) return;
    await api.deleteDraft(draftId);
    onDraftSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center gap-2">
          <Send className="w-4 h-4 text-zsaccent" />
          <div className="font-medium">
            {inReplyTo ? 'Reply' : initial?.subject?.startsWith('Fwd:') ? 'Forward' : 'New message'}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-zsmuted">
            <ShieldCheck className="w-3 h-3" /> DKIM-signed · trust-on-send
          </span>
          <div className="flex-1" />
          {draftStatus === 'saving' && (
            <span className="text-xs text-zsmuted inline-flex items-center gap-1">
              <Save className="w-3 h-3" />
              Saving…
            </span>
          )}
          {draftStatus === 'saved' && (
            <span className="text-xs text-zsmuted inline-flex items-center gap-1">
              <Save className="w-3 h-3" />
              Draft saved
            </span>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          <Row label="From">
            <select
              className="w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              value={mailboxId}
              onChange={(e) => {
                dirty.current = true;
                setMailboxId(Number(e.target.value));
              }}
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name ? `${m.display_name} <${m.address}>` : m.address}
                </option>
              ))}
            </select>
          </Row>
          <Row label="To">
            <input
              className="w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              value={to}
              onChange={(e) => markDirty(setTo)(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
            />
          </Row>
          {showCc ? (
            <Row label="Cc">
              <input
                className="w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
                value={cc}
                onChange={(e) => markDirty(setCc)(e.target.value)}
              />
            </Row>
          ) : (
            <button onClick={() => setShowCc(true)} className="text-xs text-zsmuted hover:text-zstext">
              + Cc
            </button>
          )}
          <Row label="Subject">
            <input
              className="w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
              value={subject}
              onChange={(e) => markDirty(setSubject)(e.target.value)}
            />
          </Row>
          <RichTextEditor
            valueHtml={bodyHtml}
            placeholder="Write your message…"
            onChange={(html, text) => {
              dirty.current = true;
              setDraftStatus('idle');
              setBodyHtml(html);
              setBodyText(text);
            }}
          />
        </div>

        <footer className="px-4 py-3 border-t border-zsborder flex items-center gap-3">
          <button
            onClick={doSend}
            disabled={busy || !to.trim()}
            className="bg-zsaccent text-zsbg font-medium px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {busy ? 'Sending…' : 'Send'}
          </button>
          {draftId && (
            <button
              onClick={discardDraft}
              className="text-xs px-2 py-1 rounded hover:bg-zsdanger/20 text-zsdanger inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard draft
            </button>
          )}
          {error && <span className="text-xs text-zsdanger">{error}</span>}
          {status && <span className="text-xs text-zsok">{status}</span>}
        </footer>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-xs uppercase tracking-wider text-zsmuted shrink-0">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
