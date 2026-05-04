import type { FolderName } from '@zerospam/shared-api';

export type {
  Alias,
  Attachment,
  AuthMe,
  BulkAction,
  ComposeInitial,
  Counts,
  Draft,
  FolderName,
  LoginRequest,
  LoginResponse,
  Mailbox,
  MessageDetail,
  MessageSummary,
  ReplyMode,
  ScreenerSender,
  TrackerHit,
  TrackerReport,
  WhitelistRule,
} from '@zerospam/shared-api';

export type SidebarFolder = FolderName | 'screener' | 'drafts';
