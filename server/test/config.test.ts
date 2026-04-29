import { describe, it, expect } from 'vitest';
import { parseSessionSecret, parseAllowedOrigins } from '../src/config.js';

describe('config parsers', () => {
  it('parseSessionSecret throws when missing in production', () => {
    expect(() => parseSessionSecret({ value: undefined, isProd: true })).toThrow(/SESSION_SECRET/);
  });
  it('parseSessionSecret throws when too short', () => {
    expect(() => parseSessionSecret({ value: 'short', isProd: true })).toThrow(/at least 32/);
  });
  it('parseSessionSecret returns the value when valid', () => {
    expect(parseSessionSecret({ value: 'a'.repeat(64), isProd: true })).toBe('a'.repeat(64));
  });
  it('parseSessionSecret returns a stable fallback in non-prod', () => {
    expect(parseSessionSecret({ value: undefined, isProd: false })).toMatch(/^.{32,}$/);
  });
  it('parseAllowedOrigins splits and trims', () => {
    expect(parseAllowedOrigins('a, b ,c')).toEqual(['a', 'b', 'c']);
  });
  it('parseAllowedOrigins falls back when empty', () => {
    expect(parseAllowedOrigins(undefined)).toEqual(['http://localhost:5173']);
  });
});
