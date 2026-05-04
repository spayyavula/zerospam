export type DigestRecipientMode = 'external' | 'loopback';
export type FolderName = 'inbox' | 'quarantine' | 'sent' | 'trash';
export type MoveFolder = 'inbox' | 'quarantine' | 'trash';
export type WhitelistKind = 'address' | 'domain' | 'regex';

export type Mailbox = {
  id: number;
  address: string;
  domain_id: number;
  display_name: string | null;
  quarantine_ttl_hours: number;
  created_at: number;
  digest_enabled: number;
  digest_hour: number;
  digest_recipient_mode: DigestRecipientMode;
  owner_email: string | null;
  screener_sla_hours: number;
  last_digest_sent_at: number | null;
  digest_last_error: string | null;
  digest_consecutive_failures: number;
};

export type MessageSummary = {
  id: string;
  mailbox_id: number;
  folder: FolderName;
  from_address: string;
  from_name: string | null;
  to_addresses: string;
  subject: string | null;
  preview: string | null;
  received_at: number;
  expires_at: number | null;
  read: number;
  starred: number;
  spf_pass: number | null;
  dkim_pass: number | null;
  dmarc_pass: number | null;
  whitelist_match: string | null;
  size_bytes: number;
  attachment_count: number;
  in_reply_to?: string | null;
  tracker_count?: number;
};

export type MessageDetail = MessageSummary & {
  body_text: string | null;
  body_html: string | null;
  raw_path: string;
  cc_addresses: string | null;
  tracker_details?: string | null;
  delivered_to_alias?: string | null;
};

export type Attachment = {
  id: number;
  filename: string | null;
  content_type: string | null;
  size_bytes: number;
  cid: string | null;
  inline: number;
};

export type TrackerHit = {
  url: string;
  provider: string;
  learns: string[];
  invisible: boolean;
};

export type TrackerReport = {
  count: number;
  hits: TrackerHit[];
};

export type Alias = {
  id: number;
  mailbox_id: number;
  address: string;
  label: string | null;
  expires_at: number | null;
  abused: number;
  received_count: number;
  last_seen: number | null;
  created_at: number;
};

export type WhitelistRule = {
  id: number;
  mailbox_id: number;
  kind: WhitelistKind;
  pattern: string;
  note: string | null;
  created_at: number;
};

export type Counts = Record<FolderName, { total: number; unread: number }> & {
  screener: { total: number; unread: number };
  drafts: { total: number; unread: number };
};

export type ScreenerSender = {
  address: string;
  name: string | null;
  message_count: number;
  latest_subject: string;
  latest_preview: string;
  latest_received_at: number;
  first_received_at: number;
  messages: MessageSummary[];
};

export type Draft = {
  id: string;
  mailbox_id: number;
  to_addresses: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  reply_to_message_id: string | null;
  created_at: number;
  updated_at: number;
};

export type ReplyMode = 'reply' | 'reply-all' | 'forward';

export type ComposeInitial = {
  mailboxId: number;
  to?: string[];
  cc?: string[];
  subject?: string;
  text?: string;
  inReplyTo?: string | null;
  references?: string | null;
  replyToMessageId?: string | null;
};

export type BulkAction =
  | 'mark-read'
  | 'mark-unread'
  | 'star'
  | 'unstar'
  | 'move-trash'
  | 'move-inbox'
  | 'move-quarantine'
  | 'delete'
  | 'trust-sender';

export type AuthMe = {
  user: {
    id: number;
    email: string;
    totp_enabled: boolean;
    tour_completed_at: number | null;
  };
};

export type LoginRequest = { email: string; password: string; totp?: string };
export type LoginResponse = { ok: true } | { needs_totp: true };
export type OkResponse = { ok: true };

export type CreateMailboxRequest = {
  address: string;
  displayName?: string;
  quarantineTtlHours?: number;
};
export type CreateMailboxResponse = { id: number };

export type PatchMailboxRequest = {
  displayName?: string | null;
  quarantineTtlHours?: number;
  screenerSlaHours?: number;
  digestEnabled?: boolean;
  digestHour?: number;
  digestRecipientMode?: DigestRecipientMode;
  ownerEmail?: string | null;
};

export type ScreenerAllowRequest = {
  mailbox_id: number;
  sender_address: string;
};
export type ScreenerAllowResponse = {
  moved: number;
  rule_id: number;
  sender_address: string;
  domain: string;
  suggest_domain_expand: boolean;
};

export type ScreenerAllowDomainRequest = {
  mailbox_id: number;
  domain: string;
};
export type ScreenerAllowDomainResponse = {
  moved: number;
  rule_id: number;
};

export type ScreenerRejectRequest = {
  mailbox_id: number;
  sender_address: string;
};
export type ScreenerRejectResponse = {
  trashed: number;
};

export type SetReadRequest = { read: boolean };
export type SetStarredRequest = { starred: boolean };
export type MoveMessageRequest = { folder: MoveFolder };
export type BulkMessagesRequest = { ids: string[]; action: BulkAction };
export type BulkMessagesResponse = { ok: true; affected: number };
export type PurgeQuarantineResponse = { ok: true; purged: number };

export type CreateAliasRequest = {
  mailboxId: number;
  label?: string;
  localPart?: string;
  expiresInDays?: number | null;
};
export type CreateAliasResponse = {
  id: number;
  address: string;
  expires_at: number | null;
};

export type AddWhitelistRuleRequest = {
  mailboxId: number;
  kind: WhitelistKind;
  pattern: string;
  note?: string;
};
export type AddWhitelistRuleResponse = { id: number };

export type SendMessageRequest = {
  mailboxId: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string | null;
};
export type SendMessageResponse = {
  messageId: string;
  recipients: string[];
  signed: boolean;
  whitelistAdded: number;
};

export type ReplyPrefillResponse = ComposeInitial & { mode: ReplyMode };

export type CreateDraftRequest = {
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
};
export type CreateDraftResponse = { id: string };

export type PatchDraftRequest = {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
};

export type DomainSummary = {
  id: number;
  name: string;
  created_at: number;
  dkim_selector: string | null;
  dkim_public_pem: string | null;
};

export type DomainDnsResponse = {
  host: string;
  type: 'TXT';
  value: string;
  copyPaste: string;
};

export type InjectRequest = {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  text: string;
};

export type SignupRequest = {
  email: string;
  password: string;
  username: string;
};
export type SignupResponse = {
  userId: number;
  accountId: number;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type TotpSetupResponse = {
  secret: string;
  otpauth_url: string;
};
export type TotpConfirmRequest = { code: string };
export type TotpDisableRequest = { password: string };

export type DevicePlatform = 'ios' | 'android' | 'web';

export type DeviceRegisterRequest = {
  name: string;
  platform?: DevicePlatform;
  appVersion?: string;
};

export type DeviceRegisterResponse = {
  token: string;
};
