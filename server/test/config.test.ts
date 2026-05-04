import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseAllowedOrigins, loadOrCreateSessionSecret } from '../src/config.js';

describe('config parsers', () => {
  it('parseAllowedOrigins splits and trims', () => {
    expect(parseAllowedOrigins('a, b ,c')).toEqual(['a', 'b', 'c']);
  });
  it('parseAllowedOrigins falls back when empty', () => {
    const defaults = parseAllowedOrigins(undefined);
    expect(defaults).toContain('http://localhost:5173');
    expect(defaults.length).toBeGreaterThan(1);
  });
});

describe('loadOrCreateSessionSecret', () => {
  it('persists across calls in dev (same secret returned on second call)', () => {
    const tmpDir = path.join(os.tmpdir(), 'zerospam-test-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      const a = loadOrCreateSessionSecret({ value: undefined, isProd: false, dataDir: tmpDir });
      const b = loadOrCreateSessionSecret({ value: undefined, isProd: false, dataDir: tmpDir });
      expect(a).toBe(b);
      expect(a.length).toBeGreaterThanOrEqual(32);
      expect(a).not.toBe('a'.repeat(64));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws in prod with no value', () => {
    expect(() =>
      loadOrCreateSessionSecret({ value: undefined, isProd: true, dataDir: '/tmp' }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('accepts env-provided value when >= 32 chars', () => {
    const v = loadOrCreateSessionSecret({
      value: 'a-secret-with-at-least-32-characters-here',
      isProd: true,
      dataDir: '/tmp',
    });
    expect(v).toBe('a-secret-with-at-least-32-characters-here');
  });
});
