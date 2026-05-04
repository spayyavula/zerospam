import type { FolderName } from '@zerospam/shared-api';

export type AuthStackParamList = {
  Login: undefined;
  Totp: { email: string; password: string };
};

export type MainTabParamList = {
  Screener: undefined;
  Inbox: undefined;
  Quarantine: undefined;
  Settings: undefined;
};

export type MessageStackParamList = {
  MessageList: { folder: FolderName; mailboxId: number };
  MessageDetail: { messageId: string };
};
