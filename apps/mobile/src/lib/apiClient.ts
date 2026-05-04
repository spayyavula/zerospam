import { createApiClient } from '@zerospam/shared-api';
import { Platform } from 'react-native';
import { getDeviceToken } from './secureStore';

// Use an explicit API origin for web preview so requests go to the Fastify API
// instead of Metro's dev server origin.
const baseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL
  ?? (Platform.OS === 'web' ? 'http://localhost:8025' : undefined);

// A single shared API client instance used across the whole mobile app.
// It resolves the stored device bearer token on every request.
export const apiClient = createApiClient({
  baseUrl,
  // Required for web preview: /api/auth/login sets an HTTP cookie that is then
  // exchanged at /api/auth/devices. Without credentials=include, the cookie is
  // not sent cross-origin (8084 -> 8025) and login appears to fail.
  credentials: 'include',
  getAuthToken: getDeviceToken,
  timeoutMs: 15_000,
});
