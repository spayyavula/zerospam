import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../api';
import type { Attachment, MessageDetail } from '../types';
import { senderRisk } from '../utils/sender';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trash2,
  Inbox,
  Star,
  UserPlus,
  Paperclip,
  Download,
  Image,
  ImageOff,
  Code,
  Type,
  Reply,
  ReplyAll,
  Forward,
  Tag,
} from 'lucide-react';
import type { ReplyMode } from '../types';
import TrackerDossier from './TrackerDossier';

type Props = {
  messageId: string | null;
  onChanged: () => void;
  onReply: (id: string, mode: ReplyMode) => void;
};

function authChip(label: string, val: number | null) {
  let icon = <HelpCircle className="w-3.5 h-3.5" />;
  let color = 'text-zsmuted';
  if (val === 1) {
    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
    color = 'text-zsok';
  } else if (val === 0) {
    icon = <XCircle className="w-3.5 h-3.5" />;
    color = 'text-zsdanger';
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      {icon}
      {label}
    </span>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// Build the iframe srcDoc. By default, inject a CSP meta tag that blocks remote
// content loads (images, fonts, css, etc.) — typical privacy posture for an
// untrusted message. When the user opts in with "Show remote content" we don't
// allow direct external loads either: we rewrite every <img src> to point at our
// own /api/proxy/image endpoint, so the sender's tracking endpoint sees a
// request from the server, not from the user's IP.
function htmlSrcDoc(html: string, allowRemote: boolean, proxyOrigin: string): string {
  let body = html;
  if (allowRemote) {
    body = body.replace(
      /(<img\b[^>]*\bsrc\s*=\s*["'])(https?:\/\/[^"']+)(["'])/gi,
      (_m, pre: string, url: string, post: string) =>
        `${pre}${proxyOrigin}/api/proxy/image?url=${encodeURIComponent(url)}${post}`,
    );
  }
  const csp = allowRemote
    ? `default-src 'unsafe-inline' data:; img-src ${proxyOrigin} data:; style-src 'unsafe-inline' data:; script-src 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'`
    : `default-src 'unsafe-inline' data:; img-src data:; style-src 'unsafe-inline' data:; script-src 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'`;
  return `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<base target="_blank">
<style>
  html,body { margin:0; padding:12px; background:#0b0e14; color:#dbe3ef;
    font-family: -apple-system, system-ui, sans-serif; font-size:14px; line-height:1.55; }
  a { color:#5cc8ff; }
  img { max-width:100%; height:auto; }
  blockquote { border-left:3px solid #1f2733; padding-left:12px; color:#7c8aa0; }
  pre { background:#11151c; padding:8px; border-radius:6px; overflow:auto; }
</style>
</head><body>${body}</body></html>`;
}

export default function ReadingPane({ messageId, onChanged, onReply }: Props) {
  const [msg, setMsg] = useState<MessageDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showRemote, setShowRemote] = useState(false);
  const [forceText, setForceText] = useState(false);

  useEffect(() => {
    setShowRemote(false);
    setForceText(false);
    if (!messageId) {
      setMsg(null);
      setAttachments([]);
      return;
    }
    Promise.all([api.get(messageId), api.attachments(messageId)])
      .then(([m, a]) => {
        setMsg(m);
        setAttachments(a);
      })
      .catch(() => {
        setMsg(null);
        setAttachments([]);
      });
  }, [messageId]);

  const srcDoc = useMemo(() => {
    if (!msg?.body_html) return null;
    return htmlSrcDoc(msg.body_html, showRemote, window.location.origin);
  }, [msg?.body_html, showRemote]);

  if (!messageId) {
    return (
      <div className="h-full flex items-center justify-center text-zsmuted text-sm">
        Select a message to read.
      </div>
    );
  }
  if (!msg) {
    return <div className="p-6 text-zsmuted text-sm">Loading…</div>;
  }

  const isQuarantined = msg.folder === 'quarantine';
  const isTrust = !!msg.whitelist_match;
  const risk = senderRisk(msg.from_name, msg.from_address);
  const hasHtml = !!msg.body_html;
  const hasText = !!msg.body_text;
  const renderHtml = hasHtml && !forceText;

  return (
    <article className="h-full flex flex-col bg-paper text-ink">
      {risk && (
        <div className="bg-zsdanger/10 border-b border-zsdanger/30 px-4 py-2 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-zsdanger shrink-0" />
          <span className="text-zsdanger font-medium">Spoof risk:</span>
          <span className="text-zsmuted">{risk}</span>
        </div>
      )}

      {isQuarantined && (
        <div className="bg-zsdanger/10 border-b border-zsdanger/30 px-4 py-2 text-sm flex items-center gap-2 flex-wrap">
          <ShieldAlert className="w-4 h-4 text-zsdanger" />
          <span className="text-zsdanger">Quarantined.</span>
          <span className="text-zsmuted">
            {msg.expires_at ? `Auto-deletes ${format(new Date(msg.expires_at), 'PPp')}` : 'No TTL'}
          </span>
          <div className="flex-1" />
          <button
            onClick={async () => {
              await api.trustSender(msg.id);
              onChanged();
            }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-zsok/20 text-zsok hover:bg-zsok/30"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Trust sender + Inbox
          </button>
          <button
            onClick={async () => {
              await api.move(msg.id, 'inbox');
              onChanged();
            }}
            className="text-xs px-2 py-1 rounded bg-zsborder hover:bg-zsborder/70"
          >
            Move to Inbox
          </button>
        </div>
      )}

      <header className="px-6 py-4 border-b-2 border-rule-strong">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl leading-tight">{msg.subject || '(no subject)'}</h1>
            <div className="mt-1 text-sm">
              <span className="font-medium">{msg.from_name || msg.from_address}</span>
              {msg.from_name && <span className="text-zsmuted"> &lt;{msg.from_address}&gt;</span>}
            </div>
            <div className="mt-0.5 text-xs text-zsmuted">
              to {JSON.parse(msg.to_addresses).join(', ')} · {format(new Date(msg.received_at), 'PPp')}
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {isTrust ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] uppercase bg-signal text-signal-ink px-1.5 py-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  Trusted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-quiet">no whitelist match</span>
              )}
              {authChip('SPF', msg.spf_pass)}
              {authChip('DKIM', msg.dkim_pass)}
              {authChip('DMARC', msg.dmarc_pass)}
              {msg.delivered_to_alias && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-zsaccent"
                  title="This message landed via a disposable alias. The sender doesn't know your real address."
                >
                  <Tag className="w-3.5 h-3.5" />
                  alias: {msg.delivered_to_alias}
                </span>
              )}
              <span className="text-xs text-zsmuted">{fmtBytes(msg.size_bytes)}</span>
            </div>
            {(msg.tracker_count ?? 0) > 0 && (
              <div className="mt-2">
                <TrackerDossier messageId={msg.id} count={msg.tracker_count ?? 0} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              title="Reply (r)"
              onClick={() => onReply(msg.id, 'reply')}
              className="p-1.5 rounded hover:bg-zsborder/40"
            >
              <Reply className="w-4 h-4" />
            </button>
            <button
              title="Reply All (R)"
              onClick={() => onReply(msg.id, 'reply-all')}
              className="p-1.5 rounded hover:bg-zsborder/40"
            >
              <ReplyAll className="w-4 h-4" />
            </button>
            <button
              title="Forward (f)"
              onClick={() => onReply(msg.id, 'forward')}
              className="p-1.5 rounded hover:bg-zsborder/40"
            >
              <Forward className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-zsborder mx-1" />
            <button
              title={msg.starred ? 'Unstar (s)' : 'Star (s)'}
              onClick={async () => {
                await api.setStarred(msg.id, !msg.starred);
                onChanged();
                api.get(msg.id).then(setMsg);
              }}
              className="p-1.5 rounded hover:bg-zsborder/40"
            >
              <Star className={`w-4 h-4 ${msg.starred ? 'text-yellow-400 fill-yellow-400' : 'text-zsmuted'}`} />
            </button>
            {msg.folder !== 'inbox' && msg.folder !== 'quarantine' && (
              <button
                title="Move to Inbox"
                onClick={async () => {
                  await api.move(msg.id, 'inbox');
                  onChanged();
                }}
                className="p-1.5 rounded hover:bg-zsborder/40"
              >
                <Inbox className="w-4 h-4" />
              </button>
            )}
            <button
              title={msg.folder === 'trash' ? 'Delete forever (#)' : 'Move to Trash (e)'}
              onClick={async () => {
                if (msg.folder === 'trash') {
                  if (!confirm('Delete forever?')) return;
                  await api.remove(msg.id);
                } else {
                  await api.move(msg.id, 'trash');
                }
                onChanged();
              }}
              className="p-1.5 rounded hover:bg-zsdanger/20 text-zsdanger"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <a
                key={a.id}
                href={api.attachmentDownloadUrl(a.id)}
                download={a.filename ?? `attachment-${a.id}`}
                className="inline-flex items-center gap-2 px-2 py-1 bg-zsborder/40 hover:bg-zsborder rounded text-xs"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span className="truncate max-w-[16rem]">{a.filename || `attachment-${a.id}`}</span>
                <span className="text-zsmuted">{fmtBytes(a.size_bytes)}</span>
                <Download className="w-3 h-3 text-zsmuted" />
              </a>
            ))}
          </div>
        )}
      </header>

      {hasHtml && (
        <div className="px-6 py-2 border-b border-zsborder bg-zspanel/40 flex items-center gap-2 text-xs text-zsmuted">
          <button
            onClick={() => setShowRemote((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zsborder/40 hover:bg-zsborder"
            title={
              showRemote
                ? "Images load through ZeroSpam's image proxy — sender sees a request from the server, not your IP."
                : 'Remote images blocked. Click to load via the image proxy (your IP stays hidden either way).'
            }
          >
            {showRemote ? <Image className="w-3.5 h-3.5" /> : <ImageOff className="w-3.5 h-3.5" />}
            {showRemote ? 'Images via proxy' : 'Images blocked'}
          </button>
          {hasText && (
            <button
              onClick={() => setForceText((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zsborder/40 hover:bg-zsborder"
            >
              {forceText ? <Code className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
              {forceText ? 'Showing text' : 'Show as plain text'}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 fade-in">
        {renderHtml && srcDoc ? (
          <iframe
            title="message body"
            sandbox=""
            srcDoc={srcDoc}
            className="w-full h-full bg-zsbg"
          />
        ) : msg.body_text ? (
          <pre className="whitespace-pre-wrap font-body text-[15px] leading-7 text-ink-soft px-6 py-6 max-w-[72ch] mx-auto overflow-auto h-full">
            {msg.body_text}
          </pre>
        ) : msg.body_html ? (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed px-6 py-4 text-zsmuted overflow-auto h-full">
            [HTML stripped — toggle Show HTML to render in a sandbox]
            {'\n\n'}
            {msg.body_html.replace(/<[^>]+>/g, '')}
          </pre>
        ) : (
          <div className="p-6 text-zsmuted text-sm">(empty body)</div>
        )}
      </div>
    </article>
  );
}
