import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, loadDigestSigningSecret } from '../src/config.js';

describe('digest signing secret', () => {
  const secretPath = join(config.dataDir, '.digest-secret');

  beforeEach(() => {
    delete process.env.DIGEST_SIGNING_SECRET;
    if (existsSync(secretPath)) rmSync(secretPath);
  });

  it('returns env value when set', () => {
    process.env.DIGEST_SIGNING_SECRET = 'env-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    expect(loadDigestSigningSecret()).toBe('env-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  });

  it('generates and persists a secret on first call when env is unset', () => {
    expect(existsSync(secretPath)).toBe(false);
    const s1 = loadDigestSigningSecret();
    expect(s1).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s1.length).toBeGreaterThanOrEqual(32);
    expect(readFileSync(secretPath, 'utf8').trim()).toBe(s1);
  });

  it('reuses the persisted secret on a subsequent call', () => {
    const s1 = loadDigestSigningSecret();
    const s2 = loadDigestSigningSecret();
    expect(s2).toBe(s1);
  });
});
