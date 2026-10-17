import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  outputDir: 'test-results',
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
    channel: 'msedge',
    headless: true,
  },
  webServer: [
    {
      command: 'bun tests/support/e2e-server.ts',
      url: 'http://127.0.0.1:55437/health',
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: 'bun run dev:web --port 5175',
      url: 'http://127.0.0.1:5175',
      timeout: 60000,
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:55436',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_d1_test',
        VITE_API_URL: 'http://127.0.0.1:55437',
      },
    },
  ],
});
