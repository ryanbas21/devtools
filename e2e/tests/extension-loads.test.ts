import { test, expect } from '../fixtures/extension.js';

test.describe('extension loads', () => {
  test('service worker is registered', async ({ extensionContext, extensionId }) => {
    expect(extensionId).toBeTruthy();
    const workers = extensionContext.serviceWorkers();
    expect(workers.length).toBeGreaterThan(0);

    const swUrl = workers[0].url();
    expect(swUrl).toContain(extensionId);
    expect(swUrl).toContain('service-worker.js');
  });

  test('panel page loads and Elm mounts', async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/panel/panel.html`);

    // Elm replaces the #app mount point with rendered content, so check for
    // the toolbar that Elm renders instead of the raw #app div.
    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toBeVisible();

    await page.close();
  });

  test('devtools page exists', async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/devtools.html`);

    const body = page.locator('body');
    await expect(body).toBeAttached();

    await page.close();
  });
});
