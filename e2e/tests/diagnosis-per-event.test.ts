import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';
import { injectDiscovery, injectCorsViolation } from '../helpers/inject-events.js';

test.describe('per-event diagnosis tab', () => {
  test('diagnosis tab appears on events with issues', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject events live (without reloading) so diagnosis broadcasts arrive
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectCorsViolation(panelPage, mockServer.baseUrl);

    // Wait for the CORS badge to appear, then click its parent row
    const corsBadge = panelPage.locator('.tag-cors').first();
    await expect(corsBadge).toBeVisible({ timeout: 5000 });
    await corsBadge.locator('xpath=ancestor::div[contains(@class,"tl-row")]').click();

    // Diagnosis tab should appear with an indicator
    const diagTab = panelPage.locator('.tab-btn', { hasText: 'Diagnosis' });
    await expect(diagTab).toBeVisible({ timeout: 3000 });

    // Click it
    await diagTab.click();
    await expect(diagTab).toHaveClass(/active/);

    // Diagnosis content should show issue details
    const inspBody = panelPage.locator('.insp-body');
    await expect(inspBody.locator('.diag-title').first()).toBeVisible();

    await panelPage.close();
  });
});
