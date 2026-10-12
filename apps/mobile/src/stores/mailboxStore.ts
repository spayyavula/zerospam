import { create } from 'zustand';
import type { Mailbox } from '@zerospam/shared-api';
import { getPref, setPref } from '../lib/prefs';

/** Folders reachable from the Mail tab (Quarantine has its own tab). */
export type MailFolder = 'inbox' | 'sent' | 'trash';

export const FOLDER_LABEL: Record<MailFolder, string> = { inbox: 'Inbox', sent: 'Sent', trash: 'Trash' };

type MailboxState = {
  mailboxes: Mailbox[];
  activeMailboxId: number | null;
  folder: MailFolder;
  setMailboxes: (list: Mailbox[]) => void;
  setActiveMailboxId: (id: number) => void;
  setFolder: (f: MailFolder) => void;
};

let remembered: number | null = null;
void getPref('mailbox').then((v) => {
  const n = Number(v);
  if (Number.isInteger(n) && n > 0) remembered = n;
});

export const useMailboxStore = create<MailboxState>((set) => ({
  mailboxes: [],
  activeMailboxId: null,
  folder: 'inbox',
  setMailboxes: (list) =>
    set((s) => {
      const valid = (id: number | null) => id != null && list.some((m) => m.id === id);
      const activeMailboxId = valid(s.activeMailboxId)
        ? s.activeMailboxId
        : valid(remembered)
          ? remembered
          : list[0]?.id ?? null;
      return { mailboxes: list, activeMailboxId };
    }),
  setActiveMailboxId: (id) => {
    remembered = id;
    void setPref('mailbox', String(id));
    set({ activeMailboxId: id });
  },
  setFolder: (folder) => set({ folder }),
}));

export function useActiveMailbox(): Mailbox | null {
  return useMailboxStore((s) => s.mailboxes.find((m) => m.id === s.activeMailboxId) ?? null);
}
