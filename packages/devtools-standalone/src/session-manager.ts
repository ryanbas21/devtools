import { Context, Effect, Layer, Ref, pipe, ManagedRuntime } from 'effect';
import {
  EventStoreService,
  EventStoreInMemory,
  handleMessage as coreHandleMessage,
} from '@wolfcola/devtools-core';
import type { ExtendedFlowState, IncomingMessage } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';

export interface SessionOptions {
  name: string;
  pid?: number;
  framework?: string;
}

export interface Session {
  readonly id: string;
  readonly name: string;
  readonly pid?: number;
  readonly framework?: string;
  readonly connectedAt: string;
  readonly status: 'connected' | 'disconnected';
  readonly clearOnReconnect: boolean;
}

interface SessionInternal extends Session {
  readonly runtime: ManagedRuntime.ManagedRuntime<EventStoreService, never>;
}

function makeSession(opts: SessionOptions): SessionInternal {
  return {
    id: crypto.randomUUID(),
    name: opts.name,
    pid: opts.pid,
    framework: opts.framework,
    connectedAt: new Date().toISOString(),
    status: 'connected',
    clearOnReconnect: true,
    runtime: ManagedRuntime.make(EventStoreInMemory),
  };
}

export interface SessionManagerShape {
  create: (opts: SessionOptions) => Effect.Effect<Session>;
  list: () => Effect.Effect<Session[]>;
  findByName: (name: string) => Effect.Effect<Session | null>;
  getSession: (id: string) => Effect.Effect<Session | null>;
  remove: (id: string) => Effect.Effect<void>;
  disconnect: (id: string) => Effect.Effect<void>;
  reconnect: (opts: SessionOptions) => Effect.Effect<Session>;
  setClearOnReconnect: (id: string, value: boolean) => Effect.Effect<void>;
  getState: (sessionId: string) => Effect.Effect<ExtendedFlowState | null>;
  clearSession: (sessionId: string) => Effect.Effect<void>;
  ingestEvent: (
    sessionId: string,
    message: { readonly type: 'SDK_EVENT' | 'NETWORK_EVENT'; readonly payload: unknown },
  ) => Effect.Effect<AuthEvent | null>;
}

export class SessionManager extends Context.Tag('SessionManager')<
  SessionManager,
  SessionManagerShape
>() {}

function toPublic(s: SessionInternal): Session {
  const { runtime: _, ...pub } = s;
  return pub;
}

function findSession(sessionsRef: Ref.Ref<SessionInternal[]>, sessionId: string) {
  return Effect.map(Ref.get(sessionsRef), (ss) => ss.find((s) => s.id === sessionId) ?? null);
}

function runOnSession<A>(
  sessionsRef: Ref.Ref<SessionInternal[]>,
  sessionId: string,
  message: IncomingMessage,
): Effect.Effect<A | null> {
  return Effect.gen(function* () {
    const session = yield* findSession(sessionsRef, sessionId);
    if (!session) return null;
    return yield* Effect.promise(() => session.runtime.runPromise(coreHandleMessage(message)));
  }) as Effect.Effect<A | null>;
}

export const SessionManagerLive = Layer.effect(
  SessionManager,
  pipe(
    Ref.make<SessionInternal[]>([]),
    Effect.map(
      (sessionsRef): SessionManagerShape => ({
        create: (opts) =>
          Effect.gen(function* () {
            const session = makeSession(opts);
            yield* Ref.update(sessionsRef, (ss) => [...ss, session]);
            return toPublic(session);
          }),

        list: () => Effect.map(Ref.get(sessionsRef), (ss) => ss.map(toPublic)),

        findByName: (name) =>
          Effect.map(Ref.get(sessionsRef), (ss) => {
            const found = ss.find((s) => s.name === name);
            return found ? toPublic(found) : null;
          }),

        getSession: (id) =>
          Effect.map(Ref.get(sessionsRef), (ss) => {
            const found = ss.find((s) => s.id === id);
            return found ? toPublic(found) : null;
          }),

        remove: (id) =>
          Effect.gen(function* () {
            const sessions = yield* Ref.get(sessionsRef);
            const session = sessions.find((s) => s.id === id);
            if (session) {
              yield* Effect.promise(() => session.runtime.dispose());
            }
            yield* Ref.update(sessionsRef, (ss) => ss.filter((s) => s.id !== id));
          }),

        disconnect: (id) =>
          Ref.update(sessionsRef, (ss) =>
            ss.map((s) => (s.id === id ? { ...s, status: 'disconnected' as const } : s)),
          ),

        reconnect: (opts) =>
          Effect.gen(function* () {
            const sessions = yield* Ref.get(sessionsRef);
            const existing = sessions.find((s) => s.name === opts.name);
            if (existing) {
              if (existing.clearOnReconnect) {
                yield* Effect.promise(() =>
                  existing.runtime.runPromise(
                    Effect.gen(function* () {
                      const store = yield* EventStoreService;
                      yield* store.clear();
                    }),
                  ),
                );
              }
              const updated: SessionInternal = { ...existing, status: 'connected' as const };
              yield* Ref.update(sessionsRef, (ss) =>
                ss.map((s) => (s.id === existing.id ? updated : s)),
              );
              return toPublic(updated);
            }
            const session = makeSession(opts);
            yield* Ref.update(sessionsRef, (ss) => [...ss, session]);
            return toPublic(session);
          }),

        setClearOnReconnect: (id, value) =>
          Ref.update(sessionsRef, (ss) =>
            ss.map((s) => (s.id === id ? { ...s, clearOnReconnect: value } : s)),
          ),

        getState: (sessionId) =>
          runOnSession<ExtendedFlowState>(sessionsRef, sessionId, { type: 'GET_STATE' }),

        clearSession: (sessionId) =>
          runOnSession(sessionsRef, sessionId, { type: 'CLEAR' }).pipe(Effect.asVoid),

        // The readonly Schema-decoded message is structurally compatible with
        // core's mutable IncomingMessage at runtime. This is the single cast
        // bridging the Schema world (readonly) to the core world (mutable).
        ingestEvent: (sessionId, message) =>
          runOnSession<AuthEvent>(sessionsRef, sessionId, message as IncomingMessage),
      }),
    ),
  ),
);
