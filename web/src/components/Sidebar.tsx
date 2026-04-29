import {
  Inbox,
  ShieldAlert,
  Send,
  Trash2,
  ListChecks,
  Beaker,
  Flame,
  PenLine,
  Key,
  FileText,
  Tag,
} from 'lucide-react';
import type { Counts, SidebarFolder } from '../types';

const folders: { key: SidebarFolder; label: string; icon: any }[] = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'quarantine', label: 'Quarantine', icon: ShieldAlert },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'drafts', label: 'Drafts', icon: FileText },
  { key: 'trash', label: 'Trash', icon: Trash2 },
];

type Props = {
  counts: Counts | null;
  folder: SidebarFolder;
  onFolder: (f: SidebarFolder) => void;
  onCompose: () => void;
  onWhitelist: () => void;
  onInject: () => void;
  onPurge: () => void;
  onDkim: () => void;
  onAliases: () => void;
};

export default function Sidebar({
  counts,
  folder,
  onFolder,
  onCompose,
  onWhitelist,
  onInject,
  onPurge,
  onDkim,
  onAliases,
}: Props) {
  return (
    <aside className="w-56 border-r border-zsborder bg-zspanel flex flex-col">
      <div className="p-3">
        <button
          onClick={onCompose}
          className="w-full inline-flex items-center justify-center gap-2 bg-zsaccent text-zsbg font-medium rounded py-2 text-sm hover:opacity-90"
        >
          <PenLine className="w-4 h-4" />
          Compose
        </button>
      </div>

      <div className="px-3 py-1 text-xs uppercase tracking-wider text-zsmuted">Folders</div>
      <nav className="flex-1 px-2 space-y-0.5">
        {folders.map((f) => {
          const Icon = f.icon;
          const c = counts?.[f.key];
          const active = f.key === folder;
          return (
            <button
              key={f.key}
              onClick={() => onFolder(f.key)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm
                ${active ? 'bg-zsaccent/10 text-zsaccent' : 'hover:bg-zsborder/40 text-zstext'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{f.label}</span>
              {c && c.unread > 0 && (
                <span className="text-xs px-1.5 rounded bg-zsaccent text-zsbg font-semibold">
                  {c.unread}
                </span>
              )}
              {c && c.unread === 0 && c.total > 0 && (
                <span className="text-xs text-zsmuted">{c.total}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-2 text-xs uppercase tracking-wider text-zsmuted">Tools</div>
      <div className="px-2 pb-3 space-y-0.5">
        <SidebarBtn icon={ListChecks} label="Whitelist" onClick={onWhitelist} />
        <SidebarBtn icon={Tag} label="Aliases" onClick={onAliases} />
        <SidebarBtn icon={Beaker} label="Test Injector" onClick={onInject} />
        <SidebarBtn icon={Key} label="DKIM / DNS" onClick={onDkim} />
        <SidebarBtn icon={Flame} label="Purge Quarantine" onClick={onPurge} danger />
      </div>
    </aside>
  );
}

function SidebarBtn({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
        danger ? 'text-zsdanger hover:bg-zsdanger/10' : 'hover:bg-zsborder/40'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
