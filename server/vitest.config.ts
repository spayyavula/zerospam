import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    env: {
      DATA_DIR: 'test-data',
      PUBLIC_BASE_URL: 'http://localhost:8025',
      DIGEST_SIGNING_SECRET: 'test-secret-thirty-two-bytes-min-padpadpadpad',
      DIGEST_TICK_INTERVAL_SEC: '60',
    },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    sequence: { concurrent: false },
  },
});
