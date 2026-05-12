import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount } from '../helpers/panel-page.js';

test.describe('export flow', () => {
  test('export dropdown is functional after events are captured', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const base = mockServer.baseUrl;

    // Inject a discovery + token flow so there's data to export
    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: { url, method: 'GET', headers: [] },
          response: {
            status: 200,
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: {
              text: JSON.stringify({
                issuer: new URL(url).origin,
                authorization_endpoint: new URL(url).origin + '/authorize',
                token_endpoint: new URL(url).origin + '/token',
                userinfo_endpoint: new URL(url).origin + '/userinfo',
              }),
            },
          },
          time: 5,
        },
      });
    }, `${base}/.well-known/openid-configuration`);

    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'POST',
            headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
            postData: { text: 'grant_type=authorization_code&code=mock&client_id=test' },
          },
          response: {
            status: 200,
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: {
              text: JSON.stringify({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }),
            },
          },
          time: 50,
        },
      });
    }, `${base}/token`);

    // Wait for events to persist
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    // Open the export dropdown
    const exportBtn = panelPage.locator('.tb-btn', { hasText: 'Export' });
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Verify both export options appear
    const jsonOption = panelPage.locator('.tb-dropdown-item', { hasText: 'Export JSON' });
    const mdOption = panelPage.locator('.tb-dropdown-item', { hasText: 'Export Markdown' });
    await expect(jsonOption).toBeVisible({ timeout: 2000 });
    await expect(mdOption).toBeVisible({ timeout: 2000 });

    // Grant clipboard permissions and click Export JSON
    await panelPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await jsonOption.click();

    // Verify clipboard contains valid JSON with expected structure
    const clipboardText = await panelPage.evaluate(() => navigator.clipboard.readText());
    const exported = JSON.parse(clipboardText);
    expect(exported).toHaveProperty('version', 1);
    expect(exported).toHaveProperty('exportedAt');
    expect(exported).toHaveProperty('redacted', true);
    expect(exported.flow).toHaveProperty('events');
    expect(exported.flow.events.length).toBeGreaterThanOrEqual(2);

    await panelPage.close();
  });
});
