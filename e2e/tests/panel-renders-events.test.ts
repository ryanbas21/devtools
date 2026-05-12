import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';

const makeSdkEvent = (id: string, flowId: string) => ({
  type: 'sdk:node-change',
  id,
  flowId,
  timestamp: Date.now(),
  source: 'sdk',
  causedBy: null,
  data: {
    _tag: 'sdk',
    nodeStatus: 'continue',
  },
  flags: {
    isCors: false,
    isError: false,
    isAuthRelated: true,
  },
});

test.describe('panel renders events', () => {
  test('displays injected SDK event in timeline', async ({ extensionContext, extensionId }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Count existing rows before injecting
    const before = await panelPage.locator('.tl-row').count();

    await panelPage.evaluate(
      (event) => {
        chrome.runtime.sendMessage({ type: 'SDK_EVENT', payload: event });
      },
      makeSdkEvent('test-sdk-1', 'test-flow-sdk-1'),
    );

    // Wait for the event to be persisted, then reload to verify
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const after = await panelPage.locator('.tl-row').count();
      expect(after).toBeGreaterThan(before);
    }).toPass({ timeout: 5000 });

    await panelPage.close();
  });

  test('clear button resets the timeline', async ({ extensionContext, extensionId }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await panelPage.evaluate(
      (event) => {
        chrome.runtime.sendMessage({ type: 'SDK_EVENT', payload: event });
      },
      makeSdkEvent('test-sdk-clear', 'test-flow-clear'),
    );

    // Wait for event to appear
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const rows = await panelPage.locator('.tl-row').count();
      expect(rows).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    const clearBtn = panelPage.locator('.tb-btn', { hasText: 'Clear' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(panelPage.locator('.tl-row')).toHaveCount(0, { timeout: 3000 });

    await panelPage.close();
  });
});
