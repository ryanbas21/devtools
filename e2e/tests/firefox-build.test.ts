import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '../../packages/devtools-extension/dist');

// These tests verify build output. The builds must be run before this test:
//   pnpm --filter @wolfcola/devtools-extension build:firefox
//   pnpm --filter @wolfcola/devtools-extension build

test.describe('firefox build', () => {
  test('produces a valid Firefox manifest', () => {
    const manifest = JSON.parse(readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));

    // Skip if the current dist is a Chrome build (no browser_specific_settings)
    test.skip(
      !manifest.browser_specific_settings,
      'Firefox build not present — run `pnpm --filter @wolfcola/devtools-extension build:firefox` first',
    );

    expect(manifest.background.scripts).toEqual(['background/service-worker.js']);
    expect(manifest.background).not.toHaveProperty('service_worker');

    expect(manifest.browser_specific_settings.gecko.id).toBe('oidc-devtool@wolfcola');
    expect(manifest.browser_specific_settings.gecko.data_collection_permissions.required).toEqual([
      'none',
    ]);
  });

  test('all expected files exist in dist', () => {
    const expectedFiles = [
      'manifest.json',
      'devtools.html',
      'devtools.js',
      'panel/panel.html',
      'panel/panel.css',
      'panel/panel.js',
      'panel/elm.js',
      'background/service-worker.js',
      'content/content-script.js',
      'content/relay.js',
      'icons/icon-16.png',
      'icons/icon-48.png',
      'icons/icon-128.png',
    ];

    for (const file of expectedFiles) {
      expect(existsSync(path.join(DIST, file)), `missing: ${file}`).toBe(true);
    }
  });
});
