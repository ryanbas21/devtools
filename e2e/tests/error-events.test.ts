import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount } from '../helpers/panel-page.js';

test.describe('error event rendering', () => {
  test('network event with 4xx status renders with warning styling', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const base = mockServer.baseUrl;

    // Send discovery first so endpoints are recognised
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

    // Send a failed token request (401)
    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'POST',
            headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
            postData: { text: 'grant_type=authorization_code&code=bad&client_id=test' },
          },
          response: {
            status: 401,
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: {
              text: JSON.stringify({ error: 'invalid_grant', error_description: 'Code expired' }),
            },
          },
          time: 30,
        },
      });
    }, `${base}/token`);

    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    // 4xx renders with st-warn (st-err is reserved for status 0 / network failures)
    const warnStatus = panelPage.locator('.st-warn');
    await expect(warnStatus.first()).toBeVisible({ timeout: 3000 });

    await panelPage.close();
  });

  test('5xx server error is flagged', async ({ extensionContext, extensionId, mockServer }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const base = mockServer.baseUrl;

    // Discovery
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
              }),
            },
          },
          time: 5,
        },
      });
    }, `${base}/.well-known/openid-configuration`);

    // 500 on token endpoint
    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'POST',
            headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
            postData: { text: 'grant_type=authorization_code&code=x&client_id=test' },
          },
          response: {
            status: 500,
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: { text: JSON.stringify({ error: 'server_error' }) },
          },
          time: 30,
        },
      });
    }, `${base}/token`);

    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const count = await getEventCount(panelPage);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    const warnStatus = panelPage.locator('.st-warn');
    await expect(warnStatus.first()).toBeVisible({ timeout: 3000 });

    await panelPage.close();
  });
});
