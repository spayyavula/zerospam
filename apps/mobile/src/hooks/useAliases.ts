import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Alias, AliasMode, AliasUsage, CreateForwardTargetResponse, ForwardTarget, PatchAliasRequest } from '@zerospam/shared-api';
import { apiClient } from '../lib/apiClient';

function refreshAliases(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['aliases'] });
  void qc.invalidateQueries({ queryKey: ['aliasUsage'] });
}

export function useAliases(mailboxId: number | null) {
  return useQuery({
    queryKey: ['aliases', mailboxId],
    queryFn: () => apiClient.get<Alias[]>(`/api/aliases?mailboxId=${mailboxId}`),
    enabled: mailboxId != null,
  });
}

export function useAliasUsage() {
  return useQuery({ queryKey: ['aliasUsage'], queryFn: () => apiClient.get<AliasUsage>('/api/aliases/usage') });
}

export type NewAlias = {
  mailboxId: number;
  label?: string;
  localPart?: string;
  expiresInDays?: number | null;
  mode?: AliasMode;
  forwardTargetId?: number | null;
};

export function useCreateAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewAlias) => apiClient.post<{ id: number; address: string }>('/api/aliases', body),
    onSuccess: () => refreshAliases(qc),
  });
}

export function usePatchAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: PatchAliasRequest }) => apiClient.patch<Alias>(`/api/aliases/${id}`, patch),
    onSuccess: () => refreshAliases(qc),
  });
}

/** Blocked aliases refuse all future mail and replies; restoring re-enables them. */
export function useSetAliasBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blocked }: { id: number; blocked: boolean }) =>
      apiClient.post(`/api/aliases/${id}/${blocked ? 'abuse' : 'restore'}`),
    onSuccess: () => refreshAliases(qc),
  });
}

export function useDeleteAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/aliases/${id}`),
    onSuccess: () => refreshAliases(qc),
  });
}

// ── Forwarding addresses ─────────────────────────────────────────────────────

export function useForwardTargets() {
  return useQuery({ queryKey: ['forwardTargets'], queryFn: () => apiClient.get<ForwardTarget[]>('/api/forward-targets') });
}

export function useAddForwardTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => apiClient.post<CreateForwardTargetResponse>('/api/forward-targets', { email }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['forwardTargets'] }),
  });
}

export function useResendForwardTarget() {
  return useMutation({ mutationFn: (id: number) => apiClient.post(`/api/forward-targets/${id}/resend`) });
}

export function useDeleteForwardTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/forward-targets/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['forwardTargets'] });
      refreshAliases(qc);
    },
  });
}

export const MODE_LABEL: Record<AliasMode, { title: string; hint: string }> = {
  store: { title: 'Keep in ZeroSpam', hint: 'Deliver to this mailbox only.' },
  forward: { title: 'Forward only', hint: 'Relay trusted mail to your real inbox; keep nothing here.' },
  both: { title: 'Keep and forward', hint: 'Deliver here and relay trusted mail to your real inbox.' },
};
