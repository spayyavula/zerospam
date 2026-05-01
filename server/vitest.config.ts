import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    env: {
      DATA_DIR: 'test-data',
      PUBLIC_BASE_URL: 'http://localhost:8025',
      DIGEST_SIGNING_SECRET: 'test-digest-signing-secret-not-for-production-padded',
      DIGEST_TICK_INTERVAL_SEC: '60',
      SIGNUP_DOMAIN: 'zero-spam.email',
      VERIFY_TOKEN_EXPIRY_HOURS: '24',
      API_PORT: '0',
      NODE_ENV: 'test',
    },
    maxWorkers: 1,
    isolate: false,
    sequence: { concurrent: false },
  },
});
