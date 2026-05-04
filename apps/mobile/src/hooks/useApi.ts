import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Mailbox, ScreenerSender, MessageSummary, MessageDetail, Counts, FolderName } from '@zerospam/shared-api';
import { ApiError } from '@zerospam/shared-api';
import { apiClient } from '../lib/apiClient';
import { useMailboxStore } from '../stores/mailboxStore';

// ── Mailboxes ────────────────────────────────────────────────────────────────

export function useMailboxes() {
  const setMailboxes = useMailboxStore((s) => s.setMailboxes);
  return useQuery({
    queryKey: ['mailboxes'],
    queryFn: async () => {
      const list = await apiClient.get<Mailbox[]>('/api/mailboxes');
      setMailboxes(list);
      return list;
    },
  });
}

// ── Screener ─────────────────────────────────────────────────────────────────

export function useScreener(mailboxId: number | null) {
  return useQuery({
    queryKey: ['screener', mailboxId],
    queryFn: () =>
      apiClient.get<ScreenerSender[]>(`/api/screener?mailbox_id=${mailboxId}`),
    enabled: mailboxId != null,
    staleTime: 20_000,
  });
}

export function useScreenerAllow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, senderAddress }: { mailboxId: number; senderAddress: string }) =>
      apiClient.post<{
        moved: number;
        rule_id: number;
        sender_address: string;
        domain: string;
        suggest_domain_expand: boolean;
      }>('/api/screener/allow', { mailbox_id: mailboxId, sender_address: senderAddress }),
    onSuccess: (_data, { mailboxId }) => {
      void qc.invalidateQueries({ queryKey: ['screener', mailboxId] });
    },
  });
}

export function useScreenerReject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, senderAddress }: { mailboxId: number; senderAddress: string }) =>
      apiClient.post<{ trashed: number }>('/api/screener/reject', {
        mailbox_id: mailboxId,
        sender_address: senderAddress,
      }),
    onSuccess: (_data, { mailboxId }) => {
      void qc.invalidateQueries({ queryKey: ['screener', mailboxId] });
    },
  });
}

export function useScreenerAllowDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, domain }: { mailboxId: number; domain: string }) =>
      apiClient.post<{ moved: number; rule_id: number }>('/api/screener/allow-domain', {
        mailbox_id: mailboxId,
        domain,
      }),
    onSuccess: (_data, { mailboxId }) => {
      void qc.invalidateQueries({ queryKey: ['screener', mailboxId] });
    },
  });
}

export { ApiError };

// ── Mailbox mutations ─────────────────────────────────────────────────────────

export function usePatchMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, patch }: { mailboxId: number; patch: { screenerSlaHours?: number } }) =>
      apiClient.patch<Mailbox>(`/api/mailboxes/${mailboxId}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mailboxes'] });
    },
  });
}

// ── Folder messages ───────────────────────────────────────────────────────────

export function useMessages(mailboxId: number | null, folder: FolderName, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['messages', mailboxId, folder, limit, offset],
    queryFn: () =>
      apiClient.get<MessageSummary[]>(
        `/api/messages?mailboxId=${mailboxId}&folder=${folder}&limit=${limit}&offset=${offset}`,
      ),
    enabled: mailboxId != null,
    staleTime: 30_000,
  });
}

export function useMessage(messageId: string | null) {
  return useQuery({
    queryKey: ['message', messageId],
    queryFn: () => apiClient.get<MessageDetail>(`/api/messages/${messageId}`),
    enabled: messageId != null,
    staleTime: 60_000,
  });
}

export function useCounts(mailboxId: number | null) {
  return useQuery({
    queryKey: ['counts', mailboxId],
    queryFn: () => apiClient.get<Counts>(`/api/mailboxes/${mailboxId}/counts`),
    enabled: mailboxId != null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
