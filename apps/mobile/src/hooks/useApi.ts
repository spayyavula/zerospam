import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  Attachment,
  Counts,
  FolderName,
  Mailbox,
  MessageDetail,
  MessageSummary,
  MoveFolder,
  ReplyMode,
  ReplyPrefillResponse,
  ScreenerSender,
  SendMessageRequest,
} from '@zerospam/shared-api';
import { apiClient } from '../lib/apiClient';
import { useMailboxStore } from '../stores/mailboxStore';

export const PAGE_SIZE = 50;

/** Everything that shows message state for a mailbox. */
function invalidateMail(qc: QueryClient, mailboxId?: number | null) {
  void qc.invalidateQueries({ queryKey: ['messages'] });
  void qc.invalidateQueries({ queryKey: ['search'] });
  void qc.invalidateQueries({ queryKey: mailboxId != null ? ['counts', mailboxId] : ['counts'] });
}

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

export function usePatchMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, patch }: { mailboxId: number; patch: { screenerSlaHours?: number } }) =>
      apiClient.patch<Mailbox>(`/api/mailboxes/${mailboxId}`, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mailboxes'] }),
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

// ── Messages ─────────────────────────────────────────────────────────────────

export function useMessages(mailboxId: number | null, folder: FolderName) {
  return useInfiniteQuery({
    queryKey: ['messages', mailboxId, folder],
    queryFn: ({ pageParam }) =>
      apiClient.get<MessageSummary[]>(
        `/api/messages?mailboxId=${mailboxId}&folder=${folder}&limit=${PAGE_SIZE}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE),
    enabled: mailboxId != null,
    staleTime: 20_000,
  });
}

export function useMessage(messageId: string | null) {
  return useQuery({
    queryKey: ['message', messageId],
    queryFn: () => apiClient.get<MessageDetail>(`/api/messages/${messageId}`),
    enabled: !!messageId,
    staleTime: 60_000,
  });
}

export function useAttachments(messageId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['attachments', messageId],
    queryFn: () => apiClient.get<Attachment[]>(`/api/messages/${messageId}/attachments`),
    enabled: !!messageId && enabled,
    staleTime: Infinity,
  });
}

export function useRemoteImages() {
  return useMutation({
    mutationFn: (messageId: string) =>
      apiClient.post<{ map: Record<string, string>; expiresInSec: number }>(`/api/messages/${messageId}/remote-images`),
  });
}

export function useSearch(mailboxId: number | null, q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ['search', mailboxId, query],
    queryFn: () =>
      apiClient.get<MessageSummary[]>(`/api/search?mailboxId=${mailboxId}&q=${encodeURIComponent(query)}&limit=100`),
    enabled: mailboxId != null && query.length >= 2,
    staleTime: 15_000,
  });
}

type MessageRef = { id: string; mailboxId: number };

export function useSetRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: MessageRef & { read: boolean }) =>
      apiClient.post(`/api/messages/${id}/read`, { read }),
    onSuccess: (_d, v) => {
      qc.setQueryData<MessageDetail>(['message', v.id], (m) => (m ? { ...m, read: v.read ? 1 : 0 } : m));
      invalidateMail(qc, v.mailboxId);
    },
  });
}

export function useSetStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starred }: MessageRef & { starred: boolean }) =>
      apiClient.post(`/api/messages/${id}/star`, { starred }),
    onSuccess: (_d, v) => {
      qc.setQueryData<MessageDetail>(['message', v.id], (m) => (m ? { ...m, starred: v.starred ? 1 : 0 } : m));
      invalidateMail(qc, v.mailboxId);
    },
  });
}

export function useMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folder }: MessageRef & { folder: MoveFolder }) =>
      apiClient.post(`/api/messages/${id}/move`, { folder }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['message', v.id] });
      invalidateMail(qc, v.mailboxId);
    },
  });
}

export function useDeleteForever() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: MessageRef) => apiClient.delete(`/api/messages/${id}`),
    onSuccess: (_d, v) => {
      qc.removeQueries({ queryKey: ['message', v.id] });
      invalidateMail(qc, v.mailboxId);
    },
  });
}

export function useTrustSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: MessageRef) => apiClient.post(`/api/messages/${id}/trust-sender`),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['message', v.id] });
      invalidateMail(qc, v.mailboxId);
    },
  });
}

export function usePurgeQuarantine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mailboxId: number) =>
      apiClient.post<{ ok: true; purged: number }>(`/api/quarantine/${mailboxId}/purge`),
    onSuccess: (_d, mailboxId) => invalidateMail(qc, mailboxId),
  });
}

// ── Compose ──────────────────────────────────────────────────────────────────

export function fetchReplyPrefill(messageId: string, mode: ReplyMode) {
  return apiClient.get<ReplyPrefillResponse>(`/api/messages/${messageId}/reply?mode=${mode}`);
}

export function useSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendMessageRequest) => apiClient.post<{ messageId?: string }>('/api/send', body),
    onSuccess: (_d, v) => invalidateMail(qc, v.mailboxId),
  });
}

// ── Screener ─────────────────────────────────────────────────────────────────

export function useScreener(mailboxId: number | null) {
  return useQuery({
    queryKey: ['screener', mailboxId],
    queryFn: () => apiClient.get<ScreenerSender[]>(`/api/screener?mailbox_id=${mailboxId}`),
    enabled: mailboxId != null,
    staleTime: 20_000,
  });
}

function onScreenerChange(qc: QueryClient, mailboxId: number) {
  void qc.invalidateQueries({ queryKey: ['screener', mailboxId] });
  invalidateMail(qc, mailboxId);
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
    onSuccess: (_d, { mailboxId }) => onScreenerChange(qc, mailboxId),
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
    onSuccess: (_d, { mailboxId }) => onScreenerChange(qc, mailboxId),
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
    onSuccess: (_d, { mailboxId }) => onScreenerChange(qc, mailboxId),
  });
}
