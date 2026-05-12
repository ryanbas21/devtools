import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';
import {
  injectDiscovery,
  injectTokenRequest,
  injectSdkEvent,
  reloadAndWaitForEvents,
} from '../helpers/inject-events.js';

test.describe('connection status indicators', () => {
  test('shows "OIDC detected" after OIDC network events', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // "OIDC detected" indicator should appear in the toolbar
    await expect(panelPage.locator('.flow-chip', { hasText: 'OIDC detected' })).toBeVisible();

    await panelPage.close();
  });

  test('shows "SDK connected" after SDK events', async ({ extensionContext, extensionId }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectSdkEvent(panelPage, `conn-1-${Date.now()}`, 'conn-flow');
    await reloadAndWaitForEvents(panelPage, 1);

    // "SDK connected" indicator should appear
    await expect(panelPage.locator('.flow-chip', { hasText: 'SDK connected' })).toBeVisible();

    await panelPage.close();
  });

  test('shows event count in timeline mode toolbar', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectTokenRequest(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 2);

    // Event count badge should show in toolbar
    const eventCount = panelPage.locator('.event-count');
    await expect(eventCount).toBeVisible();
    await expect(eventCount).toContainText('events');

    await panelPage.close();
  });

  test('shows flow chip with flow ID', async ({ extensionContext, extensionId, mockServer }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await reloadAndWaitForEvents(panelPage, 1);

    // Flow chip with truncated ID should appear
    const flowChip = panelPage.locator('.flow-chip-id').first();
    await expect(flowChip).toBeVisible();

    await panelPage.close();
  });
});
