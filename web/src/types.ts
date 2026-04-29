export type Mailbox = {
  id: number;
  address: string;
  domain_id: number;
  display_name: string | null;
  quarantine_ttl_hours: number;
  created_at: number;
};

export type FolderName = 'inbox' | 'quarantine' | 'sent' | 'trash';
export type SidebarFolder = FolderName | 'drafts';

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
  kind: 'address' | 'domain' | 'regex';
  pattern: string;
  note: string | null;
  created_at: number;
};

export type Counts = Record<FolderName, { total: number; unread: number }> & {
  drafts: { total: number; unread: number };
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
