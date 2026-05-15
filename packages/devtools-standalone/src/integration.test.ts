import { describe, it, expect } from 'vitest';
import { Effect, Layer, Fiber } from 'effect';
import { WebSocket } from 'ws';
import { WsServer, WsServerLive } from './ws-server.js';
import { SessionManager, SessionManagerLive } from './session-manager.js';

const TestLayer = Layer.provide(WsServerLive, SessionManagerLive).pipe(
  Layer.merge(SessionManagerLive),
);

describe('Integration: Bridge -> Server -> Session', () => {
  it('full flow: handshake -> SDK event -> state updated', async () => {
    const port = 19900 + Math.floor(Math.random() * 100);

    const program = Effect.gen(function* () {
      const server = yield* WsServer;
      const mgr = yield* SessionManager;
      const fiber = yield* server.start(port).pipe(Effect.scoped, Effect.fork);
      yield* Effect.sleep('200 millis');

      const ws = yield* Effect.promise<WebSocket>(
        () =>
          new Promise<WebSocket>((resolve, reject) => {
            const conn = new WebSocket(`ws://localhost:${port}`);
            conn.on('open', () => resolve(conn));
            conn.on('error', reject);
          }),
      );

      ws.send(JSON.stringify({ type: 'HANDSHAKE', name: 'integration-app' }));
      const connMsg = yield* Effect.promise<{ type: string; sessionId: string }>(
        () =>
          new Promise<{ type: string; sessionId: string }>((resolve) => {
            ws.on('message', (data) => resolve(JSON.parse(data.toString())));
          }),
      );
      expect(connMsg.type).toBe('CONNECTED');

      ws.send(
        JSON.stringify({
          type: 'NETWORK_EVENT',
          payload: {
            request: {
              url: 'https://auth.example.com/oauth2/token',
              method: 'POST',
              headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
              postData: { text: 'grant_type=authorization_code&code=abc123' },
            },
            response: {
              status: 200,
              headers: [{ name: 'content-type', value: 'application/json' }],
              content: { text: '{"access_token":"tok","token_type":"Bearer"}' },
            },
            time: 150,
          },
        }),
      );

      yield* Effect.sleep('300 millis');

      const state = yield* mgr.getState(connMsg.sessionId);
      expect(state!.events.length).toBeGreaterThanOrEqual(1);

      ws.close();
      yield* Fiber.interrupt(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  it('multiple clients get independent sessions', async () => {
    const port = 19950 + Math.floor(Math.random() * 50);

    const program = Effect.gen(function* () {
      const server = yield* WsServer;
      const mgr = yield* SessionManager;
      const fiber = yield* server.start(port).pipe(Effect.scoped, Effect.fork);
      yield* Effect.sleep('200 millis');

      const connect = (name: string) =>
        new Promise<{ ws: WebSocket; sessionId: string }>((resolve, reject) => {
          const ws = new WebSocket(`ws://localhost:${port}`);
          ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'HANDSHAKE', name }));
            ws.on('message', (data) => {
              const msg = JSON.parse(data.toString());
              if (msg.type === 'CONNECTED') resolve({ ws, sessionId: msg.sessionId });
            });
          });
          ws.on('error', reject);
        });

      const client1 = yield* Effect.promise(() => connect('app-1'));
      const client2 = yield* Effect.promise(() => connect('app-2'));

      expect(client1.sessionId).not.toBe(client2.sessionId);

      const sessions = yield* mgr.list();
      expect(sessions).toHaveLength(2);

      client1.ws.close();
      client2.ws.close();
      yield* Fiber.interrupt(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
