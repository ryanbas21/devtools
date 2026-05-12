import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';
import {
  injectDiscovery,
  injectTokenRequest,
  injectCorsViolation,
  reloadAndWaitForEvents,
} from '../helpers/inject-events.js';

test.describe('event selection and inspector', () => {
  test('clicking a timeline row populates the inspector headers tab', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject live so we can identify events by their OIDC badge
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);

    // Wait for the token badge to appear, then click its parent row
    const tokenBadge = panelPage.locator('.tag-oidc', { hasText: 'token' }).first();
    await expect(tokenBadge).toBeVisible({ timeout: 5000 });
    await tokenBadge.locator('xpath=ancestor::div[contains(@class,"tl-row")]').click();

    // Inspector should show Headers tab with URL and Method
    const inspBody = panelPage.locator('.insp-body');
    await expect(inspBody).toBeVisible();
    await expect(inspBody.locator('.kv-key', { hasText: 'URL' })).toBeVisible();
    await expect(inspBody.locator('.kv-key', { hasText: 'Method' })).toBeVisible();

    await panelPage.close();
  });

  test('inspector shows OIDC tab for annotated events', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // Select the token event
    await panelPage.locator('.tl-row').nth(1).click();

    // OIDC tab should appear
    const oidcTab = panelPage.locator('.tab-btn', { hasText: 'OIDC' });
    await expect(oidcTab).toBeVisible();
    await oidcTab.click();

    // Should show OIDC phase info
    await expect(panelPage.locator('.kv-key', { hasText: 'Phase' })).toBeVisible();

    await panelPage.close();
  });

  test('inspector CORS tab shows issue for flagged events', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject live so CORS flags are preserved via PANEL_EVENT broadcast
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectCorsViolation(panelPage, mockServer.baseUrl);

    // Wait for the CORS badge to appear, then click its parent row
    const corsBadge = panelPage.locator('.tag-cors').first();
    await expect(corsBadge).toBeVisible({ timeout: 5000 });
    // The badge is inside a .tl-row — click the row
    await corsBadge.locator('xpath=ancestor::div[contains(@class,"tl-row")]').click();

    // Switch to CORS tab — use a retry loop because Elm may re-render
    // after the row click (e.g. DiagnosisReceived arrives) which can
    // reset the tab. Keep clicking until it sticks.
    await expect(async () => {
      const corsTab = panelPage.locator('.tab-btn', { hasText: 'CORS' });
      await corsTab.click();
      await expect(corsTab).toHaveClass(/active/, { timeout: 1000 });
    }).toPass({ timeout: 5000 });

    // Should show CORS issue text
    await expect(panelPage.locator('.insp-body')).toContainText('CORS issue detected', {
      timeout: 3000,
    });

    await panelPage.close();
  });

  test('inspector tab switching works across Headers, Cookies, CORS', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 1);

    // Select the first event
    await panelPage.locator('.tl-row').first().click();

    // Switch through tabs and verify each becomes active
    for (const tabName of ['Headers', 'Cookies', 'CORS', 'SDK State']) {
      const tab = panelPage.locator('.tab-btn', { hasText: tabName });
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveClass(/active/);
    }

    await panelPage.close();
  });
});
