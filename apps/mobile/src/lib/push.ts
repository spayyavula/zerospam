import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from './apiClient';
import { getPref, setPref } from './prefs';
import { logger } from './logger';

export type PushSettings = { enabled: boolean; showPreview: boolean };

export const MAIL_CHANNEL = 'mail';

// Show new-mail notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function pushSupported(): boolean {
  return Platform.OS !== 'web' && Device.isDevice;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(MAIL_CHANNEL, {
    name: 'New mail',
    description: 'Mail from approved senders arriving in your Inbox',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: true,
  });
}

async function expoToken(): Promise<string | null> {
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    logger.warn('push_no_project_id', {});
    return null;
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

export function getPushSettings(): Promise<PushSettings> {
  return apiClient.get<PushSettings>('/api/auth/devices/me/push');
}

/**
 * Turn notifications on for this phone: ask Android for permission (13+ shows a
 * dialog), get the Expo push token and give it to the server.
 * Returns 'denied' when the user said no.
 */
export async function enablePush(showPreview?: boolean): Promise<PushSettings | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  await ensureChannel();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return 'denied';
  const token = await expoToken();
  if (!token) return 'unsupported';
  return apiClient.request<PushSettings>('/api/auth/devices/me/push', {
    method: 'PUT',
    body: { token, ...(showPreview === undefined ? {} : { showPreview }) },
  });
}

export function disablePush(): Promise<PushSettings> {
  return apiClient.request<PushSettings>('/api/auth/devices/me/push', { method: 'PUT', body: { token: null } });
}

export function setPushPreview(showPreview: boolean): Promise<PushSettings> {
  return apiClient.request<PushSettings>('/api/auth/devices/me/push', { method: 'PUT', body: { showPreview } });
}

/**
 * After sign-in: ask once on this install. Later launches quietly re-register (tokens can
 * rotate) only if the user said yes before.
 */
export async function syncPushOnLaunch(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const asked = await getPref('push_asked');
    const { status } = await Notifications.getPermissionsAsync();
    if (!asked) {
      await setPref('push_asked', '1');
      await enablePush();
      return;
    }
    // Re-register so a rotated token is picked up, unless turned off in More.
    if (status === 'granted' && (await getPref('push_off')) !== '1') await enablePush();
  } catch (e) {
    logger.warn('push_sync_failed', { message: e instanceof Error ? e.message : String(e) });
  }
}
