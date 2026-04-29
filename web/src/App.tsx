import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, subscribeEvents } from './api';
import type {
  BulkAction,
  ComposeInitial,
  Counts,
  Draft,
  FolderName,
  Mailbox,
  MessageSummary,
  ReplyMode,
  SidebarFolder,
} from './types';
import Sidebar from './components/Sidebar';
import MessageList, { type ListFilter } from './components/MessageList';
import ReadingPane from './components/ReadingPane';
import WhitelistPanel from './components/WhitelistPanel';
import InjectorPanel from './components/InjectorPanel';
import MailboxManager from './components/MailboxManager';
import ComposePanel from './components/ComposePanel';
import DkimPanel from './components/DkimPanel';
import HelpModal from './components/HelpModal';
import AliasManager from './components/AliasManager';
import ProbationaryWall from './components/ProbationaryWall';
import { useShortcuts } from './hooks/useShortcuts';
import { Shield, Settings, HelpCircle } from 'lucide-react';

type ComposeState = {
  open: boolean;
  initial?: ComposeInitial;
  draftId?: string;
};

// Adapter so a Draft row can render in MessageList alongside Messages.
function draftToSummary(d: Draft): MessageSummary {
  const to = d.to_addresses ? (JSON.parse(d.to_addresses) as string[]) : [];
  return {
    id: d.id,
    mailbox_id: d.mailbox_id,
    folder: 'sent', // not really, but the type union doesn't have 'draft' — only used for display fallbacks
    from_address: '(draft)',
    from_name: 'Draft',
    to_addresses: JSON.stringify(to),
    subject: d.subject,
    preview:
      (d.body_text ?? d.body_html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200) ||
      null,
    received_at: d.updated_at,
    expires_at: null,
    read: 1,
    starred: 0,
    spf_pass: null,
    dkim_pass: null,
    dmarc_pass: null,
    whitelist_match: null,
    size_bytes: 0,
    attachment_count: 0,
  };
}

