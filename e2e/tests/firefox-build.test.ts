import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../packages/devtools-extension');
const DIST = path.join(ROOT, 'dist');

test.describe('firefox build', () => {
  test.beforeAll(() => {
    execFileSync('node', ['build.mjs', '--target=firefox'], {
      cwd: ROOT,
      stdio: 'pipe',
    });
  });

  test('produces a valid Firefox manifest', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(DIST, 'manifest.json'), 'utf8'),
    );

    expect(manifest.background.scripts).toEqual([
      'background/service-worker.js',
    ]);
    expect(manifest.background).not.toHaveProperty('service_worker');

    expect(manifest.browser_specific_settings.gecko.id).toBe(
      'oidc-devtool@wolfcola',
    );
    expect(
      manifest.browser_specific_settings.gecko.data_collection_permissions
        .required,
    ).toEqual(['none']);
  });

  test('all expected files exist in dist', () => {
    const expectedFiles = [
      'manifest.json',
      'devtools.html',
      'devtools.js',
      'panel/panel.html',
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
      expect(
        existsSync(path.join(DIST, file)),
        `missing: ${file}`,
      ).toBe(true);
    }
  });

  test('Chrome build is not contaminated with Firefox fields', () => {
    execFileSync('node', ['build.mjs'], { cwd: ROOT, stdio: 'pipe' });
    const manifest = JSON.parse(
      readFileSync(path.join(DIST, 'manifest.json'), 'utf8'),
    );

    expect(manifest.background.service_worker).toBe(
      'background/service-worker.js',
    );
    expect(manifest.background).not.toHaveProperty('scripts');
    expect(manifest).not.toHaveProperty('browser_specific_settings');
  });
});
