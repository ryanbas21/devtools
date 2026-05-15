import { isAuthRelated } from '@wolfcola/devtools-core';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

declare global {
  var __wolfcola_xhr_patched: boolean | undefined;
  var __wolfcola_original_xhr_open: typeof XMLHttpRequest.prototype.open | undefined;
  var __wolfcola_original_xhr_send: typeof XMLHttpRequest.prototype.send | undefined;
}

const xhrMeta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

export function installXhrInterceptor(onEntry: (entry: HarEntry) => void): void {
  if (globalThis.__wolfcola_xhr_patched) return;
  if (typeof XMLHttpRequest === 'undefined') return;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  globalThis.__wolfcola_original_xhr_open = originalOpen;
  globalThis.__wolfcola_original_xhr_send = originalSend;
  globalThis.__wolfcola_xhr_patched = true;

  // XMLHttpRequest.open has multiple overloaded signatures that make typed
  // forwarding impractical. We capture method/url in a WeakMap and forward
  // the original arguments unchanged.
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
  ) {
    xhrMeta.set(this, { method, url: typeof url === 'string' ? url : url.href });
    // eslint-disable-next-line prefer-rest-params
    return originalOpen.apply(this, arguments as unknown as Parameters<typeof originalOpen>);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = xhrMeta.get(this);
    const url = meta?.url ?? '';
    const method = meta?.method ?? 'GET';
    const start = performance.now();
    this.addEventListener('loadend', () => {
      try {
        if (!isAuthRelated(url)) return;
        const responseHeaders: HarHeader[] = [];
        const rawHeaders = this.getAllResponseHeaders();
        rawHeaders.split('\r\n').forEach((line) => {
          const idx = line.indexOf(':');
          if (idx > 0) {
            responseHeaders.push({
              name: line.slice(0, idx).trim(),
              value: line.slice(idx + 1).trim(),
            });
          }
        });
        let responseText: string | undefined;
        try {
          responseText = this.responseText;
        } catch {
          // responseType is not '' or 'text', cannot read responseText
        }
        const entry: HarEntry = {
          request: {
            url,
            method: method.toUpperCase(),
            headers: [],
            ...(typeof body === 'string' ? { postData: { text: body } } : {}),
          },
          response: {
            status: this.status,
            headers: responseHeaders,
            ...(responseText ? { content: { text: responseText } } : {}),
          },
          time: performance.now() - start,
        };
        onEntry(entry);
      } catch (e) {
        console.warn('[wolfcola] Error in XHR interceptor:', e);
      }
    });
    return originalSend.call(this, body);
  };
}

export function uninstallXhrInterceptor(): void {
  if (globalThis.__wolfcola_original_xhr_open && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.open = globalThis.__wolfcola_original_xhr_open;
  }
  if (globalThis.__wolfcola_original_xhr_send && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.send = globalThis.__wolfcola_original_xhr_send;
  }
  globalThis.__wolfcola_xhr_patched = undefined;
  globalThis.__wolfcola_original_xhr_open = undefined;
  globalThis.__wolfcola_original_xhr_send = undefined;
}
