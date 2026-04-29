import { X } from 'lucide-react';

const ROWS: Array<[string, string]> = [
  ['j / k', 'next / previous message'],
  ['Enter', 'open selected'],
  ['s', 'star / unstar'],
  ['t', 'trust sender (whitelist + move to inbox)'],
  ['u', 'mark read / unread'],
  ['e', 'move to trash'],
  ['# / Del', 'delete forever (in trash)'],
  ['x', 'toggle bulk-select for current message'],
  ['Shift+A', 'select all in list'],
  ['Esc', 'clear selection / close panel'],
  ['/', 'focus search'],
  ['?', 'show this help'],
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-zsbg/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zspanel border border-zsborder rounded-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-12 px-4 border-b border-zsborder flex items-center">
          <div className="font-medium">Keyboard shortcuts</div>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
            <X className="w-4 h-4" />
          </button>
        </header>
        <ul className="p-3 space-y-1">
          {ROWS.map(([k, v]) => (
            <li key={k} className="flex items-center gap-3 text-sm py-0.5">
              <kbd className="text-xs px-1.5 py-0.5 rounded bg-zsbg border border-zsborder font-mono w-24 text-center">
                {k}
              </kbd>
              <span className="text-zstext">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
