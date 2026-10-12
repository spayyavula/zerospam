import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Small, non-secret preferences (theme, last mailbox). SecureStore is already a native
// dependency, so it doubles as key-value storage without adding AsyncStorage.

const PREFIX = 'zs_pref_';

export async function getPref(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
    return await SecureStore.getItemAsync(PREFIX + key);
  } catch {
    return null;
  }
}

export async function setPref(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(PREFIX + key, value);
      return;
    }
    await SecureStore.setItemAsync(PREFIX + key, value);
  } catch {
    // best-effort
  }
}
