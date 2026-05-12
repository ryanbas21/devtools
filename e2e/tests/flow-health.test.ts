import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';
import { injectDiscovery, injectCorsViolation } from '../helpers/inject-events.js';

test.describe('flow health panel', () => {
  test('diagnosis issues appear when CORS violation events exist', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject events while the panel is open and listening for PANEL_EVENT
    // broadcasts. This is required because diagnosis is only delivered via
    // the PANEL_EVENT broadcast, not on GET_STATE rehydration.
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectCorsViolation(panelPage, mockServer.baseUrl);

    // Wait for the flow health panel to appear (diagnosis broadcast arrives)
    const fhPanel = panelPage.locator('.fh-panel');
    await expect(fhPanel).toBeVisible({ timeout: 5000 });

    // Should have a title and summary
    await expect(fhPanel.locator('.fh-title', { hasText: 'Flow Health' })).toBeVisible();
    await expect(fhPanel.locator('.fh-summary')).toBeVisible();

    // Should have at least one issue
    const issues = fhPanel.locator('.fh-issue');
    await expect(issues.first()).toBeVisible();

    // Issues should have category, title, and description
    await expect(fhPanel.locator('.fh-issue-cat').first()).toBeVisible();
    await expect(fhPanel.locator('.fh-issue-title').first()).toBeVisible();
    await expect(fhPanel.locator('.fh-issue-desc').first()).toBeVisible();

    await panelPage.close();
  });

  test('flow health panel collapse/expand toggle works', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectCorsViolation(panelPage, mockServer.baseUrl);

    const fhPanel = panelPage.locator('.fh-panel');
    await expect(fhPanel).toBeVisible({ timeout: 5000 });

    // Issues should be visible initially (auto-expanded on error)
    const issuesList = fhPanel.locator('.fh-issues');
    await expect(issuesList).toBeVisible();

    // Click collapse button
    const collapseBtn = fhPanel.locator('.fh-collapse-btn');
    await collapseBtn.click();

    // Issues should be hidden
    await expect(issuesList).not.toBeVisible();

    // Click again to expand
    await collapseBtn.click();
    await expect(issuesList).toBeVisible();

    await panelPage.close();
  });

  test('clicking a flow issue selects the related event', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectCorsViolation(panelPage, mockServer.baseUrl);

    const fhPanel = panelPage.locator('.fh-panel');
    await expect(fhPanel).toBeVisible({ timeout: 5000 });

    // Click the first issue
    const firstIssue = fhPanel.locator('.fh-issue').first();
    await firstIssue.click();

    // A timeline row should become selected (has .sel class)
    const selectedRow = panelPage.locator('.tl-row.sel');
    await expect(selectedRow).toBeVisible({ timeout: 2000 });

    await panelPage.close();
  });
});
