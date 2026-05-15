import { isAuthRelated } from '@wolfcola/devtools-core';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

declare global {
  var __wolfcola_xhr_patched: boolean | undefined;
  var __wolfcola_original_xhr_open: typeof XMLHttpRequest.prototype.open | undefined;
  var __wolfcola_original_xhr_send: typeof XMLHttpRequest.prototype.send | undefined;
}

export function installXhrInterceptor(onEntry: (entry: HarEntry) => void): void {
  if (globalThis.__wolfcola_xhr_patched) return;
  if (typeof XMLHttpRequest === 'undefined') return;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  globalThis.__wolfcola_original_xhr_open = originalOpen;
  globalThis.__wolfcola_original_xhr_send = originalSend;
  globalThis.__wolfcola_xhr_patched = true;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as unknown as { _wolfcola_method: string })._wolfcola_method = method;
    (this as unknown as { _wolfcola_url: string })._wolfcola_url =
      typeof url === 'string' ? url : url.href;
    return originalOpen.call(this, method, url, ...(rest as [boolean?, string?, string?]));
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const url = (this as unknown as { _wolfcola_url: string })._wolfcola_url;
    const method = (this as unknown as { _wolfcola_method: string })._wolfcola_method;
    const start = performance.now();
    this.addEventListener('loadend', () => {
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
          ...(this.responseText ? { content: { text: this.responseText } } : {}),
        },
        time: performance.now() - start,
      };
      onEntry(entry);
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
