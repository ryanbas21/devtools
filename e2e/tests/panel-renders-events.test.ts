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

    await panelPage.waitForTimeout(500);
    await panelPage.reload();
    await panelPage.waitForSelector('.toolbar', { state: 'visible' });
    await panelPage.waitForTimeout(500);

    const after = await panelPage.locator('.tl-row').count();
    expect(after).toBeGreaterThan(before);

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

    await panelPage.waitForTimeout(500);
    await panelPage.reload();
    await panelPage.waitForSelector('.toolbar', { state: 'visible' });
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
