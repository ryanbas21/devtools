import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount } from '../helpers/panel-page.js';
import {
  injectDiscovery,
  injectTokenRequest,
  reloadAndWaitForEvents,
} from '../helpers/inject-events.js';

test.describe('snapshot save/load/delete', () => {
  test('save snapshot, load it, and delete it', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject events
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // Save snapshot by clicking the "Snapshot" button (not the dropdown arrow)
    const snapshotSaveBtn = panelPage.locator('.tb-btn', { hasText: 'Snapshot' }).first();
    await snapshotSaveBtn.click();

    // Wait for chrome.storage.local.set to complete
    await panelPage.waitForTimeout(500);

    // Open snapshot dropdown via the arrow button
    const dropdownArrow = panelPage.locator('.tb-dropdown-arrow');
    await dropdownArrow.click();

    // Wait for the snapshot list to load (async via requestSnapshots port)
    const snapshotItem = panelPage.locator('.snapshot-item');
    await expect(snapshotItem.first()).toBeVisible({ timeout: 5000 });

    // Snapshot should show event count
    await expect(snapshotItem.first().locator('.snapshot-meta')).toContainText('events');

    // Close the dropdown
    await dropdownArrow.click();

    // Clear the flow
    await panelPage.locator('.tb-btn', { hasText: 'Clear' }).click();
    await expect(panelPage.locator('.tl-row')).toHaveCount(0, { timeout: 3000 });

    // Reopen dropdown and load the snapshot
    await dropdownArrow.click();
    const loadedItem = panelPage.locator('.snapshot-item-info');
    await expect(loadedItem.first()).toBeVisible({ timeout: 5000 });
    await loadedItem.first().click();

    // Events should be restored
    await expect(async () => {
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 3000 });

    // Import banner should show (snapshot loads as imported)
    await expect(panelPage.locator('.import-banner')).toBeVisible();

    // Now delete the snapshot
    // Clear the import view first
    await panelPage.locator('.import-banner-clear').click();

    // Reopen dropdown
    await dropdownArrow.click();
    const deleteBtn = panelPage.locator('.snapshot-delete');
    await expect(deleteBtn.first()).toBeVisible({ timeout: 5000 });
    await deleteBtn.first().click();

    // Snapshot should be removed — list should show empty message
    await expect(panelPage.locator('.snapshot-empty')).toBeVisible({ timeout: 3000 });

    await panelPage.close();
  });
});
