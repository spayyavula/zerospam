import { create } from 'zustand';
import { Platform } from 'react-native';
import type { AuthMe } from '@zerospam/shared-api';
import { ApiError } from '@zerospam/shared-api';
import { apiClient } from '../lib/apiClient';
import { setDeviceToken, clearDeviceToken } from '../lib/secureStore';

type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  user: AuthMe['user'] | null;
  // Perform the full login + device-register flow. Returns null on success,
  // or an error code string for the caller to display.
  login: (email: string, password: string, totp?: string) => Promise<string | null>;
  // Revoke the current device token and clear local state.
  logout: () => Promise<void>;
  // Read the stored token and verify it with /api/auth/me.
  bootstrap: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,

  bootstrap: async () => {
    try {
      const me = await apiClient.get<AuthMe>('/api/auth/me');
      set({ status: 'authenticated', user: me.user });
    } catch (err) {
      const isUnauth = err instanceof ApiError && err.status === 401;
      if (isUnauth) {
        await clearDeviceToken();
      }
      set({ status: 'unauthenticated', user: null });
    }
  },

  login: async (email, password, totp?) => {
    try {
      // Step 1 — cookie session (React Native's HTTP stack stores the cookie)
      type LoginResp = { ok: true } | { needs_totp: true };
      const loginResp = await apiClient.post<LoginResp>('/api/auth/login', {
        email,
        password,
        ...(totp ? { totp } : {}),
      }, { auth: 'omit' });

      if ('needs_totp' in loginResp) return 'needs_totp';

      // Step 2 — exchange cookie for a durable device bearer token
      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      const { token } = await apiClient.post<{ token: string }>('/api/auth/devices', {
        name: `ZeroSpam Mobile (${Platform.OS})`,
        platform,
      }, { auth: 'omit' });

      await setDeviceToken(token);

      // Step 3 — load the authenticated user profile
      const me = await apiClient.get<AuthMe>('/api/auth/me');
      set({ status: 'authenticated', user: me.user });
      return null;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return 'invalid_credentials';
        if (err.status === 422) return 'invalid_input';
      }
      return 'network_error';
    }
  },

  logout: async () => {
    try {
      await apiClient.delete<{ ok: true }>('/api/auth/devices/me');
    } catch {
      // best-effort — clear locally even if the request fails
    }
    await clearDeviceToken();
    set({ status: 'unauthenticated', user: null });
  },
}));
