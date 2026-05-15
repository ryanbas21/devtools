import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { createMcpTools } from './server.js';
import { SessionManager, SessionManagerLive } from '../session-manager.js';

describe('MCP Tools', () => {
  const run = <A>(program: Effect.Effect<A, never, SessionManager>) =>
    Effect.runPromise(Effect.provide(program, SessionManagerLive));

  it('list-sessions returns empty list when no sessions', async () => {
    const result = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const tools = createMcpTools(mgr);
        return yield* Effect.promise(() => tools['list-sessions']());
      }),
    );
    expect(result).toEqual([]);
  });

  it('list-sessions returns connected sessions', async () => {
    const result = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        yield* mgr.create({ name: 'app-1' });
        const tools = createMcpTools(mgr);
        return yield* Effect.promise(() => tools['list-sessions']());
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ name: 'app-1', status: 'connected' }));
  });

  it('get-flow-summary returns empty summary for new session', async () => {
    const result = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        const tools = createMcpTools(mgr);
        return yield* Effect.promise(() => tools['get-flow-summary'](session.id));
      }),
    );
    expect(result).toEqual(expect.objectContaining({ nodeCount: 0, errorCount: 0 }));
  });

  it('get-events returns empty array for new session', async () => {
    const result = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        const tools = createMcpTools(mgr);
        return yield* Effect.promise(() => tools['get-events'](session.id));
      }),
    );
    expect(result).toEqual([]);
  });

  it('clear-flow clears session events', async () => {
    const result = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        const tools = createMcpTools(mgr);
        yield* Effect.promise(() => tools['clear-flow'](session.id));
        return yield* Effect.promise(() => tools['get-events'](session.id));
      }),
    );
    expect(result).toEqual([]);
  });

  it('set-clear-on-reconnect toggles the flag', async () => {
    const result = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        const tools = createMcpTools(mgr);
        yield* Effect.promise(() => tools['set-clear-on-reconnect'](session.id, false));
        const updated = yield* mgr.findByName('app-1');
        return updated!.clearOnReconnect;
      }),
    );
    expect(result).toBe(false);
  });
});
