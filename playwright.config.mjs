import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:30000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1920, height: 1080 },
  },
  globalSetup: './e2e/global-setup.mjs',
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
