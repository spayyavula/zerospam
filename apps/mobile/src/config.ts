import { Platform } from 'react-native';

// Production API and website. Override per build with EXPO_PUBLIC_API_BASE_URL (eas.json)
// or locally in apps/mobile/.env. The web preview talks to the local dev server.
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL
  ?? (Platform.OS === 'web' && __DEV__ ? 'http://localhost:8025' : 'https://zero-spam.email');

/** Where account things that live only on the website are managed. */
export const WEB_URL: string = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://zero-spam.email';

export const PRIVACY_URL = `${WEB_URL}/privacy-policy`;
export const TERMS_URL = `${WEB_URL}/terms-of-service`;
