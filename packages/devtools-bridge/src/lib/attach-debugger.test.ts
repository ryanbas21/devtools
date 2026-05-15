import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { attachDebugger } from './attach-debugger.js';
import { uninstallFetchInterceptor } from './fetch-interceptor.js';

let wss: WebSocketServer;
let port: number;

beforeEach(async () => {
  wss = new WebSocketServer({ port: 0 });
  port = (wss.address() as { port: number }).port;
});

afterEach(async () => {
  uninstallFetchInterceptor();
  globalThis.__wolfcola_ws = undefined;
  globalThis.__wolfcola_fetch_patched = undefined;
  await new Promise<void>((resolve) => wss.close(() => resolve()));
});

describe('attachDebugger', () => {
  it('returns a handle with detach function', async () => {
    const handle = await attachDebugger({ name: 'test-app', port, autoLaunch: false });
    expect(handle.detach).toBeDefined();
    handle.detach();
  });

  it('connects to the debugger', async () => {
    const connected = new Promise<void>((resolve) => {
      wss.on('connection', () => resolve());
    });
    const handle = await attachDebugger({ name: 'test-app', port, autoLaunch: false });
    await connected;
    handle.detach();
  });

  it('sends handshake on connect', async () => {
    const handshake = new Promise<unknown>((resolve) => {
      wss.on('connection', (ws) => {
        ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      });
    });
    const handle = await attachDebugger({ name: 'my-app', port, autoLaunch: false });
    const msg = await handshake;
    expect(msg).toEqual(expect.objectContaining({ type: 'HANDSHAKE', name: 'my-app' }));
    handle.detach();
  });

  it('installs fetch interceptor when network: true', async () => {
    const handle = await attachDebugger({
      name: 'test-app',
      port,
      network: true,
      autoLaunch: false,
    });
    expect(globalThis.__wolfcola_fetch_patched).toBe(true);
    handle.detach();
  });

  it('does not install fetch interceptor when network: false', async () => {
    const handle = await attachDebugger({
      name: 'test-app',
      port,
      network: false,
      autoLaunch: false,
    });
    expect(globalThis.__wolfcola_fetch_patched).toBeUndefined();
    handle.detach();
  });

  it('detach cleans up WebSocket and interceptors', async () => {
    const handle = await attachDebugger({
      name: 'test-app',
      port,
      network: true,
      autoLaunch: false,
    });
    handle.detach();
    expect(globalThis.__wolfcola_ws).toBeUndefined();
    expect(globalThis.__wolfcola_fetch_patched).toBeUndefined();
  });
});
