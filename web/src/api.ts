import type {
  Alias,
  Attachment,
  AddWhitelistRuleResponse,
  AddWhitelistRuleRequest,
  ApiClient,
  AuthMe,
  BulkMessagesResponse,
  BulkAction,
  ChangePasswordRequest,
  ComposeInitial,
  Counts,
  CreateAliasRequest,
  CreateAliasResponse,
  CreateDraftRequest,
  CreateDraftResponse,
  CreateMailboxRequest,
  CreateMailboxResponse,
  Draft,
  DomainDnsResponse,
  DomainSummary,
  FolderName,
  InjectRequest,
  LoginRequest,
  LoginResponse,
  Mailbox,
  MessageDetail,
  MessageSummary,
  MoveFolder,
  OkResponse,
  PatchDraftRequest,
  PatchMailboxRequest,
  ReplyMode,
  ReplyPrefillResponse,
  ScreenerAllowDomainResponse,
  ScreenerAllowResponse,
  ScreenerRejectResponse,
  ScreenerSender,
  SendMessageRequest,
  SendMessageResponse,
  SetReadRequest,
  SetStarredRequest,
  SignupRequest,
  SignupResponse,
  TotpConfirmRequest,
  TotpDisableRequest,
  TotpSetupResponse,
  TrackerReport,
  WhitelistRule,
} from '@zerospam/shared-api';
import { ApiError, createApiClient } from '@zerospam/shared-api';
import type { Connection } from './types';

const client: ApiClient = createApiClient({
  credentials: 'include',
  fetch: (input, init) => globalThis.fetch(input, init),
});

function handle<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error) => {
    if (error instanceof ApiError && error.status === 401) {
      throw Object.assign(new Error('unauthorized'), { status: 401, data: error.data });
    }
    throw error;
  });
}

