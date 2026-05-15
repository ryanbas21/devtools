import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { SessionManager, SessionManagerLive } from './session-manager.js';

describe('SessionManager', () => {
  const run = <A>(program: Effect.Effect<A, never, SessionManager>) =>
    Effect.runPromise(Effect.provide(program, SessionManagerLive));

  it('creates a session and returns its id', async () => {
    const session = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        return yield* mgr.create({ name: 'my-app' });
      }),
    );
    expect(session.id).toBeDefined();
    expect(session.name).toBe('my-app');
    expect(session.status).toBe('connected');
  });

  it('lists all sessions', async () => {
    const sessions = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        yield* mgr.create({ name: 'app-1' });
        yield* mgr.create({ name: 'app-2' });
        return yield* mgr.list();
      }),
    );
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.name)).toEqual(['app-1', 'app-2']);
  });

  it('finds an existing session by name', async () => {
    const found = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        yield* mgr.create({ name: 'my-app', pid: 1234 });
        return yield* mgr.findByName('my-app');
      }),
    );
    expect(found).not.toBeNull();
    expect(found!.name).toBe('my-app');
  });

  it('returns null for unknown session name', async () => {
    const found = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        return yield* mgr.findByName('nope');
      }),
    );
    expect(found).toBeNull();
  });

  it('removes a session by id', async () => {
    const sessions = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const s = yield* mgr.create({ name: 'app-1' });
        yield* mgr.remove(s.id);
        return yield* mgr.list();
      }),
    );
    expect(sessions).toHaveLength(0);
  });

  it('disconnects a session without removing it', async () => {
    const session = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const s = yield* mgr.create({ name: 'app-1' });
        yield* mgr.disconnect(s.id);
        return yield* mgr.findByName('app-1');
      }),
    );
    expect(session).not.toBeNull();
    expect(session!.status).toBe('disconnected');
  });

  it('reattaches to existing session on reconnect by name', async () => {
    const result = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const s1 = yield* mgr.create({ name: 'app-1' });
        yield* mgr.disconnect(s1.id);
        const s2 = yield* mgr.reconnect({ name: 'app-1' });
        return { sameId: s1.id === s2.id, status: s2.status };
      }),
    );
    expect(result.sameId).toBe(true);
    expect(result.status).toBe('connected');
  });

  it('getState returns empty state for new session', async () => {
    const state = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        return yield* mgr.getState(session.id);
      }),
    );
    expect(state).toBeDefined();
    expect(state!.events).toEqual([]);
  });

  it('clearSession clears session state', async () => {
    const state = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        yield* mgr.clearSession(session.id);
        return yield* mgr.getState(session.id);
      }),
    );
    expect(state!.events).toEqual([]);
  });

  describe('clearOnReconnect', () => {
    it('defaults to true', async () => {
      const session = await run(
        Effect.gen(function* () {
          const mgr = yield* SessionManager;
          return yield* mgr.create({ name: 'app-1' });
        }),
      );
      expect(session.clearOnReconnect).toBe(true);
    });

    it('can be toggled', async () => {
      const session = await run(
        Effect.gen(function* () {
          const mgr = yield* SessionManager;
          const s = yield* mgr.create({ name: 'app-1' });
          yield* mgr.setClearOnReconnect(s.id, false);
          return yield* mgr.findByName('app-1');
        }),
      );
      expect(session!.clearOnReconnect).toBe(false);
    });
  });
});
