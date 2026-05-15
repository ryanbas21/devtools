import { Context, Effect, Layer, Schema, Scope } from 'effect';
import { NodeSocketServer } from '@effect/platform-node';
import { SocketServer, Socket } from '@effect/platform';
import { runDiagnosis, serializeDiagnosis } from '@wolfcola/devtools-core';
import type { ExtendedFlowState } from '@wolfcola/devtools-core';
import { SessionManager } from './session-manager.js';
import { HandshakeMessageFromJson, IncomingMessageFromJson } from './protocol.js';

export type EventCallback = (event: unknown, diagnosis: unknown) => void;

export interface WsServerShape {
  start: (
    port: number,
    onEvent?: EventCallback,
  ) => Effect.Effect<never, SocketServer.SocketServerError, Scope.Scope>;
}

export class WsServer extends Context.Tag('WsServer')<WsServer, WsServerShape>() {}

export const WsServerLive = Layer.effect(
  WsServer,
  Effect.gen(function* () {
    const mgr = yield* SessionManager;

    return {
      start: (port: number, onEvent?: EventCallback) =>
        Effect.gen(function* () {
          const server = yield* NodeSocketServer.makeWebSocket({ port, host: '127.0.0.1' });

          return yield* server.run(
            Effect.fnUntraced(function* (socket: Socket.Socket) {
              const write = yield* socket.writer;
              let sessionId: string | null = null;

              yield* socket.runRaw((data) =>
                Effect.gen(function* () {
                  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);

                  try {
                    if (!sessionId) {
                      const handshake = Schema.decodeUnknownSync(HandshakeMessageFromJson)(text);
                      const session = yield* mgr.reconnect({
                        name: handshake.name,
                        pid: handshake.pid,
                        framework: handshake.framework,
                      });
                      sessionId = session.id;
                      yield* write(JSON.stringify({ type: 'CONNECTED', sessionId }));
                      return;
                    }

                    const message = Schema.decodeUnknownSync(IncomingMessageFromJson)(text);
                    if (message.type !== 'HANDSHAKE') {
                      const result = yield* mgr.handleMessage(sessionId, message);
                      if (
                        result &&
                        onEvent &&
                        (message.type === 'SDK_EVENT' || message.type === 'NETWORK_EVENT')
                      ) {
                        const state = yield* mgr.handleMessage(sessionId, { type: 'GET_STATE' });
                        const events = (state as ExtendedFlowState | null)?.events ?? [];
                        const diagnosis = runDiagnosis(events);
                        onEvent(result, serializeDiagnosis(diagnosis));
                      }
                    }
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error(`[WsServer] Error processing message:`, msg);
                    yield* write(JSON.stringify({ type: 'ERROR', message: msg }));
                  }
                }),
              );

              // Socket closed — disconnect session
              if (sessionId) {
                yield* mgr.disconnect(sessionId);
              }
            }, Effect.scoped),
          );
        }),
    };
  }),
);
