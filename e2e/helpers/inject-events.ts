import type { Page } from '@playwright/test';

/**
 * Sends a well-known discovery response through the extension's message handler.
 * This seeds the OIDC config so subsequent token/userinfo requests are annotated.
 */
export async function injectDiscovery(page: Page, baseUrl: string): Promise<void> {
  await page.evaluate((url) => {
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
  }, `${baseUrl}/.well-known/openid-configuration`);
}

/**
 * Sends a token exchange request through the extension's message handler.
 */
export async function injectTokenRequest(
  page: Page,
  baseUrl: string,
  opts: { status?: number; body?: Record<string, unknown>; corsHeaders?: boolean } = {},
): Promise<void> {
  const status = opts.status ?? 200;
  const body = opts.body ?? { access_token: 'tok', token_type: 'Bearer', expires_in: 3600 };
  const responseHeaders: Array<{ name: string; value: string }> = [
    { name: 'content-type', value: 'application/json' },
  ];
  if (opts.corsHeaders) {
    responseHeaders.push({ name: 'access-control-allow-origin', value: '*' });
  }

  await page.evaluate(
    ({ url, status, body, responseHeaders }) => {
      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        payload: {
          request: {
            url,
            method: 'POST',
            headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
            postData: { text: 'grant_type=authorization_code&code=mock&client_id=test' },
          },
          response: { status, headers: responseHeaders, content: { text: JSON.stringify(body) } },
          time: 50,
        },
      });
    },
    { url: `${baseUrl}/token`, status, body, responseHeaders },
  );
}

/**
 * Sends a userinfo request through the extension's message handler.
 */
export async function injectUserinfo(page: Page, baseUrl: string): Promise<void> {
  await page.evaluate((url) => {
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
  }, `${baseUrl}/userinfo`);
}

/**
 * Sends a token request with an Origin header but no CORS response headers.
 */
export async function injectCorsViolation(page: Page, baseUrl: string): Promise<void> {
  await page.evaluate((url) => {
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
          headers: [{ name: 'content-type', value: 'application/json' }],
          content: { text: JSON.stringify({ access_token: 'tok', token_type: 'Bearer' }) },
        },
        time: 40,
      },
    });
  }, `${baseUrl}/token`);
}

/**
 * Creates an SDK event payload.
 */
export function makeSdkEvent(id: string, flowId: string) {
  return {
    type: 'sdk:node-change',
    id,
    flowId,
    timestamp: Date.now(),
    source: 'sdk',
    causedBy: null,
    data: { _tag: 'sdk', nodeStatus: 'continue' },
    flags: { isCors: false, isError: false, isAuthRelated: true },
  };
}

/**
 * Injects an SDK event via chrome.runtime.sendMessage.
 */
export async function injectSdkEvent(page: Page, id: string, flowId: string): Promise<void> {
  await page.evaluate(
    (event) => chrome.runtime.sendMessage({ type: 'SDK_EVENT', payload: event }),
    makeSdkEvent(id, flowId),
  );
}

/**
 * Reloads the panel and waits for at least `minCount` events to appear.
 */
export async function reloadAndWaitForEvents(
  page: Page,
  minCount: number,
  timeoutMs = 5000,
): Promise<void> {
  const { expect } = await import('@playwright/test');
  await expect(async () => {
    await page.reload();
    await page.waitForSelector('.toolbar', { state: 'visible' });
    const count = await page.locator('.tl-row').count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }).toPass({ timeout: timeoutMs });
}
