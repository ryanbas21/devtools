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

test.describe('multiple flow isolation', () => {
  test('events from different flows all appear in timeline', async ({
    extensionContext,
    extensionId,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const flowA = `flow-a-${Date.now()}`;
    const flowB = `flow-b-${Date.now()}`;

    // Inject events for two separate flows
    for (let i = 0; i < 2; i++) {
      await panelPage.evaluate(
        (event) => chrome.runtime.sendMessage({ type: 'SDK_EVENT', payload: event }),
        makeSdkEvent(`a-${i}-${Date.now()}`, flowA),
      );
    }
    for (let i = 0; i < 3; i++) {
      await panelPage.evaluate(
        (event) => chrome.runtime.sendMessage({ type: 'SDK_EVENT', payload: event }),
        makeSdkEvent(`b-${i}-${Date.now()}`, flowB),
      );
    }

    // Verify all 5 events appear
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(5);
    }).toPass({ timeout: 5000 });

    await panelPage.close();
  });
});
