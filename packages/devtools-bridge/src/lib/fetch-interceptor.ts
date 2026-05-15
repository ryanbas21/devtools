import { isAuthRelated } from '@wolfcola/devtools-core';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

declare global {
  var __wolfcola_fetch_patched: boolean | undefined;

  var __wolfcola_original_fetch: typeof fetch | undefined;
}

function headersToHar(headers: Headers | HeadersInit | undefined): HarHeader[] {
  if (!headers) return [];
  const h = headers instanceof Headers ? headers : new Headers(headers as Record<string, string>);
  const result: HarHeader[] = [];
  h.forEach((value, name) => result.push({ name, value }));
  return result;
}

export function installFetchInterceptor(onEntry: (entry: HarEntry) => void): void {
  if (globalThis.__wolfcola_fetch_patched) return;

  const original = globalThis.fetch;
  globalThis.__wolfcola_original_fetch = original;
  globalThis.__wolfcola_fetch_patched = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

    const start = performance.now();
    const response = await original(input, init);
    const duration = performance.now() - start;

    if (isAuthRelated(url)) {
      const bodyText = typeof init?.body === 'string' ? init.body : undefined;
      const cloned = response.clone();
      const responseText = await cloned.text().catch(() => undefined);

      const entry: HarEntry = {
        request: {
          url,
          method: method.toUpperCase(),
          headers: headersToHar(init?.headers),
          ...(bodyText ? { postData: { text: bodyText } } : {}),
        },
        response: {
          status: response.status,
          headers: headersToHar(response.headers),
          ...(responseText ? { content: { text: responseText } } : {}),
        },
        time: duration,
      };
      onEntry(entry);
    }

    return response;
  };
}

export function uninstallFetchInterceptor(): void {
  if (globalThis.__wolfcola_original_fetch) {
    globalThis.fetch = globalThis.__wolfcola_original_fetch;
  }
  globalThis.__wolfcola_fetch_patched = undefined;
  globalThis.__wolfcola_original_fetch = undefined;
}
