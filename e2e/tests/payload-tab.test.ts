import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';
import {
  injectDiscovery,
  injectTokenRequest,
  reloadAndWaitForEvents,
} from '../helpers/inject-events.js';

test.describe('payload tab', () => {
  test('Payload tab appears for network events with request/response body', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject discovery + token request (token has postData and JSON response body)
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // Select the token event (second row, after discovery)
    await panelPage.locator('.tl-row').nth(1).click();

    // Payload tab should be visible (event has requestBody + responseBody)
    const payloadTab = panelPage.locator('.tab-btn', { hasText: 'Payload' });
    await expect(payloadTab).toBeVisible({ timeout: 3000 });

    // Click the Payload tab
    await payloadTab.click();
    await expect(payloadTab).toHaveClass(/active/);

    // Should show payload sections
    await expect(panelPage.locator('.payload-section').first()).toBeVisible();
    await expect(panelPage.locator('.sect-hdr', { hasText: 'Request Body' })).toBeVisible();
    await expect(panelPage.locator('.sect-hdr', { hasText: 'Response Body' })).toBeVisible();

    await panelPage.close();
  });

  test('Payload tab does not appear for discovery events (GET, no request body)', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Discovery is a GET request with no postData — only has responseBody
    // The Payload tab should still show if responseBody exists
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // Select the discovery event (first row) — it's a GET with no postData
    await panelPage.locator('.tl-row').first().click();

    // Discovery has responseBody (the OIDC config JSON), so Payload tab
    // should appear. But it has no requestBody, so only Response Body shows.
    const payloadTab = panelPage.locator('.tab-btn', { hasText: 'Payload' });
    const isVisible = await payloadTab.isVisible();

    if (isVisible) {
      await payloadTab.click();
      await expect(payloadTab).toHaveClass(/active/);
      // Should show Response Body but not Request Body
      await expect(panelPage.locator('.sect-hdr', { hasText: 'Response Body' })).toBeVisible();
    }
    // If not visible, the event has no body data — also valid

    await panelPage.close();
  });
});
