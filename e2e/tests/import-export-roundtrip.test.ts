import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount } from '../helpers/panel-page.js';
import {
  injectDiscovery,
  injectTokenRequest,
  reloadAndWaitForEvents,
} from '../helpers/inject-events.js';

test.describe('import/export round-trip', () => {
  test('export JSON then import restores events with import banner', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);
    await panelPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Inject events
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // Export JSON
    const exportBtn = panelPage.locator('.tb-btn', { hasText: 'Export' });
    await exportBtn.click();
    await panelPage.locator('.tb-dropdown-item', { hasText: 'Export JSON' }).click();

    // Read clipboard
    const exportedJson = await panelPage.evaluate(() => navigator.clipboard.readText());
    const exported = JSON.parse(exportedJson);
    expect(exported.flow.events.length).toBeGreaterThanOrEqual(2);

    // Clear the flow
    const clearBtn = panelPage.locator('.tb-btn', { hasText: 'Clear' });
    await clearBtn.click();
    await expect(panelPage.locator('.tl-row')).toHaveCount(0, { timeout: 3000 });

    // Import: click Import button
    const importBtn = panelPage.locator('.tb-btn', { hasText: 'Import' });
    await importBtn.click();

    // Paste area should appear
    const pasteArea = panelPage.locator('.import-paste-textarea');
    await expect(pasteArea).toBeVisible();

    // Fill in the exported JSON and submit
    await pasteArea.fill(exportedJson);
    const submitBtn = panelPage.locator('.import-paste .tb-btn', { hasText: 'Import' });
    await submitBtn.click();

    // Events should reappear
    await expect(async () => {
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 3000 });

    // Import banner should be visible
    const importBanner = panelPage.locator('.import-banner');
    await expect(importBanner).toBeVisible();
    await expect(importBanner).toContainText('Imported flow');
    await expect(importBanner).toContainText('redacted');

    await panelPage.close();
  });

  test('export Markdown copies valid markdown to clipboard', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);
    await panelPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // Export Markdown
    const exportBtn = panelPage.locator('.tb-btn', { hasText: 'Export' });
    await exportBtn.click();
    await panelPage.locator('.tb-dropdown-item', { hasText: 'Export Markdown' }).click();

    // Read clipboard
    const md = await panelPage.evaluate(() => navigator.clipboard.readText());
    expect(md).toContain('#');
    expect(md.length).toBeGreaterThan(50);

    await panelPage.close();
  });
});
