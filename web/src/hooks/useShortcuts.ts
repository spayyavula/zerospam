import { useEffect } from 'react';

export type ShortcutHandlers = {
  onNext: () => void;
  onPrev: () => void;
  onOpen: () => void;
  onStar: () => void;
  onTrust: () => void;
  onToggleRead: () => void;
  onTrash: () => void;
  onDelete: () => void;
  onSearch: () => void;
  onHelp: () => void;
  onToggleSelect: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
};

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((t as HTMLElement).isContentEditable) return true;
  return false;
}

export function useShortcuts(h: Partial<ShortcutHandlers>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e) && e.key !== 'Escape' && e.key !== '/') return;

      switch (e.key) {
        case 'j':
          h.onNext?.();
          e.preventDefault();
          break;
        case 'k':
          h.onPrev?.();
          e.preventDefault();
          break;
        case 'Enter':
          h.onOpen?.();
          break;
        case 's':
          h.onStar?.();
          e.preventDefault();
          break;
        case 't':
          h.onTrust?.();
          e.preventDefault();
          break;
        case 'u':
          h.onToggleRead?.();
          e.preventDefault();
          break;
        case 'e':
          h.onTrash?.();
          e.preventDefault();
          break;
        case '#':
        case 'Delete':
        case 'Backspace':
          if (!isTyping(e)) {
            h.onDelete?.();
            e.preventDefault();
          }
          break;
        case '/':
          if (!isTyping(e)) {
            h.onSearch?.();
            e.preventDefault();
          }
          break;
        case '?':
          h.onHelp?.();
          e.preventDefault();
          break;
        case 'x':
          h.onToggleSelect?.();
          e.preventDefault();
          break;
        case 'a':
          if (e.shiftKey) {
            h.onSelectAll?.();
            e.preventDefault();
          }
          break;
        case 'Escape':
          h.onEscape?.();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    h.onNext,
    h.onPrev,
    h.onOpen,
    h.onStar,
    h.onTrust,
    h.onToggleRead,
    h.onTrash,
    h.onDelete,
    h.onSearch,
    h.onHelp,
    h.onToggleSelect,
    h.onSelectAll,
    h.onEscape,
  ]);
}
