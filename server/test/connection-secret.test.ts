import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config, loadConnectionSecret } from '../src/config.js';

describe('connection secret', () => {
  const secretPath = join(config.dataDir, '.connection-secret');

  beforeEach(() => {
    delete process.env.CONNECTION_SECRET;
    if (existsSync(secretPath)) rmSync(secretPath);
  });

  it('returns a 32-byte buffer derived from env when set', () => {
    process.env.CONNECTION_SECRET = 'env-connection-secret-value-padded-out-32+';
    const k = loadConnectionSecret();
    expect(Buffer.isBuffer(k)).toBe(true);
    expect(k.length).toBe(32);
  });

  it('is deterministic for the same env value', () => {
    process.env.CONNECTION_SECRET = 'stable-secret-stable-secret-stable-secret';
    expect(loadConnectionSecret().toString('hex')).toBe(loadConnectionSecret().toString('hex'));
  });

  it('generates and persists a 32-byte secret when env is unset', () => {
    expect(existsSync(secretPath)).toBe(false);
    const k1 = loadConnectionSecret();
    expect(k1.length).toBe(32);
    expect(existsSync(secretPath)).toBe(true);
    const k2 = loadConnectionSecret();
    expect(k2.toString('hex')).toBe(k1.toString('hex'));
  });
});
