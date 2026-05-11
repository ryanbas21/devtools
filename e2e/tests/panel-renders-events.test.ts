import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';

test.describe('panel renders events', () => {
  test('displays injected SDK event in timeline', async ({ context, extensionId }) => {
    const panelPage = await context.newPage();
    await openPanelPage(panelPage, extensionId);

    await panelPage.evaluate(() => {
      chrome.runtime.sendMessage({
        type: 'SDK_EVENT',
        payload: {
          type: 'sdk:node-change',
          id: 'test-event-1',
          flowId: 'test-flow-1',
          timestamp: new Date().toISOString(),
          data: {
            status: 'start',
            nodeName: 'Login Form',
            collectors: [],
          },
        },
      });
    });

    await panelPage.waitForTimeout(500);

    await panelPage.reload();
    await panelPage.waitForSelector('#app', { state: 'attached' });
    await panelPage.waitForTimeout(500);

    const rows = panelPage.locator('.tl-row');
    await expect(rows).toHaveCount(1);

    await panelPage.close();
  });

  test('clear button resets the timeline', async ({ context, extensionId }) => {
    const panelPage = await context.newPage();
    await openPanelPage(panelPage, extensionId);

    await panelPage.evaluate(() => {
      chrome.runtime.sendMessage({
        type: 'SDK_EVENT',
        payload: {
          type: 'sdk:node-change',
          id: 'test-event-clear',
          flowId: 'test-flow-clear',
          timestamp: new Date().toISOString(),
          data: {
            status: 'start',
            nodeName: 'Test Node',
            collectors: [],
          },
        },
      });
    });

    await panelPage.waitForTimeout(500);
    await panelPage.reload();
    await panelPage.waitForSelector('#app', { state: 'attached' });
    await panelPage.waitForTimeout(500);

    let rows = await panelPage.locator('.tl-row').count();
    expect(rows).toBeGreaterThan(0);

    const clearBtn = panelPage.locator('.tb-btn', { hasText: 'Clear' });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await panelPage.waitForTimeout(500);

      rows = await panelPage.locator('.tl-row').count();
      expect(rows).toBe(0);
    }

    await panelPage.close();
  });
});
