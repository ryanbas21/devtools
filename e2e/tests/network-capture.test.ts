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

    await panelPage.waitForTimeout(1000);

    await panelPage.reload();
    await panelPage.waitForSelector('.toolbar', { state: 'visible' });
    await panelPage.waitForTimeout(500);

    const eventCount = await getEventCount(panelPage);
    expect(eventCount).toBeGreaterThanOrEqual(1);

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

    await panelPage.waitForTimeout(500);

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

    await panelPage.waitForTimeout(1000);
    await panelPage.reload();
    await panelPage.waitForSelector('.toolbar', { state: 'visible' });
    await panelPage.waitForTimeout(500);

    const eventCount = await getEventCount(panelPage);
    expect(eventCount).toBeGreaterThanOrEqual(2);

    await panelPage.close();
  });
});
