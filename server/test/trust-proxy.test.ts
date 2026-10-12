import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { parseTrustProxy, LEGACY_HOP_COUNT_TRUST } from '../src/config.js';

describe('parseTrustProxy', () => {
  it('defaults to loopback and passes through named subnets, CIDRs and booleans', () => {
    expect(parseTrustProxy(undefined)).toBe('loopback');
    expect(parseTrustProxy('  ')).toBe('loopback');
    expect(parseTrustProxy('uniquelocal')).toBe('uniquelocal');
    expect(parseTrustProxy('172.18.0.0/16, loopback')).toBe('172.18.0.0/16, loopback');
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('translates a legacy hop count to loopback + private ranges, with a warning', () => {
    const warn = vi.fn();
    expect(parseTrustProxy('1', warn)).toBe(LEGACY_HOP_COUNT_TRUST);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('TRUST_PROXY=1');
  });

  // Guards the production topology: Caddy on a private Docker network in front of the app.
  it('derives the client IP from X-Forwarded-For when the peer is a private-network proxy', async () => {
    const app = Fastify({ trustProxy: parseTrustProxy('1', () => {}) as string });
    app.get('/ip', async (req) => ({ ip: req.ip }));
    const viaCaddy = await app.inject({
      url: '/ip',
      remoteAddress: '172.18.0.3',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(viaCaddy.json()).toEqual({ ip: '203.0.113.7' });
    // A public peer can't spoof its address with the header.
    const direct = await app.inject({
      url: '/ip',
      remoteAddress: '198.51.100.9',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(direct.json()).toEqual({ ip: '198.51.100.9' });
    await app.close();
  });
});
