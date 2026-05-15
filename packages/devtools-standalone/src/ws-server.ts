import { Context, Effect, Layer, Schema } from 'effect';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from './session-manager.js';
import { HandshakeMessage, IncomingMessage } from './protocol.js';

export interface WsServerShape {
  start: (port: number) => Effect.Effect<never, never, never>;
}

export class WsServer extends Context.Tag('WsServer')<WsServer, WsServerShape>() {}

export const WsServerLive = Layer.effect(
  WsServer,
  Effect.gen(function* () {
    const mgr = yield* SessionManager;

    return {
      start: (port: number) =>
        Effect.async<never, never, never>(() => {
          const wss = new WebSocketServer({ port });

          wss.on('connection', (ws: WebSocket) => {
            let sessionId: string | null = null;

            ws.on('message', async (data: Buffer) => {
              try {
                const raw = JSON.parse(data.toString());

                if (!sessionId) {
                  const handshake = Schema.decodeUnknownSync(HandshakeMessage)(raw);
                  const session = await Effect.runPromise(
                    Effect.provide(
                      mgr.reconnect({
                        name: handshake.name,
                        pid: handshake.pid,
                        framework: handshake.framework,
                      }),
                      Layer.succeed(SessionManager, mgr),
                    ),
                  );
                  sessionId = session.id;
                  ws.send(JSON.stringify({ type: 'CONNECTED', sessionId }));
                  return;
                }

                const message = Schema.decodeUnknownSync(IncomingMessage)(raw);
                if (message.type !== 'HANDSHAKE') {
                  await Effect.runPromise(
                    Effect.provide(
                      mgr.handleMessage(sessionId, message),
                      Layer.succeed(SessionManager, mgr),
                    ),
                  );
                }
              } catch (err) {
                console.error('[WsServer] Failed to process message:', err);
              }
            });

            ws.on('close', async () => {
              if (sessionId) {
                await Effect.runPromise(
                  Effect.provide(mgr.disconnect(sessionId), Layer.succeed(SessionManager, mgr)),
                ).catch(console.error);
              }
            });
          });

          return Effect.sync(() => {
            wss.close();
          });
        }),
    };
  }),
);
