import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount, hasOidcBadge } from '../helpers/panel-page.js';

/**
 * Sends a well-known discovery response followed by a token and userinfo
 * request, then verifies the panel annotates each with the correct OIDC phase.
 */
test.describe('OIDC flow annotation', () => {
  test('discovery + token + userinfo events receive OIDC phase badges', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const base = mockServer.baseUrl;

    // 1. Discovery
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
          time: 10,
        },
      });
    }, `${base}/.well-known/openid-configuration`);

    // 2. Token exchange
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

    // 3. Userinfo
    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'GET',
            headers: [{ name: 'authorization', value: 'Bearer tok' }],
          },
          response: {
            status: 200,
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: {
              text: JSON.stringify({ sub: 'user-123', email: 'test@example.com' }),
            },
          },
          time: 30,
        },
      });
    }, `${base}/userinfo`);

    // Reload panel to pick up persisted events, then verify annotations
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 5000 });

    // Verify OIDC phase badges
    expect(await hasOidcBadge(panelPage, 'discovery')).toBe(true);
    expect(await hasOidcBadge(panelPage, 'token')).toBe(true);
    expect(await hasOidcBadge(panelPage, 'userinfo')).toBe(true);

    await panelPage.close();
  });
});
