import { describe, it, expect } from 'vitest';
import { Effect, Layer, Fiber } from 'effect';
import { WebSocket } from 'ws';
import { WsServer, WsServerLive } from './ws-server.js';
import { SessionManager, SessionManagerLive } from './session-manager.js';

const TestLayer = Layer.provide(WsServerLive, SessionManagerLive).pipe(
  Layer.merge(SessionManagerLive),
);

function connectClient(port: number, handshake: object): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify(handshake));
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.on('message', (data) => resolve(JSON.parse(data.toString())));
  });
}

describe('WsServer', () => {
  it('accepts connections and sends CONNECTED response', async () => {
    const port = 19500 + Math.floor(Math.random() * 100);

    const program = Effect.gen(function* () {
      const server = yield* WsServer;
      const fiber = yield* Effect.fork(server.start(port));
      yield* Effect.sleep('100 millis');

      const ws = yield* Effect.promise(() =>
        connectClient(port, { type: 'HANDSHAKE', name: 'test-app' }),
      );
      const response = yield* Effect.promise(() => waitForMessage(ws));

      expect(response).toEqual(
        expect.objectContaining({ type: 'CONNECTED', sessionId: expect.any(String) }),
      );

      ws.close();
      yield* Fiber.interrupt(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  it('creates a session for each connecting client', async () => {
    const port = 19600 + Math.floor(Math.random() * 100);

    const program = Effect.gen(function* () {
      const server = yield* WsServer;
      const mgr = yield* SessionManager;
      const fiber = yield* Effect.fork(server.start(port));
      yield* Effect.sleep('100 millis');

      const ws = yield* Effect.promise(() =>
        connectClient(port, { type: 'HANDSHAKE', name: 'app-1' }),
      );
      yield* Effect.promise(() => waitForMessage(ws));

      const sessions = yield* mgr.list();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('app-1');

      ws.close();
      yield* Fiber.interrupt(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  it('routes SDK_EVENT messages to session handler', async () => {
    const port = 19700 + Math.floor(Math.random() * 100);

    const program = Effect.gen(function* () {
      const server = yield* WsServer;
      const mgr = yield* SessionManager;
      const fiber = yield* Effect.fork(server.start(port));
      yield* Effect.sleep('100 millis');

      const ws = yield* Effect.promise(() =>
        connectClient(port, { type: 'HANDSHAKE', name: 'app-1' }),
      );
      const connMsg = (yield* Effect.promise(() => waitForMessage(ws))) as { sessionId: string };

      ws.send(
        JSON.stringify({
          type: 'SDK_EVENT',
          payload: {
            id: 'e1',
            timestamp: 100,
            type: 'sdk:config',
            source: 'sdk',
            flowId: null,
            causedBy: null,
            data: { _tag: 'sdk-config', config: {} },
            flags: { isCors: false, isError: false, isAuthRelated: true },
          },
        }),
      );

      yield* Effect.sleep('200 millis');

      const state = yield* mgr.handleMessage(connMsg.sessionId, { type: 'GET_STATE' });
      expect((state as { events: unknown[] }).events).toHaveLength(1);

      ws.close();
      yield* Fiber.interrupt(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
