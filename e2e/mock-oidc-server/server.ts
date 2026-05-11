import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('mock-signature').toString('base64url');
  return `${header}.${body}.${sig}`;
}

export async function createMockOidcServer(
  port: number,
): Promise<{ server: Server; baseUrl: string }> {
  const app = new Hono();

  app.get('/.well-known/openid-configuration', (c) => {
    const base = new URL(c.req.url).origin;
    return c.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      userinfo_endpoint: `${base}/userinfo`,
      jwks_uri: `${base}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  app.get('/authorize', (c) => {
    const redirectUri = c.req.query('redirect_uri')!;
    const state = c.req.query('state') ?? '';
    const code = `mock-auth-code-${Date.now()}`;
    const separator = redirectUri.includes('?') ? '&' : '?';
    return c.redirect(
      `${redirectUri}${separator}code=${code}&state=${state}`,
      302,
    );
  });

  app.post('/token', (c) => {
    const base = new URL(c.req.url).origin;
    const now = Math.floor(Date.now() / 1000);
    return c.json({
      access_token: makeJwt({
        sub: 'user-123',
        iss: base,
        exp: now + 3600,
        iat: now,
      }),
      id_token: makeJwt({
        sub: 'user-123',
        iss: base,
        aud: 'test-client',
        exp: now + 3600,
        iat: now,
        nonce: 'test-nonce',
      }),
      token_type: 'Bearer',
      expires_in: 3600,
    });
  });

  app.get('/userinfo', (c) => {
    return c.json({
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    });
  });

  app.get('/test-app', (c) => {
    const html = readFileSync(
      path.join(import.meta.dirname, '../fixtures/test-page.html'),
      'utf8',
    );
    return c.html(html);
  });

  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port }, () => {
      const addr = server.address();
      const actualPort =
        port === 0 && typeof addr === 'object' && addr !== null
          ? addr.port
          : port;
      resolve({ server, baseUrl: `http://localhost:${actualPort}` });
    });
  });
}
