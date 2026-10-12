import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ReplyMode } from '@zerospam/shared-api';

export type AuthStackParamList = {
  Login: undefined;
  Totp: { email: string; password: string };
  Signup: undefined;
};

export type MainTabParamList = {
  Mail: undefined;
  Screener: undefined;
  Quarantine: undefined;
  Aliases: undefined;
  More: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Message: { messageId: string; mailboxId?: number };
  Compose: { mode?: ReplyMode; messageId?: string; to?: string } | undefined;
  Search: undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends AppStackParamList {}
  }
}
