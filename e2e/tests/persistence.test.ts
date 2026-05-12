import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount } from '../helpers/panel-page.js';

const makeSdkEvent = (id: string, flowId: string) => ({
  type: 'sdk:node-change',
  id,
  flowId,
  timestamp: Date.now(),
  source: 'sdk',
  causedBy: null,
  data: { _tag: 'sdk', nodeStatus: 'continue' },
  flags: { isCors: false, isError: false, isAuthRelated: true },
});

test.describe('event persistence and rehydration', () => {
  test('events survive panel close and reopen', async ({ extensionContext, extensionId }) => {
    const uniqueId = `persist-${Date.now()}`;
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject events
    for (let i = 0; i < 3; i++) {
      await panelPage.evaluate(
        (event) => chrome.runtime.sendMessage({ type: 'SDK_EVENT', payload: event }),
        makeSdkEvent(`${uniqueId}-${i}`, `flow-${uniqueId}`),
      );
    }

    // Wait for persistence
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 5000 });

    const countBefore = await getEventCount(panelPage);

    // Close the panel entirely
    await panelPage.close();

    // Reopen: the service worker rehydrates from chrome.storage.local
    const freshPage = await extensionContext.newPage();
    await openPanelPage(freshPage, extensionId);

    // GET_STATE triggers on panel load, so events should reappear
    await expect(async () => {
      await freshPage.reload();
      await freshPage.waitForSelector('.toolbar', { state: 'visible' });
      const countAfter = await getEventCount(freshPage);
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    }).toPass({ timeout: 5000 });

    await freshPage.close();
  });
});
