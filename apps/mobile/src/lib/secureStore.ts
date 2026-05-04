import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'zerospam_device_token';

function webGet(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function webSet(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // best-effort on web (private mode/storage-disabled)
  }
}

function webClear(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // best-effort on web
  }
}

export async function getDeviceToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webGet();
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setDeviceToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webSet(token);
    return;
  }
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // best-effort; caller can still proceed with the in-memory auth step
  }
}

export async function clearDeviceToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webClear();
    return;
  }
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // best-effort
  }
}
