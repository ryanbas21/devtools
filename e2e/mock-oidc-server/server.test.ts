import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { createMockOidcServer } = await import('./server.js');
  const result = await createMockOidcServer(0);
  server = result.server;
  baseUrl = result.baseUrl;
});

afterAll(() => {
  server?.close();
});

describe('mock OIDC server', () => {
  it('serves well-known openid-configuration', async () => {
    const res = await fetch(`${baseUrl}/.well-known/openid-configuration`);
    expect(res.status).toBe(200);
    const config = await res.json();
    expect(config.issuer).toBe(baseUrl);
    expect(config.authorization_endpoint).toBe(`${baseUrl}/authorize`);
    expect(config.token_endpoint).toBe(`${baseUrl}/token`);
  });

  it('returns an authorization code from /authorize', async () => {
    const res = await fetch(
      `${baseUrl}/authorize?response_type=code&client_id=test-client&redirect_uri=${encodeURIComponent(`${baseUrl}/callback`)}&state=abc123&code_challenge=challenge&code_challenge_method=S256`,
      { redirect: 'manual' },
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toContain('code=');
    expect(location).toContain('state=abc123');
  });

  it('exchanges code for tokens at /token', async () => {
    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&code=mock-code&client_id=test-client&code_verifier=verifier',
    });
    expect(res.status).toBe(200);
    const tokens = await res.json();
    expect(tokens.access_token).toBeDefined();
    expect(tokens.id_token).toBeDefined();
    expect(tokens.token_type).toBe('Bearer');
  });

  it('serves a test page at /test-app', async () => {
    const res = await fetch(`${baseUrl}/test-app`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('OIDC Test App');
  });
});
