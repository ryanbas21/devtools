import { Context, Effect, Layer, Schema } from 'effect';
import { WebSocketServer, WebSocket } from 'ws';
import { runDiagnosis, serializeDiagnosis } from '@wolfcola/devtools-core';
import type { ExtendedFlowState } from '@wolfcola/devtools-core';
import { SessionManager } from './session-manager.js';
import { HandshakeMessage, IncomingMessage } from './protocol.js';

export type EventCallback = (event: unknown, diagnosis: unknown) => void;

export interface WsServerShape {
  start: (port: number, onEvent?: EventCallback) => Effect.Effect<never, never, never>;
}

export class WsServer extends Context.Tag('WsServer')<WsServer, WsServerShape>() {}

export const WsServerLive = Layer.effect(
  WsServer,
  Effect.gen(function* () {
    const mgr = yield* SessionManager;

    return {
      start: (port: number, onEvent?: EventCallback) =>
        Effect.async<never, never, never>(() => {
          const wss = new WebSocketServer({ port, host: '127.0.0.1' });

          wss.on('connection', (ws: WebSocket) => {
            let sessionId: string | null = null;

            ws.on('message', async (data: Buffer) => {
              let raw: unknown;
              try {
                raw = JSON.parse(data.toString());
              } catch {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON' }));
                return;
              }

              try {
                if (!sessionId) {
                  const handshake = Schema.decodeUnknownSync(HandshakeMessage)(raw);
                  const session = await Effect.runPromise(
                    mgr.reconnect({
                      name: handshake.name,
                      pid: handshake.pid,
                      framework: handshake.framework,
                    }),
                  );
                  sessionId = session.id;
                  ws.send(JSON.stringify({ type: 'CONNECTED', sessionId }));
                  return;
                }

                const message = Schema.decodeUnknownSync(IncomingMessage)(raw);
                if (message.type !== 'HANDSHAKE') {
                  const result = await Effect.runPromise(mgr.handleMessage(sessionId, message));
                  if (
                    result &&
                    onEvent &&
                    (message.type === 'SDK_EVENT' || message.type === 'NETWORK_EVENT')
                  ) {
                    const state = await Effect.runPromise(
                      mgr.handleMessage(sessionId, { type: 'GET_STATE' }),
                    );
                    const events = (state as ExtendedFlowState | null)?.events ?? [];
                    const diagnosis = runDiagnosis(events);
                    onEvent(result, serializeDiagnosis(diagnosis));
                  }
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[WsServer] Error processing message:`, msg);
                ws.send(JSON.stringify({ type: 'ERROR', message: msg }));
              }
            });

            ws.on('close', async () => {
              if (sessionId) {
                await Effect.runPromise(mgr.disconnect(sessionId)).catch((err) => {
                  console.error(`[WsServer] Error disconnecting session ${sessionId}:`, err);
                });
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
