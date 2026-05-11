import { test, expect } from '../fixtures/extension.js';

test.describe('extension loads', () => {
  test('service worker is registered', async ({ context, extensionId }) => {
    expect(extensionId).toBeTruthy();
    const workers = context.serviceWorkers();
    expect(workers.length).toBeGreaterThan(0);

    const swUrl = workers[0].url();
    expect(swUrl).toContain(extensionId);
    expect(swUrl).toContain('service-worker.js');
  });

  test('panel page loads and Elm mounts', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/panel/panel.html`);

    const app = page.locator('#app');
    await expect(app).toBeAttached();

    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toBeVisible();

    await page.close();
  });

  test('devtools page exists', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/devtools.html`);

    const body = page.locator('body');
    await expect(body).toBeAttached();

    await page.close();
  });
});
