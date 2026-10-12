import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AuthMe, BillingSummary } from '@zerospam/shared-api';
import { apiClient, ApiError, onApiSignal } from '../lib/apiClient';
import { setDeviceToken, clearDeviceToken } from '../lib/secureStore';

type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

export type LoginResult = null | 'needs_totp' | 'invalid_credentials' | 'bad_code' | 'rate_limited' | 'invalid_input' | 'network_error';

type AuthState = {
  status: AuthStatus;
  user: AuthMe['user'] | null;
  /** True once the API has answered 402: the free trial ended without a subscription. */
  locked: boolean;
  billing: BillingSummary | null;
  /** Sign in and pair this phone. Returns null on success, or a reason code. */
  login: (email: string, password: string, totp?: string) => Promise<LoginResult>;
  /** Revoke this phone's token and clear local state. */
  logout: () => Promise<void>;
  /** Read the stored token and verify it with /api/auth/me. */
  bootstrap: () => Promise<void>;
  refreshBilling: () => Promise<void>;
};

function deviceName(): string {
  const model = Constants.deviceName ?? (Platform.OS === 'android' ? 'Android phone' : Platform.OS);
  return `ZeroSpam app · ${model}`.slice(0, 120);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'unknown',
  user: null,
  locked: false,
  billing: null,

  bootstrap: async () => {
    try {
      const me = await apiClient.get<AuthMe>('/api/auth/me');
      set({ status: 'authenticated', user: me.user });
      void get().refreshBilling();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearDeviceToken();
        set({ status: 'unauthenticated', user: null });
        return;
      }
      // Offline at launch with a stored token: let the user in; screens show their own
      // connection errors and retry. Without a token, show sign-in.
      const { getDeviceToken } = await import('../lib/secureStore');
      const hasToken = !!(await getDeviceToken());
      set({ status: hasToken ? 'authenticated' : 'unauthenticated', user: null });
    }
  },

  refreshBilling: async () => {
    try {
      const billing = await apiClient.get<BillingSummary>('/api/billing');
      set({ billing, locked: billing.enabled && !billing.entitled });
    } catch {
      // Billing state is advisory in the app; a 402 elsewhere still locks.
    }
  },

  login: async (email, password, totp) => {
    try {
      // 1. Password (+ TOTP) check. Answers with a short-lived session cookie.
      const res = await apiClient.post<{ ok: true } | { needs_totp: true }>(
        '/api/auth/login',
        { email, password, ...(totp ? { totp } : {}) },
        { auth: 'omit' },
      );
      if ('needs_totp' in res) return 'needs_totp';

      // 2. Exchange the cookie session for a long-lived token for this phone.
      const { token } = await apiClient.post<{ token: string }>(
        '/api/auth/devices',
        {
          name: deviceName(),
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
          appVersion: Constants.expoConfig?.version,
        },
        { auth: 'omit' },
      );
      await setDeviceToken(token);

      // 3. End the cookie session; from here on only the device token is used.
      await apiClient.post('/api/auth/logout', undefined, { auth: 'omit' }).catch(() => {});

      const me = await apiClient.get<AuthMe>('/api/auth/me');
      set({ status: 'authenticated', user: me.user, locked: false });
      void get().refreshBilling();
      return null;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return totp ? 'bad_code' : 'invalid_credentials';
        if (err.status === 429) return 'rate_limited';
        if (err.status === 400 || err.status === 422) return 'invalid_input';
      }
      return 'network_error';
    }
  },

  logout: async () => {
    try {
      await apiClient.delete('/api/auth/devices/me');
    } catch {
      // best-effort — clear locally even if the request fails
    }
    await clearDeviceToken();
    set({ status: 'unauthenticated', user: null, locked: false, billing: null });
  },
}));

// A 401 on an authenticated call means this phone's token was revoked (signed out from
// the website, or password reset). A 402 means the trial ended.
onApiSignal('unauthorized', () => {
  if (useAuthStore.getState().status !== 'authenticated') return;
  void clearDeviceToken();
  useAuthStore.setState({ status: 'unauthenticated', user: null, locked: false });
});
onApiSignal('paywall', () => {
  if (!useAuthStore.getState().locked) useAuthStore.setState({ locked: true });
});
