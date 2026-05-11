import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
      // Firefox extension e2e is not supported by Playwright.
      // Only run the build verification test.
      testMatch: /firefox-build/,
    },
  ],
});
