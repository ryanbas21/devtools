import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installFetchInterceptor, uninstallFetchInterceptor } from './fetch-interceptor.js';
import type { HarEntry } from '@wolfcola/devtools-core';

describe('fetchInterceptor', () => {
  let originalFetch: typeof globalThis.fetch;
  let capturedEntries: HarEntry[];

  beforeEach(() => {
    capturedEntries = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'tok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    uninstallFetchInterceptor();
    globalThis.fetch = originalFetch;
  });

  it('captures auth-related requests and calls onEntry', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://auth.example.com/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&code=abc',
    });
    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].request.url).toBe('https://auth.example.com/oauth2/token');
    expect(capturedEntries[0].request.method).toBe('POST');
    expect(capturedEntries[0].response.status).toBe(200);
  });

  it('skips non-auth-related requests', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://api.example.com/users');
    expect(capturedEntries).toHaveLength(0);
  });

  it('skips static asset URLs', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://cdn.example.com/bundle.js');
    expect(capturedEntries).toHaveLength(0);
  });

  it('is idempotent -- does not double-patch', async () => {
    const cb = vi.fn();
    installFetchInterceptor(cb);
    installFetchInterceptor(cb);
    await globalThis.fetch('https://auth.example.com/token');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('captures request body as postData.text', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://auth.example.com/token', {
      method: 'POST',
      body: 'grant_type=client_credentials',
    });
    expect(capturedEntries[0].request.postData?.text).toBe('grant_type=client_credentials');
  });

  it('captures response body as content.text', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://auth.example.com/token');
    expect(capturedEntries[0].response.content?.text).toContain('access_token');
  });

  it('preserves original fetch behavior -- returns same response', async () => {
    installFetchInterceptor(() => {});
    const res = await globalThis.fetch('https://auth.example.com/token');
    const body = await res.json();
    expect(body.access_token).toBe('tok');
  });

  it('still works when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await expect(globalThis.fetch('https://auth.example.com/token')).rejects.toThrow(
      'Network error',
    );
    expect(capturedEntries).toHaveLength(0);
  });
});
