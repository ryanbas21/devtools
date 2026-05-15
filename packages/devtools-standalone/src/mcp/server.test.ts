import { describe, it, expect } from 'vitest';
import { McpServer } from '@effect/ai';
import { Effect, Layer } from 'effect';
import { WolfcolaToolkit, WolfcolaToolkitLive } from './tools.js';
import { SessionManager, SessionManagerLive } from '../session-manager.js';

/**
 * These tests register tools with the McpServer and invoke them via
 * `McpServer.callTool`, which exercises the full tool registration,
 * schema validation, and handler execution path — the same path
 * that a real MCP client would trigger.
 */

// Build a test layer: toolkit registered with McpServer + SessionManager for setup
const ToolkitWithDeps = Layer.provide(WolfcolaToolkitLive, SessionManagerLive);

const McpTestLayer = McpServer.toolkit(WolfcolaToolkit).pipe(
  Layer.provide(ToolkitWithDeps),
  Layer.provideMerge(McpServer.McpServer.layer),
);

const TestLayer = Layer.merge(McpTestLayer, SessionManagerLive);

function callTool(name: string, args: Record<string, unknown> = {}) {
  return Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    return yield* server.callTool({ name, arguments: args });
  });
}

describe('MCP Server — Tool Invocation', () => {
  it('list-sessions returns empty array via MCP', async () => {
    const result = await Effect.runPromise(Effect.provide(callTool('list-sessions'), TestLayer));
    expect(result.isError).toBe(false);
    const content = result.content[0];
    expect(content.type).toBe('text');
    const parsed = JSON.parse((content as { text: string }).text);
    expect(parsed).toEqual([]);
  });

  it('list-sessions returns sessions after creating one', async () => {
    const program = Effect.gen(function* () {
      const mgr = yield* SessionManager;
      yield* mgr.create({ name: 'mcp-test-app' });
      return yield* callTool('list-sessions');
    });
    const result = await Effect.runPromise(Effect.provide(program, TestLayer));
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('mcp-test-app');
    expect(parsed[0].status).toBe('connected');
  });

  it('get-flow-summary returns summary for a session', async () => {
    const program = Effect.gen(function* () {
      const mgr = yield* SessionManager;
      const session = yield* mgr.create({ name: 'app-1' });
      return yield* callTool('get-flow-summary', { sessionId: session.id });
    });
    const result = await Effect.runPromise(Effect.provide(program, TestLayer));
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual(expect.objectContaining({ nodeCount: 0, errorCount: 0 }));
  });

  it('get-events returns empty events for new session', async () => {
    const program = Effect.gen(function* () {
      const mgr = yield* SessionManager;
      const session = yield* mgr.create({ name: 'app-1' });
      return yield* callTool('get-events', { sessionId: session.id });
    });
    const result = await Effect.runPromise(Effect.provide(program, TestLayer));
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual([]);
  });

  it('clear-flow clears session and returns confirmation', async () => {
    const program = Effect.gen(function* () {
      const mgr = yield* SessionManager;
      const session = yield* mgr.create({ name: 'app-1' });
      return yield* callTool('clear-flow', { sessionId: session.id });
    });
    const result = await Effect.runPromise(Effect.provide(program, TestLayer));
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed).toEqual({ cleared: true });
  });

  it('set-clear-on-reconnect toggles the flag', async () => {
    const program = Effect.gen(function* () {
      const mgr = yield* SessionManager;
      const session = yield* mgr.create({ name: 'app-1' });
      yield* callTool('set-clear-on-reconnect', { sessionId: session.id, value: false });
      const updated = yield* mgr.findByName('app-1');
      return updated!.clearOnReconnect;
    });
    const result = await Effect.runPromise(Effect.provide(program, TestLayer));
    expect(result).toBe(false);
  });

  it('export-json returns redacted JSON string', async () => {
    const program = Effect.gen(function* () {
      const mgr = yield* SessionManager;
      const session = yield* mgr.create({ name: 'app-1' });
      return yield* callTool('export-json', { sessionId: session.id });
    });
    const result = await Effect.runPromise(Effect.provide(program, TestLayer));
    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(JSON.parse(text));
    expect(parsed.version).toBe(1);
    expect(parsed.redacted).toBe(true);
  });

  it('export-markdown returns markdown string', async () => {
    const program = Effect.gen(function* () {
      const mgr = yield* SessionManager;
      const session = yield* mgr.create({ name: 'app-1' });
      return yield* callTool('export-markdown', { sessionId: session.id });
    });
    const result = await Effect.runPromise(Effect.provide(program, TestLayer));
    const text = (result.content[0] as { text: string }).text;
    // The markdown export wraps in JSON.stringify, so parse once
    const md = JSON.parse(text);
    expect(typeof md).toBe('string');
  });

  it('calling a non-existent tool returns InvalidParams', async () => {
    const program = Effect.gen(function* () {
      const server = yield* McpServer.McpServer;
      return yield* server.callTool({ name: 'does-not-exist', arguments: {} }).pipe(
        Effect.flip, // convert success/failure
      );
    });
    const error = await Effect.runPromise(Effect.provide(program, TestLayer));
    expect(error._tag).toBe('InvalidParams');
  });

  it('tools are registered with correct names', async () => {
    const program = Effect.gen(function* () {
      const server = yield* McpServer.McpServer;
      return server.tools.map((t) => t.name);
    });
    const names = await Effect.runPromise(Effect.provide(program, TestLayer));
    expect(names).toContain('list-sessions');
    expect(names).toContain('get-events');
    expect(names).toContain('get-flow-summary');
    expect(names).toContain('get-diagnosis');
    expect(names).toContain('get-event-detail');
    expect(names).toContain('search-events');
    expect(names).toContain('clear-flow');
    expect(names).toContain('export-json');
    expect(names).toContain('export-markdown');
    expect(names).toContain('set-clear-on-reconnect');
    expect(names).toHaveLength(10);
  });

  it('tools have descriptions for MCP discovery', async () => {
    const program = Effect.gen(function* () {
      const server = yield* McpServer.McpServer;
      return server.tools;
    });
    const tools = await Effect.runPromise(Effect.provide(program, TestLayer));
    for (const tool of tools) {
      expect(tool.description).toBeDefined();
      expect(tool.description!.length).toBeGreaterThan(10);
    }
  });
});