export const api = {
  // mailboxes
  mailboxes: () => handle(client.get<Mailbox[]>('/api/mailboxes')),
  createMailbox: (b: CreateMailboxRequest) =>
    handle(client.post<CreateMailboxResponse>('/api/mailboxes', b)),
  patchMailbox: (id: number, b: PatchMailboxRequest) =>
    handle(client.patch<OkResponse>(`/api/mailboxes/${id}`, b)),
  deleteMailbox: (id: number) =>
    handle(client.delete<OkResponse>(`/api/mailboxes/${id}`)),
  counts: (mailboxId: number) => handle(client.get<Counts>(`/api/mailboxes/${mailboxId}/counts`)),

  // screener
  screenerList: (mailboxId: number) =>
    handle(client.get<ScreenerSender[]>(`/api/screener?mailbox_id=${mailboxId}`)),
  screenerAllow: (mailboxId: number, senderAddress: string) =>
    handle(client.post<ScreenerAllowResponse>(`/api/screener/allow`, {
      mailbox_id: mailboxId,
      sender_address: senderAddress,
    })),
  screenerAllowDomain: (mailboxId: number, domain: string) =>
    handle(client.post<ScreenerAllowDomainResponse>(`/api/screener/allow-domain`, {
      mailbox_id: mailboxId,
      domain,
    })),
  screenerReject: (mailboxId: number, senderAddress: string) =>
    handle(client.post<ScreenerRejectResponse>(`/api/screener/reject`, {
      mailbox_id: mailboxId,
      sender_address: senderAddress,
    })),

  // messages
  list: (mailboxId: number, folder: FolderName) =>
    handle(client.get<MessageSummary[]>(`/api/messages?mailboxId=${mailboxId}&folder=${folder}`)),
  get: (id: string) => handle(client.get<MessageDetail>(`/api/messages/${id}`)),
  search: (mailboxId: number, q: string, folder?: FolderName) => {
    const params = new URLSearchParams({ mailboxId: String(mailboxId), q });
    if (folder) params.set('folder', folder);
    return handle(client.get<MessageSummary[]>(`/api/search?${params.toString()}`));
  },
  setRead: (id: string, read: boolean) =>
    handle(client.post<OkResponse>(`/api/messages/${id}/read`, { read } satisfies SetReadRequest)),
  setStarred: (id: string, starred: boolean) =>
    handle(client.post<OkResponse>(`/api/messages/${id}/star`, { starred } satisfies SetStarredRequest)),
  move: (id: string, folder: MoveFolder) =>
    handle(client.post<OkResponse>(`/api/messages/${id}/move`, { folder })),
  trustSender: (id: string) =>
    handle(client.post<OkResponse>(`/api/messages/${id}/trust-sender`)),
  remove: (id: string) => handle(client.delete<OkResponse>(`/api/messages/${id}`)),
  bulk: (ids: string[], action: BulkAction) =>
    handle(client.post<BulkMessagesResponse>(`/api/messages/bulk`, { ids, action })),
  purgeQuarantine: (mailboxId: number) =>
    handle(client.post<{ ok: true; purged: number }>(`/api/quarantine/${mailboxId}/purge`)),

  // attachments
  attachments: (messageId: string) =>
    handle(client.get<Attachment[]>(`/api/messages/${messageId}/attachments`)),
  attachmentDownloadUrl: (id: number) => `/api/attachments/${id}/download`,

  // trackers + image proxy
  trackers: (messageId: string) => handle(client.get<TrackerReport>(`/api/messages/${messageId}/trackers`)),
  proxyImageUrl: (url: string) => `/api/proxy/image?url=${encodeURIComponent(url)}`,

  // aliases
  listAliases: (mailboxId: number) => handle(client.get<Alias[]>(`/api/aliases?mailboxId=${mailboxId}`)),
  createAlias: (b: CreateAliasRequest) =>
    handle(client.post<CreateAliasResponse>(`/api/aliases`, b)),
  abuseAlias: (id: number) =>
    handle(client.post<OkResponse>(`/api/aliases/${id}/abuse`)),
  restoreAlias: (id: number) =>
    handle(client.post<OkResponse>(`/api/aliases/${id}/restore`)),
  deleteAlias: (id: number) => handle(client.delete<OkResponse>(`/api/aliases/${id}`)),

  // whitelist
  whitelist: (mailboxId: number) =>
    handle(client.get<WhitelistRule[]>(`/api/whitelist?mailboxId=${mailboxId}`)),
  addRule: (rule: AddWhitelistRuleRequest) =>
    handle(client.post<AddWhitelistRuleResponse>(`/api/whitelist`, rule)),
  removeRule: (id: number) =>
    handle(client.delete<OkResponse>(`/api/whitelist/${id}`)),

  // send (Phase 2)
  send: (body: SendMessageRequest) =>
    handle(client.post<SendMessageResponse>(`/api/send`, body)),

  // reply prefill
  replyPrefill: (id: string, mode: ReplyMode) =>
    handle(client.get<ReplyPrefillResponse>(`/api/messages/${id}/reply?mode=${mode}`)),

  // drafts
  listDrafts: (mailboxId: number) => handle(client.get<Draft[]>(`/api/drafts?mailboxId=${mailboxId}`)),
  getDraft: (id: string) => handle(client.get<Draft>(`/api/drafts/${id}`)),
  createDraft: (b: CreateDraftRequest) => handle(client.post<CreateDraftResponse>(`/api/drafts`, b)),
  patchDraft: (id: string, b: PatchDraftRequest) =>
    handle(client.patch<OkResponse>(`/api/drafts/${id}`, b)),
  deleteDraft: (id: string) => handle(client.delete<OkResponse>(`/api/drafts/${id}`)),
  sendDraft: (id: string) =>
    handle(client.post<SendMessageResponse>(`/api/drafts/${id}/send`)),

  // domains / DKIM
  domains: () =>
    handle(client.get<DomainSummary[]>('/api/domains')),
  domainDns: (id: number) =>
    handle(client.get<DomainDnsResponse>(`/api/domains/${id}/dns`)),

  // connections (Gmail/Outlook aggregator)
  connections: () => handle(client.get<Connection[]>('/api/connections')),
  disconnect: (id: number) => handle(client.delete<{ ok: true }>(`/api/connections/${id}`)),
  gmailConnectUrl: () => '/api/oauth/gmail/start',
  outlookConnectUrl: () => '/api/oauth/outlook/start',

  // dev: simulate inbound
  inject: (body: InjectRequest) => handle(client.post<unknown>(`/api/inject`, body)),

  // auth
  signup: (b: SignupRequest) => handle(client.post<SignupResponse>('/api/auth/signup', b)),
  authMe: () => handle(client.get<AuthMe>('/api/auth/me')),
  authLogin: (b: LoginRequest) => handle(client.post<LoginResponse>('/api/auth/login', b)),
  authLogout: () => handle(client.post<OkResponse>('/api/auth/logout')),
  authChangePassword: (b: ChangePasswordRequest) =>
    handle(client.post<OkResponse>('/api/auth/password', b)),
  tourComplete: () => handle(client.post<OkResponse>('/api/users/me/tour-complete')),
  totpSetup: () => handle(client.post<TotpSetupResponse>('/api/auth/totp/setup')),
  totpConfirm: (b: TotpConfirmRequest) => handle(client.post<OkResponse>('/api/auth/totp/confirm', b)),
  totpDisable: (b: TotpDisableRequest) => handle(client.delete<OkResponse>('/api/auth/totp', { body: b })),
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
