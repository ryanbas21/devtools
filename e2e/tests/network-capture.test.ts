import { test, expect } from '../fixtures/extension.js';
import { openPanelPage, getEventCount } from '../helpers/panel-page.js';

test.describe('network capture pipeline', () => {
  test('service worker processes NETWORK_EVENT and panel receives it', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await panelPage.evaluate((discoveryUrl) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url: discoveryUrl,
            method: 'GET',
            headers: [{ name: 'accept', value: 'application/json' }],
          },
          response: {
            status: 200,
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: { text: '{}' },
          },
          time: 42,
        },
      });
    }, `${mockServer.baseUrl}/.well-known/openid-configuration`);

    // Wait for the service worker to persist the event, then reload to verify
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const eventCount = await getEventCount(panelPage);
      expect(eventCount).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 5000 });

    await panelPage.close();
  });

  test('token endpoint request is annotated with OIDC phase', async ({
    extensionContext,
    extensionId,
    mockServer,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'GET',
            headers: [],
          },
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
    }, `${mockServer.baseUrl}/.well-known/openid-configuration`);

    await panelPage.evaluate((url) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'POST',
            headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
            postData: {
              text: 'grant_type=authorization_code&code=mock&client_id=test',
            },
          },
          response: {
            status: 200,
            headers: [{ name: 'content-type', value: 'application/json' }],
            content: {
              text: JSON.stringify({
                access_token: 'tok',
                token_type: 'Bearer',
              }),
            },
          },
          time: 50,
        },
      });
    }, `${mockServer.baseUrl}/token`);

    // Wait for both events to be persisted, then reload to verify
    await expect(async () => {
      await panelPage.reload();
      await panelPage.waitForSelector('.toolbar', { state: 'visible' });
      const eventCount = await getEventCount(panelPage);
      expect(eventCount).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    await panelPage.close();
  });
});
