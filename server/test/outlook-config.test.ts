import { describe, it, expect, afterEach } from 'vitest';
import { config, outlookRedirectUri } from '../src/config.js';

describe('outlookRedirectUri', () => {
  const orig = config.publicBaseUrl;
  afterEach(() => {
    (config as any).publicBaseUrl = orig;
  });

  it('builds the callback URL from publicBaseUrl', () => {
    (config as any).publicBaseUrl = 'https://mail.example.com';
    expect(outlookRedirectUri()).toBe('https://mail.example.com/api/oauth/outlook/callback');
  });

  it('throws when publicBaseUrl is empty', () => {
    (config as any).publicBaseUrl = '';
    expect(() => outlookRedirectUri()).toThrow(/PUBLIC_BASE_URL/);
  });
});
