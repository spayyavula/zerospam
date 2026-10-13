import { createApiClient, ApiError } from '@zerospam/shared-api';
import { API_BASE_URL } from '../config';
import { getDeviceToken } from './secureStore';

// Session-level signals the API layer can't act on itself (stores subscribe to these).
type Listener = () => void;
const listeners = { unauthorized: new Set<Listener>(), paywall: new Set<Listener>() };

export function onApiSignal(kind: keyof typeof listeners, fn: Listener): () => void {
  listeners[kind].add(fn);
  return () => listeners[kind].delete(fn);
}

// Endpoints whose 401 means "wrong password", not "your device was signed out".
const CREDENTIAL_ENDPOINTS = ['/api/auth/login', '/api/auth/signup', '/api/auth/devices'];

const observingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (res.status === 402) listeners.paywall.forEach((fn) => fn());
  if (res.status === 401 && !CREDENTIAL_ENDPOINTS.some((p) => url.includes(p))) {
    listeners.unauthorized.forEach((fn) => fn());
  }
  return res;
};

// One shared client. Every request carries the device Bearer token from the keystore.
export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  // Needed only for sign-in: /api/auth/login answers with a session cookie that
  // /api/auth/devices exchanges for the device token. Afterwards the server prefers the
  // Bearer token, and the app drops the cookie session (see authStore.login).
  credentials: 'include',
  getAuthToken: getDeviceToken,
  timeoutMs: 20_000,
  fetch: observingFetch,
});

/** Human-readable text for an API failure, using the server's `{ error }` when present. */
export function errorText(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (err instanceof ApiError) {
    if (err.code === 'network-error') return 'No connection. Check your network and try again.';
    if (err.code === 'network-timeout') return 'The server took too long to answer. Try again.';
    const data = err.data as { error?: unknown; message?: unknown } | undefined;
    const msg = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : null;
    if (msg) return msg.charAt(0).toUpperCase() + msg.slice(1).replace(/-/g, ' ');
  }
  return fallback;
}

export { ApiError };
