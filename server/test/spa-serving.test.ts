import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerWebSpa } from '../src/api.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'zsweb-'));
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ZeroSpam SPA</title>');
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function build() {
  const app = Fastify({ logger: false });
  await registerWebSpa(app, dir);
  await app.ready();
  return app;
}

describe('web SPA serving', () => {
  it('serves index.html at /', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('ZeroSpam SPA');
    await app.close();
  });

  it('serves built assets', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('console.log');
    await app.close();
  });

  it('falls back to index.html for unknown client routes', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/some/client/route' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('ZeroSpam SPA');
    await app.close();
  });

  it('returns JSON 404 for unknown /api routes (no SPA fallback)', async () => {
    const app = await build();
    const r = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(r.statusCode).toBe(404);
    expect(r.headers['content-type']).toContain('application/json');
    await app.close();
  });
});
