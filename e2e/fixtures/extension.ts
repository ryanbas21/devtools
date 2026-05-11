import { test as base, type BrowserContext, chromium } from '@playwright/test';
import path from 'node:path';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Server } from 'node:http';
import { createMockOidcServer } from '../mock-oidc-server/server.js';

const EXT_DIST = path.resolve(import.meta.dirname, '../../packages/devtools-extension/dist');

export type WorkerFixtures = {
  context: BrowserContext;
  extensionId: string;
};

export type TestFixtures = {
  mockServer: { server: Server; baseUrl: string };
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped: one browser instance shared across all tests in a worker
  context: [
    async ({ browserName }, use) => {
      if (browserName !== 'chromium') {
        throw new Error(
          'Firefox e2e with extensions is not yet supported by Playwright. Use firefox-build.test.ts for build verification.',
        );
      }

      if (!existsSync(path.join(EXT_DIST, 'manifest.json'))) {
        throw new Error(
          'Extension not built. Run `pnpm --filter @wolfcola/devtools-extension build` first.',
        );
      }

      const userDataDir = mkdtempSync(path.join(tmpdir(), 'wolfcola-e2e-'));
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
          `--disable-extensions-except=${EXT_DIST}`,
          `--load-extension=${EXT_DIST}`,
          '--no-first-run',
          '--disable-default-apps',
        ],
      });
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  extensionId: [
    async ({ context }, use) => {
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker');
      }
      const id = serviceWorker.url().split('/')[2];
      await use(id);
    },
    { scope: 'worker' },
  ],

  // Test-scoped: fresh mock server per test
  // eslint-disable-next-line no-empty-pattern
  mockServer: async ({}, use) => {
    const result = await createMockOidcServer(0);
    await use(result);
    result.server.close();
  },
});

export { expect } from '@playwright/test';
