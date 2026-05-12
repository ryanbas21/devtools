import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount } from '../helpers/panel-page.js';

test.describe('CORS flag detection', () => {
  test('network event with missing CORS headers shows CORS badge', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const base = mockServer.baseUrl;

    // First send discovery so the token endpoint is recognised as auth-related
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

    // Send a cross-origin token request with NO CORS response headers
    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'POST',
            headers: [
              { name: 'content-type', value: 'application/x-www-form-urlencoded' },
              { name: 'origin', value: 'https://app.example.com' },
            ],
            postData: { text: 'grant_type=authorization_code&code=c&client_id=test' },
          },
          response: {
            status: 200,
            // Intentionally no access-control-allow-origin header
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: {
              text: JSON.stringify({ access_token: 'tok', token_type: 'Bearer' }),
            },
          },
          time: 40,
        },
      });
    }, `${base}/token`);

    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    // The CORS badge should appear on at least one event
    const corsBadges = panelPage.locator('.tag-cors');
    await expect(corsBadges.first()).toBeVisible({ timeout: 3000 });

    await panelPage.close();
  });
});
