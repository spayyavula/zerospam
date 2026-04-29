import { useEffect, useRef } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  Star,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Search,
  X,
  Paperclip,
  Inbox as InboxIcon,
  Trash2,
  UserPlus,
  CheckSquare,
  Square,
  Mail,
  MailOpen,
} from 'lucide-react';
import type { BulkAction, FolderName, MessageSummary } from '../types';
import { senderRisk } from '../utils/sender';

export type ListFilter = 'all' | 'unread' | 'starred' | 'attachments';

type Props = {
  messages: MessageSummary[];
  folder: FolderName | 'drafts';
  selectedId: string | null;
  searchQuery: string;
  searchActive: boolean;
  searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
  selectedIds: Set<string>;
  filter: ListFilter;
  onFilterChange: (f: ListFilter) => void;
  probationaryAvailable?: boolean;
  onToggleProbationary?: () => void;
  onSelect: (id: string) => void;
  onSearchChange: (q: string) => void;
  onClearSearch: () => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulk: (action: BulkAction) => void;
};

function ttlBadge(expiresAt: number | null): string | null {
  if (!expiresAt) return null;
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m left`;
  if (hours < 48) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export default function MessageList({
  messages,
  folder,
  selectedId,
  searchQuery,
  searchActive,
  searchInputRef,
  selectedIds,
  filter,
  onFilterChange,
  probationaryAvailable,
  onToggleProbationary,
  onSelect,
  onSearchChange,
  onClearSearch,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulk,
}: Props) {
  // scroll the active row into view when navigated via keyboard
  const activeRowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const filtered = messages.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !m.read;
    if (filter === 'starred') return !!m.starred;
    if (filter === 'attachments') return m.attachment_count > 0;
    return true;
  });

  const bulkMode = selectedIds.size > 0;
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <section className="w-96 border-r border-zsborder bg-zspanel/60 flex flex-col">
      <div className="h-12 px-3 border-b border-zsborder flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-zsmuted" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search ( / )"
            className="w-full pl-7 pr-7 py-1.5 text-sm bg-zsbg border border-zsborder rounded focus:outline-none focus:border-zsaccent"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-zsmuted hover:text-zstext"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="h-9 px-3 border-b border-zsborder flex items-center gap-2 text-xs">
        <button
          onClick={allSelected ? onClearSelection : onSelectAll}
          className="p-1 hover:bg-zsborder/40 rounded text-zsmuted"
          title={allSelected ? 'Clear selection' : 'Select all'}
        >
          {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
        {!bulkMode && (
          <>
            <span className="capitalize text-zsmuted">{searchActive ? 'Search results' : folder}</span>
            <div className="flex items-center gap-1 ml-2">
              <FilterPill label="All" active={filter === 'all'} onClick={() => onFilterChange('all')} />
              <FilterPill label="Unread" active={filter === 'unread'} onClick={() => onFilterChange('unread')} />
              <FilterPill label="Starred" active={filter === 'starred'} onClick={() => onFilterChange('starred')} />
              <FilterPill label="Files" active={filter === 'attachments'} onClick={() => onFilterChange('attachments')} />
            </div>
            {probationaryAvailable && onToggleProbationary && messages.length > 0 && (
              <button
                onClick={onToggleProbationary}
                className="ml-2 px-2 py-0.5 rounded-full text-[11px] bg-zsdanger/15 text-zsdanger hover:bg-zsdanger/25"
                title="Triage with thumbnail-wall view"
              >
                Probationary view
              </button>
            )}
            <span className="ml-auto text-zsmuted">
              {filtered.length}
              {filter !== 'all' && messages.length !== filtered.length && (
                <span className="ml-1">/ {messages.length}</span>
              )}
            </span>
          </>
        )}
        {bulkMode && (
          <BulkBar
            count={selectedIds.size}
            folder={folder}
            onBulk={onBulk}
            onClear={onClearSelection}
          />
        )}
      </div>

      <ul className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="p-6 text-center text-zsmuted text-sm">
            {searchActive
              ? 'No matches.'
              : filter !== 'all'
                ? `No ${filter} messages in ${folder}.`
                : folder === 'inbox'
                  ? 'Inbox is silent. Only whitelisted senders land here.'
                  : folder === 'quarantine'
                    ? 'Quarantine is empty. Anything not whitelisted lands here, then auto-deletes.'
                    : folder === 'sent'
                      ? 'No sent mail yet.'
                      : folder === 'drafts'
                        ? 'No drafts.'
                        : 'Trash is empty.'}
          </li>
        )}

        {filtered.map((m) => {
          const isSelected = m.id === selectedId;
          const inSelection = selectedIds.has(m.id);
          const ttl = ttlBadge(m.expires_at);
          const risk = senderRisk(m.from_name, m.from_address);

          return (
            <li
              key={m.id}
              ref={isSelected ? activeRowRef : null}
              onClick={() => onSelect(m.id)}
              className={`px-3 py-2.5 border-b border-zsborder/60 cursor-pointer fade-in flex items-start gap-2
                ${isSelected ? 'bg-zsaccent/10' : 'hover:bg-zsborder/30'}
                ${inSelection ? 'bg-zsaccent/5' : ''}`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(m.id);
                }}
                className="mt-1 p-0.5 text-zsmuted hover:text-zstext"
                title="Select for bulk actions (x)"
              >
                {inSelection ? <CheckSquare className="w-3.5 h-3.5 text-zsaccent" /> : <Square className="w-3.5 h-3.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm truncate ${m.read ? 'text-zsmuted' : 'text-zstext font-semibold'}`}>
                    {m.from_name || m.from_address}
                  </span>
                  {m.starred ? <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" /> : null}
                  {m.whitelist_match && <ShieldCheck className="w-3.5 h-3.5 text-zsok shrink-0" />}
                  {risk && <ShieldAlert className="w-3.5 h-3.5 text-zsdanger shrink-0" aria-label={risk} />}
                  {m.attachment_count > 0 && <Paperclip className="w-3.5 h-3.5 text-zsmuted shrink-0" />}
                  <span className="ml-auto text-xs text-zsmuted shrink-0">
                    {formatDistanceToNowStrict(new Date(m.received_at), { addSuffix: false })}
                  </span>
                </div>
                <div className={`text-sm truncate mt-0.5 ${m.read ? 'text-zsmuted' : 'text-zstext'}`}>
                  {m.subject || '(no subject)'}
                </div>
                <div className="text-xs text-zsmuted truncate mt-0.5">{m.preview}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  {searchActive && (
                    <span className="px-1.5 py-0.5 rounded bg-zsborder/40 text-zsmuted capitalize">{m.folder}</span>
                  )}
                  {ttl && (
                    <span className="inline-flex items-center gap-1 text-zsdanger">
                      <Clock className="w-3 h-3" />
                      {ttl}
                    </span>
                  )}
                  {risk && (
                    <span className="inline-flex items-center gap-1 text-zsdanger truncate" title={risk}>
                      <ShieldAlert className="w-3 h-3" />
                      sender mismatch
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full text-[11px] ${
        active
          ? 'bg-zsaccent text-zsbg font-medium'
          : 'bg-zsborder/40 text-zsmuted hover:bg-zsborder/60'
      }`}
    >
      {label}
    </button>
  );
}

function BulkBar({
  count,
  folder,
  onBulk,
  onClear,
}: {
  count: number;
  folder: FolderName | 'drafts';
  onBulk: (a: BulkAction) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-1">
      <span className="text-zsaccent font-medium">{count} selected</span>
      <div className="flex-1" />
      <BulkBtn icon={<MailOpen className="w-3.5 h-3.5" />} title="Mark read" onClick={() => onBulk('mark-read')} />
      <BulkBtn icon={<Mail className="w-3.5 h-3.5" />} title="Mark unread" onClick={() => onBulk('mark-unread')} />
      {folder === 'quarantine' && (
        <BulkBtn icon={<UserPlus className="w-3.5 h-3.5 text-zsok" />} title="Trust senders + Inbox" onClick={() => onBulk('trust-sender')} />
      )}
      {folder !== 'inbox' && folder !== 'sent' && (
        <BulkBtn icon={<InboxIcon className="w-3.5 h-3.5" />} title="Move to Inbox" onClick={() => onBulk('move-inbox')} />
      )}
      {folder !== 'trash' && (
        <BulkBtn icon={<Trash2 className="w-3.5 h-3.5" />} title="Move to Trash" onClick={() => onBulk('move-trash')} />
      )}
      {folder === 'trash' && (
        <BulkBtn icon={<Trash2 className="w-3.5 h-3.5 text-zsdanger" />} title="Delete forever" onClick={() => onBulk('delete')} />
      )}
      <button onClick={onClear} className="ml-1 p-1 hover:bg-zsborder/40 rounded text-zsmuted" title="Clear selection (Esc)">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BulkBtn({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={title} className="p-1 rounded hover:bg-zsborder/40">
      {icon}
    </button>
  );
}
