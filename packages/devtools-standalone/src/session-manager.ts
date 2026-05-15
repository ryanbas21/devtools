import { Context, Effect, Layer, Ref, pipe, ManagedRuntime } from 'effect';
import {
  EventStoreService,
  EventStoreInMemory,
  handleMessage as coreHandleMessage,
} from '@wolfcola/devtools-core';

export interface Session {
  id: string;
  name: string;
  pid?: number;
  framework?: string;
  connectedAt: string;
  status: 'connected' | 'disconnected';
  clearOnReconnect: boolean;
  runtime: ManagedRuntime.ManagedRuntime<EventStoreService, never>;
}

export interface SessionManagerShape {
  create: (opts: { name: string; pid?: number; framework?: string }) => Effect.Effect<Session>;
  list: () => Effect.Effect<Session[]>;
  findByName: (name: string) => Effect.Effect<Session | null>;
  remove: (id: string) => Effect.Effect<void>;
  disconnect: (id: string) => Effect.Effect<void>;
  reconnect: (opts: { name: string; pid?: number; framework?: string }) => Effect.Effect<Session>;
  handleMessage: (sessionId: string, message: unknown) => Effect.Effect<unknown>;
  setClearOnReconnect: (id: string, value: boolean) => Effect.Effect<void>;
  getSession: (id: string) => Effect.Effect<Session | null>;
}

export class SessionManager extends Context.Tag('SessionManager')<
  SessionManager,
  SessionManagerShape
>() {}

export const SessionManagerLive = Layer.effect(
  SessionManager,
  pipe(
    Ref.make<Session[]>([]),
    Effect.map((sessionsRef) => ({
      create: (opts) =>
        Effect.gen(function* () {
          const runtime = ManagedRuntime.make(EventStoreInMemory);
          const session: Session = {
            id: crypto.randomUUID(),
            name: opts.name,
            pid: opts.pid,
            framework: opts.framework,
            connectedAt: new Date().toISOString(),
            status: 'connected',
            clearOnReconnect: true,
            runtime,
          };
          yield* Ref.update(sessionsRef, (ss) => [...ss, session]);
          return session;
        }),

      list: () => Ref.get(sessionsRef),

      findByName: (name) =>
        Effect.map(Ref.get(sessionsRef), (ss) => ss.find((s) => s.name === name) ?? null),

      getSession: (id) =>
        Effect.map(Ref.get(sessionsRef), (ss) => ss.find((s) => s.id === id) ?? null),

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
            const updated = { ...existing, status: 'connected' as const };
            yield* Ref.update(sessionsRef, (ss) =>
              ss.map((s) => (s.id === existing.id ? updated : s)),
            );
            return updated;
          }
          // No existing session: create new one
          const runtime = ManagedRuntime.make(EventStoreInMemory);
          const session: Session = {
            id: crypto.randomUUID(),
            name: opts.name,
            pid: opts.pid,
            framework: opts.framework,
            connectedAt: new Date().toISOString(),
            status: 'connected',
            clearOnReconnect: true,
            runtime,
          };
          yield* Ref.update(sessionsRef, (ss) => [...ss, session]);
          return session;
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
