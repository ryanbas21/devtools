import type { CdpClient } from './cdp-client.js';

export const SDK_BINDING_NAME = '__wolfcolaBridge';

export function getSdkInjectionScript(): string {
  return `
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === '__pingDevtools') {
        ${SDK_BINDING_NAME}(JSON.stringify(e.data));
      }
    });
  `;
}

export async function injectSdkCapture(cdp: CdpClient): Promise<void> {
  await cdp.send('Runtime.addBinding', { name: SDK_BINDING_NAME });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: getSdkInjectionScript(),
  });
}
