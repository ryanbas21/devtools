import { test as base, type BrowserContext, chromium } from '@playwright/test';
import path from 'node:path';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Server } from 'node:http';
import { createMockOidcServer } from '../mock-oidc-server/server.js';

const EXT_DIST = path.resolve(import.meta.dirname, '../../packages/devtools-extension/dist');

// Shared browser instance across all tests (module-level singleton)
let sharedContext: BrowserContext | null = null;
let sharedExtensionId: string | null = null;

async function getSharedContext(): Promise<{ context: BrowserContext; extensionId: string }> {
  if (sharedContext && sharedExtensionId) {
    return { context: sharedContext, extensionId: sharedExtensionId };
  }

  if (!existsSync(path.join(EXT_DIST, 'manifest.json'))) {
    throw new Error(
      'Extension not built. Run `pnpm --filter @wolfcola/devtools-extension build` first.',
    );
  }

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'wolfcola-e2e-'));
  sharedContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIST}`,
      `--load-extension=${EXT_DIST}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });

  let sw = sharedContext.serviceWorkers()[0];
  if (!sw) {
    sw = await sharedContext.waitForEvent('serviceworker');
  }
  sharedExtensionId = sw.url().split('/')[2];

  return { context: sharedContext, extensionId: sharedExtensionId };
}

export type TestFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
  mockServer: { server: Server; baseUrl: string };
};

export const test = base.extend<TestFixtures>({
  extensionContext: async ({ browserName }, use) => {
    if (browserName !== 'chromium') {
      throw new Error(
        'Firefox e2e with extensions is not yet supported by Playwright. Use firefox-build.test.ts for build verification.',
      );
    }
    const { context } = await getSharedContext();
    await use(context);
  },

  extensionId: async ({ browserName }, use) => {
    if (browserName !== 'chromium') {
      await use('');
      return;
    }
    const { extensionId } = await getSharedContext();
    await use(extensionId);
  },

  // eslint-disable-next-line no-empty-pattern
  mockServer: async ({}, use) => {
    const result = await createMockOidcServer(0);
    await use(result);
    await new Promise<void>((resolve) => result.server.close(() => resolve()));
  },
});

export { expect } from '@playwright/test';