export default function App() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<number | null>(null);
  const [folder, setFolder] = useState<SidebarFolder>('inbox');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<'reading' | 'whitelist' | 'inject'>('reading');
  const [showMailboxes, setShowMailboxes] = useState(false);
  const [compose, setCompose] = useState<ComposeState>({ open: false });
  const [showDkim, setShowDkim] = useState(false);
  const [showAliases, setShowAliases] = useState(false);
  const [probationary, setProbationary] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MessageSummary[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ListFilter>('all');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // initial mailbox load
  useEffect(() => {
    api.mailboxes().then((m) => {
      setMailboxes(m);
      if (m.length > 0) setActiveMailboxId(m[0].id);
    });
  }, []);

  const refreshCounts = useCallback(async () => {
    if (activeMailboxId == null) return;
    setCounts(await api.counts(activeMailboxId));
  }, [activeMailboxId]);

  const refreshList = useCallback(async () => {
    if (activeMailboxId == null) return;
    if (folder === 'drafts') {
      const ds = await api.listDrafts(activeMailboxId);
      setDrafts(ds);
      setMessages(ds.map(draftToSummary));
    } else {
      setMessages(await api.list(activeMailboxId, folder));
      setDrafts([]);
    }
  }, [activeMailboxId, folder]);

  const refresh = useCallback(async () => {
    if (activeMailboxId == null) return;
    if (searchQuery.trim()) {
      const r = await api.search(activeMailboxId, searchQuery.trim());
      setSearchResults(r);
      await refreshCounts();
    } else {
      setSearchResults(null);
      await Promise.all([refreshList(), refreshCounts()]);
    }
  }, [activeMailboxId, searchQuery, refreshList, refreshCounts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // debounced search
  useEffect(() => {
    if (activeMailboxId == null) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.search(activeMailboxId, q).then(setSearchResults).catch(() => setSearchResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, activeMailboxId]);

  // SSE subscription
  useEffect(() => {
    if (activeMailboxId == null) return;
    const off = subscribeEvents((e) => {
      if (
        (e.type === 'message:new' ||
          e.type === 'message:updated' ||
          e.type === 'message:deleted' ||
          e.type === 'whitelist:changed') &&
        e.mailboxId === activeMailboxId
      ) {
        refresh();
      }
    });
    return off;
  }, [activeMailboxId, refresh]);

  const visible = searchResults ?? messages;
  const visibleIds = useMemo(() => visible.map((m) => m.id), [visible]);
  const searchActive = searchResults !== null;
  const activeMailbox = mailboxes.find((m) => m.id === activeMailboxId) ?? null;
  const selectedIndex = selectedId ? visibleIds.indexOf(selectedId) : -1;
  const selectedMsg = selectedId ? visible.find((m) => m.id === selectedId) ?? null : null;

  const openIndex = useCallback(
    async (idx: number) => {
      const m = visible[idx];
      if (!m) return;
      setSelectedId(m.id);
      if (folder === 'drafts') {
        // Open the draft in compose
        const draft = drafts.find((d) => d.id === m.id);
        if (draft && activeMailboxId != null) {
          setCompose({
            open: true,
            draftId: draft.id,
            initial: {
              mailboxId: draft.mailbox_id,
              to: draft.to_addresses ? (JSON.parse(draft.to_addresses) as string[]) : [],
              cc: draft.cc_addresses ? (JSON.parse(draft.cc_addresses) as string[]) : [],
              subject: draft.subject ?? '',
              text: draft.body_text ?? '',
              inReplyTo: draft.in_reply_to,
              references: draft.references_header,
              replyToMessageId: draft.reply_to_message_id,
            },
          });
        }
        return;
      }
      setRightPanel('reading');
      if (!m.read) {
        await api.setRead(m.id, true);
        refresh();
      }
    },
    [visible, drafts, folder, activeMailboxId, refresh],
  );

  const onSelect = (id: string) => {
    const idx = visibleIds.indexOf(id);
    if (idx >= 0) openIndex(idx);
  };

  const handleBulk = async (action: BulkAction) => {
    if (selectedIds.size === 0) return;
    if (action === 'delete' && !confirm(`Delete ${selectedIds.size} message(s) forever?`)) return;
    if (folder === 'drafts') {
      // Bulk on drafts: only delete is sensible.
      if (action === 'delete' || action === 'move-trash') {
        await Promise.all(Array.from(selectedIds).map((id) => api.deleteDraft(id)));
      }
    } else {
      await api.bulk(Array.from(selectedIds), action);
    }
    setSelectedIds(new Set());
    refresh();
  };

  const openReply = async (msgId: string, mode: ReplyMode) => {
    const init = await api.replyPrefill(msgId, mode);
    setCompose({ open: true, initial: init });
  };

  // Keyboard shortcuts
  useShortcuts({
    onNext: () => {
      if (visible.length === 0) return;
      const next = selectedIndex < 0 ? 0 : Math.min(visible.length - 1, selectedIndex + 1);
      openIndex(next);
    },
    onPrev: () => {
      if (visible.length === 0) return;
      const prev = selectedIndex < 0 ? 0 : Math.max(0, selectedIndex - 1);
      openIndex(prev);
    },
    onOpen: () => {
      if (selectedIndex >= 0) openIndex(selectedIndex);
    },
    onStar: async () => {
      if (!selectedMsg || folder === 'drafts') return;
      await api.setStarred(selectedMsg.id, !selectedMsg.starred);
      refresh();
    },
    onTrust: async () => {
      if (!selectedMsg || folder === 'drafts') return;
      await api.trustSender(selectedMsg.id);
      refresh();
    },
    onToggleRead: async () => {
      if (!selectedMsg || folder === 'drafts') return;
      await api.setRead(selectedMsg.id, !selectedMsg.read);
      refresh();
    },
    onTrash: async () => {
      if (!selectedMsg) return;
      if (folder === 'drafts') {
        await api.deleteDraft(selectedMsg.id);
      } else if (selectedMsg.folder !== 'trash') {
        await api.move(selectedMsg.id, 'trash');
      }
      refresh();
    },
    onDelete: async () => {
      if (!selectedMsg) return;
      if (folder === 'drafts') {
        await api.deleteDraft(selectedMsg.id);
      } else if ((selectedMsg.folder as FolderName) === 'trash') {
        if (!confirm('Delete forever?')) return;
        await api.remove(selectedMsg.id);
      } else {
        await api.move(selectedMsg.id, 'trash');
      }
      refresh();
    },
    onSearch: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    onHelp: () => setShowHelp(true),
    onToggleSelect: () => {
      if (!selectedMsg) return;
      setSelectedIds((s) => {
        const next = new Set(s);
        if (next.has(selectedMsg.id)) next.delete(selectedMsg.id);
        else next.add(selectedMsg.id);
        return next;
      });
    },
    onSelectAll: () => {
      setSelectedIds(new Set(visibleIds));
    },
    onEscape: () => {
      if (selectedIds.size > 0) setSelectedIds(new Set());
      else if (showHelp) setShowHelp(false);
      else if (compose.open) setCompose({ open: false });
      else if (showAliases) setShowAliases(false);
      else if (showDkim) setShowDkim(false);
      else if (showMailboxes) setShowMailboxes(false);
      else if (probationary) setProbationary(false);
      else if (rightPanel !== 'reading') setRightPanel('reading');
    },
  });

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 px-4 border-b border-zsborder flex items-center gap-3 bg-zspanel">
        <Shield className="w-5 h-5 text-zsaccent" />
        <div className="font-semibold tracking-tight">ZeroSpam</div>
        <div className="text-zsmuted text-sm hidden sm:block">whitelist-first mail</div>
        <div className="flex-1" />
        {activeMailbox && (
          <select
            className="bg-zsbg border border-zsborder rounded px-2 py-1 text-sm"
            value={activeMailboxId ?? ''}
            onChange={(e) => setActiveMailboxId(Number(e.target.value))}
          >
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.address}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setShowMailboxes(true)}
          className="p-1.5 rounded hover:bg-zsborder/40 text-zsmuted"
          title="Mailboxes"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="p-1.5 rounded hover:bg-zsborder/40 text-zsmuted"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        <Sidebar
          counts={counts}
          folder={folder}
          onFolder={(f) => {
            setFolder(f);
            setSelectedId(null);
            setSelectedIds(new Set());
            setSearchQuery('');
            setSearchResults(null);
            setFilter('all');
            setRightPanel('reading');
          }}
          onCompose={() =>
            activeMailboxId != null &&
            setCompose({ open: true, initial: { mailboxId: activeMailboxId } })
          }
          onWhitelist={() => setRightPanel('whitelist')}
          onInject={() => setRightPanel('inject')}
          onDkim={() => setShowDkim(true)}
          onAliases={() => setShowAliases(true)}
          onPurge={async () => {
            if (activeMailboxId == null) return;
            if (!confirm('Purge all quarantine messages now?')) return;
            await api.purgeQuarantine(activeMailboxId);
            refresh();
          }}
        />

        {folder === 'quarantine' && probationary && activeMailboxId != null ? (
          <ProbationaryWall
            messages={visible}
            mailboxId={activeMailboxId}
            onChanged={refresh}
            onExit={() => setProbationary(false)}
          />
        ) : (
          <>
            <MessageList
              messages={visible}
              folder={folder}
              selectedId={selectedId}
              searchQuery={searchQuery}
              searchActive={searchActive}
              searchInputRef={searchInputRef}
              selectedIds={selectedIds}
              filter={filter}
              onFilterChange={setFilter}
              probationaryAvailable={folder === 'quarantine'}
              onToggleProbationary={
                folder === 'quarantine' ? () => setProbationary(true) : undefined
              }
              onSelect={onSelect}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              onToggleSelect={(id) =>
                setSelectedIds((s) => {
                  const next = new Set(s);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onSelectAll={() => setSelectedIds(new Set(visibleIds))}
              onClearSelection={() => setSelectedIds(new Set())}
              onBulk={handleBulk}
            />

            <div className="flex-1 min-w-0 bg-zsbg border-l border-zsborder">
              {rightPanel === 'reading' && (
                <ReadingPane
                  messageId={folder === 'drafts' ? null : selectedId}
                  onChanged={refresh}
                  onReply={openReply}
                />
              )}
              {rightPanel === 'whitelist' && activeMailboxId != null && (
                <WhitelistPanel mailboxId={activeMailboxId} onClose={() => setRightPanel('reading')} />
              )}
              {rightPanel === 'inject' && activeMailbox && (
                <InjectorPanel
                  defaultTo={activeMailbox.address}
                  onClose={() => setRightPanel('reading')}
                  onSent={refresh}
                />
              )}
            </div>
          </>
        )}
      </div>

      {showMailboxes && (
        <MailboxManager
          onClose={() => setShowMailboxes(false)}
          onChanged={() => api.mailboxes().then(setMailboxes)}
        />
      )}
      {compose.open && activeMailboxId != null && (
        <ComposePanel
          mailboxes={mailboxes}
          defaultMailboxId={activeMailboxId}
          initial={compose.initial}
          draftId={compose.draftId}
          onClose={() => setCompose({ open: false })}
          onSent={refresh}
          onDraftSaved={refresh}
        />
      )}
      {showDkim && <DkimPanel onClose={() => setShowDkim(false)} />}
      {showAliases && activeMailboxId != null && (
        <AliasManager
          mailboxes={mailboxes}
          defaultMailboxId={activeMailboxId}
          onClose={() => setShowAliases(false)}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
