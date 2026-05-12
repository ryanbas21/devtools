import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';
import {
  injectDiscovery,
  injectSdkEvent,
  reloadAndWaitForEvents,
} from '../helpers/inject-events.js';

test.describe('view mode switching', () => {
  test('Timeline, Flow, and Learn mode buttons toggle views', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject some events so views have content
    await injectDiscovery(panelPage, mockServer.baseUrl);
    await injectSdkEvent(panelPage, `vm-1-${Date.now()}`, 'vm-flow');
    await reloadAndWaitForEvents(panelPage, 1);

    // Should start in Timeline mode (default)
    const timelineBtn = panelPage.locator('.tb-mode-btn', { hasText: 'Timeline' });
    await expect(timelineBtn).toHaveClass(/active/);

    // Timeline-specific elements should be visible
    await expect(panelPage.locator('.timeline-panel')).toBeVisible();

    // Switch to Flow mode
    const flowBtn = panelPage.locator('.tb-mode-btn', { hasText: 'Flow' });
    await flowBtn.click();
    await expect(flowBtn).toHaveClass(/active/);
    await expect(timelineBtn).not.toHaveClass(/active/);

    // Flow view should be visible
    await expect(panelPage.locator('.fv-view')).toBeVisible();
    // Timeline should not
    await expect(panelPage.locator('.timeline-panel')).not.toBeVisible();

    // Switch to Learn mode
    const learnBtn = panelPage.locator('.tb-mode-btn', { hasText: 'Learn' });
    await learnBtn.click();
    await expect(learnBtn).toHaveClass(/active/);
    await expect(flowBtn).not.toHaveClass(/active/);

    // Learn canvas should be visible
    await expect(panelPage.locator('.lv-canvas')).toBeVisible();

    // Switch back to Timeline
    await timelineBtn.click();
    await expect(timelineBtn).toHaveClass(/active/);
    await expect(panelPage.locator('.timeline-panel')).toBeVisible();

    await panelPage.close();
  });
});
