import { test as base, type BrowserContext, chromium } from '@playwright/test';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import { createMockOidcServer } from '../mock-oidc-server/server.js';

const EXT_PKG = path.resolve(import.meta.dirname, '../../packages/devtools-extension');
const EXT_DIST = path.join(EXT_PKG, 'dist');

export type TestFixtures = {
  context: BrowserContext;
  extensionId: string;
  mockServer: { server: Server; baseUrl: string };
};

export const test = base.extend<TestFixtures>({
  // eslint-disable-next-line no-empty-pattern
  mockServer: async ({}, use) => {
    const result = await createMockOidcServer(0);
    await use(result);
    result.server.close();
  },

  context: async ({ browserName }, use) => {
    if (browserName === 'chromium') {
      const buildResult = spawnSync(process.execPath, ['build.mjs'], {
        cwd: EXT_PKG,
        stdio: 'pipe',
        env: { ...process.env, PATH: process.env.PATH },
      });
      if (buildResult.status !== 0) {
        throw new Error(`Extension build failed: ${buildResult.stderr?.toString()}`);
      }

      const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [`--disable-extensions-except=${EXT_DIST}`, `--load-extension=${EXT_DIST}`],
      });
      await use(context);
      await context.close();
    } else {
      throw new Error(
        'Firefox e2e with extensions is not yet supported by Playwright. Use firefox-build.test.ts for build verification.',
      );
    }
  },

  extensionId: async ({ context }, use) => {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const id = serviceWorker.url().split('/')[2];
    await use(id);
  },
});

export { expect } from '@playwright/test';
