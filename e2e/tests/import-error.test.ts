import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';

test.describe('import error handling', () => {
  test('submitting invalid JSON shows error banner', async ({ extensionContext, extensionId }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Open import paste area
    const importBtn = panelPage.locator('.tb-btn', { hasText: 'Import' });
    await importBtn.click();

    const pasteArea = panelPage.locator('.import-paste-textarea');
    await expect(pasteArea).toBeVisible();

    // Paste invalid JSON
    await pasteArea.fill('not valid json {{{');
    const submitBtn = panelPage.locator('.import-paste .tb-btn', { hasText: 'Import' });
    await submitBtn.click();

    // Error banner should appear
    const errBanner = panelPage.locator('.err-banner');
    await expect(errBanner).toBeVisible({ timeout: 3000 });

    // Panel should remain functional
    await expect(panelPage.locator('.toolbar')).toBeVisible();

    await panelPage.close();
  });

  test('submitting valid JSON with wrong schema shows error banner', async ({
    extensionContext,
    extensionId,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Open import paste area
    const importBtn = panelPage.locator('.tb-btn', { hasText: 'Import' });
    await importBtn.click();

    const pasteArea = panelPage.locator('.import-paste-textarea');
    await expect(pasteArea).toBeVisible();

    // Paste valid JSON but wrong schema (missing required fields)
    await pasteArea.fill(JSON.stringify({ version: 999, flow: {} }));
    const submitBtn = panelPage.locator('.import-paste .tb-btn', { hasText: 'Import' });
    await submitBtn.click();

    // Error banner should appear
    const errBanner = panelPage.locator('.err-banner');
    await expect(errBanner).toBeVisible({ timeout: 3000 });

    // Panel should remain functional
    await expect(panelPage.locator('.toolbar')).toBeVisible();

    await panelPage.close();
  });
});
