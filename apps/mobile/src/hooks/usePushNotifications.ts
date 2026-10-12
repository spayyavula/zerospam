import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { navigationRef } from '../navigation/navigationRef';
import { useMailboxStore } from '../stores/mailboxStore';
import { syncPushOnLaunch } from '../lib/push';

type MailData = { messageId?: string; mailboxId?: number };

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const data = response?.notification.request.content.data as MailData | undefined;
  if (!data?.messageId) return;
  if (typeof data.mailboxId === 'number') useMailboxStore.getState().setActiveMailboxId(data.mailboxId);
  const go = () => navigationRef.navigate('Message', { messageId: data.messageId!, mailboxId: data.mailboxId });
  if (navigationRef.isReady()) go();
  else setTimeout(go, 400);
}

/** Mounted once the user is signed in: registers for pushes and opens tapped notifications. */
export function usePushNotifications() {
  const qc = useQueryClient();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void syncPushOnLaunch();

    // App was launched by tapping a notification.
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) {
        openFromNotification(r);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });

    const tap = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    // New mail while the app is open: refresh lists and badges.
    const received = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: ['messages'] });
      void qc.invalidateQueries({ queryKey: ['counts'] });
    });
    return () => {
      tap.remove();
      received.remove();
    };
  }, [qc]);
}
