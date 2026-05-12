import { test, expect } from '../fixtures/extension.js';

test.describe('content script relay', () => {
  // This test may fail on first attempt when the browser context is cold —
  // Playwright's persistent context can delay content script injection on
  // the first navigation. The retry (configured in playwright.config.ts)
  // handles this reliably.
  test('content scripts are injected and bridge marker is set', async ({
    extensionContext,
    mockServer,
  }) => {
    // Navigate to a real page served by the mock server.
    // The extension's content scripts (content-script.js in MAIN world
    // and relay.js in isolated world) should be injected at document_idle.
    const appPage = await extensionContext.newPage();
    await appPage.goto(`${mockServer.baseUrl}/test-app`, { waitUntil: 'networkidle' });

    // Verify the content script's global marker is set.
    // content-script.ts runs in MAIN world and sets window.__PING_DEVTOOLS_EXTENSION__ = true
    await expect(async () => {
      const ready = await appPage.evaluate(() => window.__PING_DEVTOOLS_EXTENSION__);
      expect(ready).toBe(true);
    }).toPass({ timeout: 10_000 });

    // Verify the bridge protocol: dispatching 'pingDevtools' CustomEvent
    // triggers a postMessage with __pingDevtools flag. We intercept it
    // to prove the content script listener is active.
    const receivedMessage = await appPage.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const handler = (e: MessageEvent) => {
          if (e.data?.__pingDevtools) {
            window.removeEventListener('message', handler);
            resolve(true);
          }
        };
        window.addEventListener('message', handler);

        window.dispatchEvent(
          new CustomEvent('pingDevtools', {
            detail: { type: 'sdk:node-change', id: 'test', flowId: 'test' },
          }),
        );

        // Timeout fallback
        setTimeout(() => resolve(false), 3000);
      });
    });

    expect(receivedMessage).toBe(true);

    await appPage.close();
  });
});
