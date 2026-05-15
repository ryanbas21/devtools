import http from 'node:http';
import https from 'node:https';
import { isAuthRelated } from '@wolfcola/devtools-core';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

declare global {
  var __wolfcola_http_patched: boolean | undefined;
  var __wolfcola_original_http_request: typeof http.request | undefined;
  var __wolfcola_original_https_request: typeof https.request | undefined;
}

function patchModule(
  mod: typeof http | typeof https,
  protocol: string,
  onEntry: (entry: HarEntry) => void,
): typeof http.request {
  const original = mod.request;
  return function patchedRequest(...args: Parameters<typeof http.request>) {
    const req = original.apply(mod, args);
    const opts = typeof args[0] === 'string' ? new URL(args[0]) : args[0];
    const url =
      typeof args[0] === 'string'
        ? args[0]
        : `${protocol}//${(opts as http.RequestOptions).hostname ?? 'localhost'}${(opts as http.RequestOptions).path ?? '/'}`;
    const method = ((opts as http.RequestOptions).method ?? 'GET').toUpperCase();

    if (!isAuthRelated(url)) return req;

    const chunks: Buffer[] = [];
    const originalWrite = req.write.bind(req);
    const start = performance.now();

    req.write = function (chunk: unknown, ...rest: unknown[]) {
      if (Buffer.isBuffer(chunk)) chunks.push(chunk);
      else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
      return originalWrite(chunk, ...(rest as [BufferEncoding?, (() => void)?]));
    };

    req.on('response', (res: http.IncomingMessage) => {
      const responseChunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => responseChunks.push(chunk));
      res.on('end', () => {
        const responseHeaders: HarHeader[] = [];
        const rawHeaders = res.rawHeaders;
        for (let i = 0; i < rawHeaders.length; i += 2) {
          responseHeaders.push({ name: rawHeaders[i], value: rawHeaders[i + 1] });
        }
        const requestBody = Buffer.concat(chunks).toString('utf-8');
        const responseBody = Buffer.concat(responseChunks).toString('utf-8');
        const entry: HarEntry = {
          request: {
            url,
            method,
            headers: [],
            ...(requestBody ? { postData: { text: requestBody } } : {}),
          },
          response: {
            status: res.statusCode ?? 0,
            headers: responseHeaders,
            ...(responseBody ? { content: { text: responseBody } } : {}),
          },
          time: performance.now() - start,
        };
        onEntry(entry);
      });
    });
    return req;
  } as typeof http.request;
}

export function installNodeHttpInterceptor(onEntry: (entry: HarEntry) => void): void {
  if (globalThis.__wolfcola_http_patched) return;
  globalThis.__wolfcola_original_http_request = http.request;
  globalThis.__wolfcola_original_https_request = https.request;
  globalThis.__wolfcola_http_patched = true;
  http.request = patchModule(http, 'http:', onEntry);
  https.request = patchModule(https, 'https:', onEntry);
}

export function uninstallNodeHttpInterceptor(): void {
  if (globalThis.__wolfcola_original_http_request)
    http.request = globalThis.__wolfcola_original_http_request;
  if (globalThis.__wolfcola_original_https_request)
    https.request = globalThis.__wolfcola_original_https_request;
  globalThis.__wolfcola_http_patched = undefined;
  globalThis.__wolfcola_original_http_request = undefined;
  globalThis.__wolfcola_original_https_request = undefined;
}
