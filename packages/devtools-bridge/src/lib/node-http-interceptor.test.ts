import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import {
  installNodeHttpInterceptor,
  uninstallNodeHttpInterceptor,
} from './node-http-interceptor.js';
import type { HarEntry } from '@wolfcola/devtools-core';

describe('nodeHttpInterceptor', () => {
  let capturedEntries: HarEntry[];
  let server: http.Server;
  let serverPort: number;

  afterEach(async () => {
    uninstallNodeHttpInterceptor();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  async function startTestServer(path: string, responseBody: string): Promise<void> {
    server = http.createServer((req, res) => {
      if (req.url === path) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(responseBody);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as { port: number }).port;
        resolve();
      });
    });
  }

  it('captures auth-related HTTP requests', async () => {
    capturedEntries = [];
    await startTestServer('/oauth2/token', '{"access_token":"tok"}');
    installNodeHttpInterceptor((entry) => capturedEntries.push(entry));

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { hostname: 'localhost', port: serverPort, path: '/oauth2/token', method: 'POST' },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.end('grant_type=client_credentials');
    });

    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].request.url).toContain('/oauth2/token');
    expect(capturedEntries[0].request.method).toBe('POST');
    expect(capturedEntries[0].response.status).toBe(200);
  });

  it('skips non-auth-related requests', async () => {
    capturedEntries = [];
    await startTestServer('/api/users', '[]');
    installNodeHttpInterceptor((entry) => capturedEntries.push(entry));

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { hostname: 'localhost', port: serverPort, path: '/api/users', method: 'GET' },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.end();
    });

    expect(capturedEntries).toHaveLength(0);
  });

  it('is idempotent', () => {
    installNodeHttpInterceptor(() => {});
    installNodeHttpInterceptor(() => {});
    expect(globalThis.__wolfcola_http_patched).toBe(true);
  });
});
