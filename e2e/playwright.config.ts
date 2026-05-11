import { defineConfig } from '@playwright/test';
import path from 'node:path';

const extensionDist = path.resolve(import.meta.dirname, '../packages/devtools-extension/dist');

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionDist}`,
            `--load-extension=${extensionDist}`,
          ],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
    },
  ],
});
