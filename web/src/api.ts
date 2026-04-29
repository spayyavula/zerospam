import type {
  Alias,
  Attachment,
  BulkAction,
  ComposeInitial,
  Counts,
  Draft,
  FolderName,
  Mailbox,
  MessageDetail,
  MessageSummary,
  ReplyMode,
  TrackerReport,
  WhitelistRule,
} from './types';

async function j<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export const api = {
  // mailboxes
  mailboxes: () => j<Mailbox[]>('/api/mailboxes'),
  createMailbox: (b: { address: string; displayName?: string; quarantineTtlHours?: number }) =>
    j<{ id: number }>('/api/mailboxes', { method: 'POST', body: JSON.stringify(b) }),
  patchMailbox: (id: number, b: { displayName?: string | null; quarantineTtlHours?: number }) =>
    j<{ ok: true }>(`/api/mailboxes/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteMailbox: (id: number) =>
    j<{ ok: true }>(`/api/mailboxes/${id}`, { method: 'DELETE' }),
  counts: (mailboxId: number) => j<Counts>(`/api/mailboxes/${mailboxId}/counts`),

  // messages
  list: (mailboxId: number, folder: FolderName) =>
    j<MessageSummary[]>(`/api/messages?mailboxId=${mailboxId}&folder=${folder}`),
  get: (id: string) => j<MessageDetail>(`/api/messages/${id}`),
  search: (mailboxId: number, q: string, folder?: FolderName) => {
    const params = new URLSearchParams({ mailboxId: String(mailboxId), q });
    if (folder) params.set('folder', folder);
    return j<MessageSummary[]>(`/api/search?${params.toString()}`);
  },
  setRead: (id: string, read: boolean) =>
    j<{ ok: true }>(`/api/messages/${id}/read`, {
      method: 'POST',
      body: JSON.stringify({ read }),
    }),
  setStarred: (id: string, starred: boolean) =>
    j<{ ok: true }>(`/api/messages/${id}/star`, {
      method: 'POST',
      body: JSON.stringify({ starred }),
    }),
  move: (id: string, folder: 'inbox' | 'quarantine' | 'trash') =>
    j<{ ok: true }>(`/api/messages/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ folder }),
    }),
  trustSender: (id: string) =>
    j<{ ok: true }>(`/api/messages/${id}/trust-sender`, { method: 'POST' }),
  remove: (id: string) => j<{ ok: true }>(`/api/messages/${id}`, { method: 'DELETE' }),
  bulk: (ids: string[], action: BulkAction) =>
    j<{ ok: true; affected: number }>(`/api/messages/bulk`, {
      method: 'POST',
      body: JSON.stringify({ ids, action }),
    }),
  purgeQuarantine: (mailboxId: number) =>
    j<{ ok: true; purged: number }>(`/api/quarantine/${mailboxId}/purge`, { method: 'POST' }),

  // attachments
  attachments: (messageId: string) =>
    j<Attachment[]>(`/api/messages/${messageId}/attachments`),
  attachmentDownloadUrl: (id: number) => `/api/attachments/${id}/download`,

  // trackers + image proxy
  trackers: (messageId: string) => j<TrackerReport>(`/api/messages/${messageId}/trackers`),
  proxyImageUrl: (url: string) => `/api/proxy/image?url=${encodeURIComponent(url)}`,

  // aliases
  listAliases: (mailboxId: number) => j<Alias[]>(`/api/aliases?mailboxId=${mailboxId}`),
  createAlias: (b: {
    mailboxId: number;
    label?: string;
    localPart?: string;
    expiresInDays?: number | null;
  }) =>
    j<{ id: number; address: string; expires_at: number | null }>(`/api/aliases`, {
      method: 'POST',
      body: JSON.stringify(b),
    }),
  abuseAlias: (id: number) =>
    j<{ ok: true }>(`/api/aliases/${id}/abuse`, { method: 'POST' }),
  restoreAlias: (id: number) =>
    j<{ ok: true }>(`/api/aliases/${id}/restore`, { method: 'POST' }),
  deleteAlias: (id: number) => j<{ ok: true }>(`/api/aliases/${id}`, { method: 'DELETE' }),

  // whitelist
  whitelist: (mailboxId: number) =>
    j<WhitelistRule[]>(`/api/whitelist?mailboxId=${mailboxId}`),
  addRule: (rule: { mailboxId: number; kind: 'address' | 'domain' | 'regex'; pattern: string; note?: string }) =>
    j<{ id: number }>(`/api/whitelist`, { method: 'POST', body: JSON.stringify(rule) }),
  removeRule: (id: number) =>
    j<{ ok: true }>(`/api/whitelist/${id}`, { method: 'DELETE' }),

  // send (Phase 2)
  send: (body: {
    mailboxId: number;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    inReplyTo?: string | null;
    references?: string | null;
  }) =>
    j<{ messageId: string; recipients: string[]; signed: boolean; whitelistAdded: number }>(
      `/api/send`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // reply prefill
  replyPrefill: (id: string, mode: ReplyMode) =>
    j<ComposeInitial & { mode: ReplyMode }>(`/api/messages/${id}/reply?mode=${mode}`),

  // drafts
  listDrafts: (mailboxId: number) => j<Draft[]>(`/api/drafts?mailboxId=${mailboxId}`),
  getDraft: (id: string) => j<Draft>(`/api/drafts/${id}`),
  createDraft: (b: {
    mailboxId: number;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    text?: string;
    html?: string;
    inReplyTo?: string | null;
    references?: string | null;
    replyToMessageId?: string | null;
  }) => j<{ id: string }>(`/api/drafts`, { method: 'POST', body: JSON.stringify(b) }),
  patchDraft: (
    id: string,
    b: {
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      text?: string;
      html?: string;
    },
  ) => j<{ ok: true }>(`/api/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteDraft: (id: string) => j<{ ok: true }>(`/api/drafts/${id}`, { method: 'DELETE' }),
  sendDraft: (id: string) =>
    j<{ messageId: string; recipients: string[]; signed: boolean; whitelistAdded: number }>(
      `/api/drafts/${id}/send`,
      { method: 'POST' },
    ),

  // domains / DKIM
  domains: () =>
    j<Array<{ id: number; name: string; created_at: number; dkim_selector: string | null; dkim_public_pem: string | null }>>(
      '/api/domains',
    ),
  domainDns: (id: number) =>
    j<{ host: string; type: 'TXT'; value: string; copyPaste: string }>(`/api/domains/${id}/dns`),

  // dev: simulate inbound
  inject: (body: { to: string; from: string; fromName?: string; subject: string; text: string }) =>
    j(`/api/inject`, { method: 'POST', body: JSON.stringify(body) }),
};

export function subscribeEvents(onEvent: (e: any) => void): () => void {
  const es = new EventSource('/api/events');
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {
      // ignore
    }
  };
  return () => es.close();
}
