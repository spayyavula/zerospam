import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Attachment } from '@zerospam/shared-api';
import { API_BASE_URL } from '../config';
import { getDeviceToken } from './secureStore';

function safeName(a: Attachment): string {
  const base = (a.filename ?? `attachment-${a.id}`).replace(/[/\\?%*:|"<>\u0000-\u001f]/g, '_').slice(0, 120);
  return base || `attachment-${a.id}`;
}

/**
 * Download an attachment into the app's private cache and open the system share sheet,
 * from which the reader can open it in another app or save it. Files are not written to
 * shared storage, so nothing leaves the app unless the reader chooses to.
 */
export async function openAttachment(a: Attachment): Promise<void> {
  const url = `${API_BASE_URL}/api/attachments/${a.id}/download`;
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
    return;
  }
  const token = await getDeviceToken();
  const dir = `${FileSystem.cacheDirectory}attachments/${a.id}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const target = dir + safeName(a);
  const res = await FileSystem.downloadAsync(url, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(res.uri, {
    mimeType: a.content_type ?? undefined,
    dialogTitle: a.filename ?? 'Attachment',
  });
}
