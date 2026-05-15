import { Context, Effect, Layer, Ref, pipe, ManagedRuntime } from 'effect';
import {
  EventStoreService,
  EventStoreInMemory,
  handleMessage as coreHandleMessage,
} from '@wolfcola/devtools-core';

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
  remove: (id: string) => Effect.Effect<void>;
  disconnect: (id: string) => Effect.Effect<void>;
  reconnect: (opts: SessionOptions) => Effect.Effect<Session>;
  handleMessage: (sessionId: string, message: unknown) => Effect.Effect<unknown>;
  setClearOnReconnect: (id: string, value: boolean) => Effect.Effect<void>;
  getSession: (id: string) => Effect.Effect<Session | null>;
}

export class SessionManager extends Context.Tag('SessionManager')<
  SessionManager,
  SessionManagerShape
>() {}

function toPublic(s: SessionInternal): Session {
  const { runtime: _, ...pub } = s;
  return pub;
}

export const SessionManagerLive = Layer.effect(
  SessionManager,
  pipe(
    Ref.make<SessionInternal[]>([]),
    Effect.map((sessionsRef) => ({
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

      handleMessage: (sessionId, message) =>
        Effect.gen(function* () {
          const sessions = yield* Ref.get(sessionsRef);
          const session = sessions.find((s) => s.id === sessionId);
          if (!session) return null;
          return yield* Effect.promise(() =>
            session.runtime.runPromise(coreHandleMessage(message as never)),
          );
        }),

      setClearOnReconnect: (id, value) =>
        Ref.update(sessionsRef, (ss) =>
          ss.map((s) => (s.id === id ? { ...s, clearOnReconnect: value } : s)),
        ),
    })),
  ),
);
