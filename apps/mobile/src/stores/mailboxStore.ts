import { create } from 'zustand';
import type { Mailbox } from '@zerospam/shared-api';

type MailboxState = {
  mailboxes: Mailbox[];
  activeMailboxId: number | null;
  setMailboxes: (list: Mailbox[]) => void;
  setActiveMailboxId: (id: number) => void;
};

export const useMailboxStore = create<MailboxState>((set) => ({
  mailboxes: [],
  activeMailboxId: null,
  setMailboxes: (list) =>
    set((s) => ({
      mailboxes: list,
      // Keep the active selection if it's still valid; otherwise pick the first.
      activeMailboxId:
        s.activeMailboxId != null && list.some((m) => m.id === s.activeMailboxId)
          ? s.activeMailboxId
          : list[0]?.id ?? null,
    })),
  setActiveMailboxId: (id) => set({ activeMailboxId: id }),
}));
