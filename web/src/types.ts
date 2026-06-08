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

export type Connection = {
  id: number;
  provider: 'gmail' | 'outlook';
  email: string;
  status: 'active' | 'needs_reconnect' | 'paused';
  lastPolledAt: number | null;
  lastError: string | null;
  createdAt: number;
};
