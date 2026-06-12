import { useState } from 'react';
import { ChevronDown, PenLine } from 'lucide-react';
import type { Counts, SidebarFolder } from '../types';

const PRIMARY: { key: SidebarFolder; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'screener', label: 'Screener' },
  { key: 'sent', label: 'Sent' },
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

export default function Sidebar(p: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const screenerCount = p.counts?.screener?.total ?? 0; // Counts.screener is { total, unread }

  const moreItems: [string, () => void][] = [
    ['Quarantine', () => p.onFolder('quarantine')],
    ['Drafts', () => p.onFolder('drafts')],
    ['Trash', () => p.onFolder('trash')],
    ['Whitelist', p.onWhitelist],
    ['Aliases', p.onAliases],
    ['DKIM / DNS', p.onDkim],
    ['Test injector', p.onInject],
    ['Purge quarantine', p.onPurge],
  ];

  return (
    <nav className="flex items-center gap-6 px-6 h-14 bg-paper border-b-2 border-rule-strong text-ink shrink-0">
      <span className="font-display font-bold tracking-tight select-none">Zero·Spam</span>

      <div className="flex items-center gap-5 font-mono text-[11px] tracking-[0.12em] uppercase">
        {PRIMARY.map(({ key, label }) => {
          const active = p.folder === key;
          return (
            <button
              key={key}
              onClick={() => p.onFolder(key)}
              data-tour={key === 'screener' ? 'sidebar-screener' : undefined}
              aria-current={active ? 'page' : undefined}
              className={active ? 'text-ink border-b-2 border-ink pb-0.5' : 'text-quiet hover:text-ink transition-colors'}
            >
              {label}
              {key === 'screener' && screenerCount > 0 && (
                <span className="ml-1.5 bg-signal text-signal-ink rounded-full px-1.5 py-px text-[10px] align-middle">
                  {screenerCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        onClick={p.onCompose}
        className="font-mono text-[11px] tracking-[0.1em] uppercase bg-signal text-signal-ink border-2 border-rule-strong px-3 py-1.5 inline-flex items-center gap-1 hover:brightness-95"
      >
        <PenLine className="w-3.5 h-3.5" /> Compose
      </button>

      <div className="relative">
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-haspopup="menu"
          className="font-mono text-[11px] tracking-[0.1em] uppercase text-quiet hover:text-ink inline-flex items-center gap-1"
        >
          More <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {moreOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 bg-paper border-2 border-rule-strong min-w-[180px] z-30 text-sm shadow-[4px_4px_0_rgba(0,0,0,0.08)]"
          >
            {moreItems.map(([label, fn]) => (
              <button
                key={label}
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  fn();
                }}
                className="block w-full text-left px-3 py-2 hover:bg-paper-deep text-ink"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
