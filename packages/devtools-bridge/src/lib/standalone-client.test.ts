import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { StandaloneClient } from './standalone-client.js';

let wss: WebSocketServer;
let port: number;

beforeEach(async () => {
  wss = new WebSocketServer({ port: 0 });
  port = (wss.address() as { port: number }).port;
});

afterEach(async () => {
  globalThis.__wolfcola_ws = undefined;
  await new Promise<void>((resolve) => wss.close(() => resolve()));
});

describe('StandaloneClient', () => {
  it('connects and sends handshake', async () => {
    const serverReceived = new Promise<unknown>((resolve) => {
      wss.on('connection', (ws) => {
        ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();

    const msg = await serverReceived;
    expect(msg).toEqual(expect.objectContaining({ type: 'HANDSHAKE', name: 'test-app' }));
    client.close();
  });

  it('sends SDK events', async () => {
    const serverReceived = new Promise<unknown[]>((resolve) => {
      const msgs: unknown[] = [];
      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          msgs.push(JSON.parse(data.toString()));
          if (msgs.length === 2) resolve(msgs);
        });
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();
    client.sendSdkEvent({ id: 'e1', type: 'sdk:config' });

    const msgs = await serverReceived;
    expect(msgs[1]).toEqual(
      expect.objectContaining({ type: 'SDK_EVENT', payload: { id: 'e1', type: 'sdk:config' } }),
    );
    client.close();
  });

  it('sends network events', async () => {
    const serverReceived = new Promise<unknown[]>((resolve) => {
      const msgs: unknown[] = [];
      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          msgs.push(JSON.parse(data.toString()));
          if (msgs.length === 2) resolve(msgs);
        });
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();
    client.sendNetworkEvent({
      request: { url: '/token', method: 'POST', headers: [] },
      response: { status: 200, headers: [] },
      time: 50,
    });

    const msgs = await serverReceived;
    expect(msgs[1]).toEqual(expect.objectContaining({ type: 'NETWORK_EVENT' }));
    client.close();
  });

  it('sends clear command', async () => {
    const serverReceived = new Promise<unknown[]>((resolve) => {
      const msgs: unknown[] = [];
      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          msgs.push(JSON.parse(data.toString()));
          if (msgs.length === 2) resolve(msgs);
        });
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();
    client.sendClear();

    const msgs = await serverReceived;
    expect(msgs[1]).toEqual({ type: 'CLEAR' });
    client.close();
  });

  it('uses globalThis singleton guard', async () => {
    const client1 = new StandaloneClient({ name: 'app', port });
    await client1.connect();

    const client2 = new StandaloneClient({ name: 'app', port });
    expect(client2.isConnected()).toBe(true);

    client1.close();
  });

  it('handles connection failure gracefully', async () => {
    const client = new StandaloneClient({ name: 'app', port: 1 });
    await expect(client.connect()).resolves.not.toThrow();
    expect(client.isConnected()).toBe(false);
  });
});
