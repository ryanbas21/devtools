# Standalone Debugger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Electron desktop app that receives OIDC/OAuth2 events from apps via WebSocket, reusing the existing `devtools-core`, `devtools-types`, and `devtools-ui` packages.

**Architecture:** Two new/enhanced packages: `devtools-standalone` (Electron app with WebSocket server, session management, MCP server) and enhanced `devtools-bridge` (WebSocket client, fetch/XHR/Node http instrumentation, auto-launch). The Electron main process runs the same `handleMessage` -> `EventStoreInMemory` -> `DiagnosisEngine` pipeline as the Chrome extension's service worker, forwarding results to the renderer via IPC. The renderer is a thin adaptation of the existing `panel.ts`.

**Tech Stack:** Electron, Effect TS, `@effect/platform` (SocketServer/Socket), `@wolfcola/devtools-core`, `@wolfcola/devtools-ui` (Elm), esbuild, Vitest, MCP SDK

---

## File Map

### New: `packages/devtools-standalone/`

| File                                                       | Responsibility                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `package.json`                                             | Package config, Electron + deps                                                                          |
| `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json` | TypeScript config (matches monorepo pattern)                                                             |
| `vite.config.ts`                                           | Vitest config                                                                                            |
| `src/protocol.ts`                                          | Effect Schemas for WebSocket message types (Handshake, SdkEvent, NetworkEvent, Clear, Connected, Config) |
| `src/protocol.test.ts`                                     | Schema encode/decode tests                                                                               |
| `src/session-manager.ts`                                   | Session registry: create, find, remove, list sessions; each holds its own `EventStoreInMemory` runtime   |
| `src/session-manager.test.ts`                              | Session lifecycle tests                                                                                  |
| `src/ws-server.ts`                                         | WebSocket server that accepts connections, runs handshake, routes messages to session's runtime          |
| `src/ws-server.test.ts`                                    | Server integration tests                                                                                 |
| `src/ipc-bridge.ts`                                        | Electron IPC channel definitions + handler registration (main process side)                              |
| `src/ipc-bridge.test.ts`                                   | IPC message routing tests (mocked Electron)                                                              |
| `src/mcp/server.ts`                                        | MCP server with read + control tools wrapping session manager                                            |
| `src/mcp/server.test.ts`                                   | MCP tool tests                                                                                           |
| `src/main.ts`                                              | Electron main process entry: creates window, starts WS server, registers IPC                             |
| `src/preload.ts`                                           | contextBridge API exposing `wolfcola` namespace to renderer                                              |
| `src/renderer.ts`                                          | Elm init + port wiring (adapted from `panel.ts`)                                                         |
| `build.mjs`                                                | esbuild bundling for main/preload/renderer + asset copy                                                  |

### Enhanced: `packages/devtools-bridge/`

| File                                    | Responsibility                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/standalone-client.ts`          | WebSocket client connecting to standalone debugger, sends events                |
| `src/lib/standalone-client.test.ts`     | Client connection, send, reconnect tests                                        |
| `src/lib/fetch-interceptor.ts`          | `globalThis.fetch` wrapper converting requests to HarEntry                      |
| `src/lib/fetch-interceptor.test.ts`     | Interceptor capture + filtering tests                                           |
| `src/lib/xhr-interceptor.ts`            | XHR monkey-patch                                                                |
| `src/lib/xhr-interceptor.test.ts`       | XHR capture tests                                                               |
| `src/lib/node-http-interceptor.ts`      | Node `http`/`https` request patch                                               |
| `src/lib/node-http-interceptor.test.ts` | Node http capture tests                                                         |
| `src/lib/auto-launch.ts`                | Binary discovery + spawn                                                        |
| `src/lib/auto-launch.test.ts`           | Discovery + spawn tests                                                         |
| `src/lib/attach-debugger.ts`            | Public `attachDebugger()` API orchestrating client + interceptors + auto-launch |
| `src/lib/attach-debugger.test.ts`       | Integration tests                                                               |
| `src/index.ts`                          | Updated exports                                                                 |

---

## Task 1: WebSocket Protocol Schemas

**Files:**

- Create: `packages/devtools-standalone/package.json`
- Create: `packages/devtools-standalone/tsconfig.json`
- Create: `packages/devtools-standalone/tsconfig.lib.json`
- Create: `packages/devtools-standalone/tsconfig.spec.json`
- Create: `packages/devtools-standalone/vite.config.ts`
- Create: `packages/devtools-standalone/src/protocol.ts`
- Create: `packages/devtools-standalone/src/protocol.test.ts`

- [ ] **Step 1: Scaffold the package**

Create `packages/devtools-standalone/package.json`:

```json
{
  "name": "@wolfcola/devtools-standalone",
  "version": "0.0.1",
  "private": true,
  "description": "Standalone Electron OIDC/OAuth2 debugger",
  "type": "module",
  "main": "dist/src/main.js",
  "scripts": {
    "build": "node --experimental-strip-types build.mjs",
    "test": "vitest run",
    "start": "electron dist/src/main.js"
  },
  "dependencies": {
    "@wolfcola/devtools-core": "workspace:*",
    "@wolfcola/devtools-types": "workspace:*",
    "@wolfcola/devtools-ui": "workspace:*",
    "effect": "catalog:effect",
    "@effect/platform": "catalog:effect",
    "@effect/platform-node": "catalog:effect"
  },
  "devDependencies": {
    "esbuild": "^0.28.0",
    "electron": "^35.0.0",
    "vitest": "catalog:vitest"
  }
}
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
```

Create `tsconfig.lib.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "moduleResolution": "nodenext",
    "module": "NodeNext",
    "target": "ES2022",
    "outDir": "./dist",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "lib": ["es2022", "dom", "dom.iterable"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

Create `tsconfig.spec.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist-spec"
  },
  "include": ["src/**/*.test.ts"]
}
```

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 2: Write the protocol schema tests**

Create `packages/devtools-standalone/src/protocol.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Schema } from 'effect';
import {
  HandshakeMessage,
  SdkEventMessage,
  NetworkEventMessage,
  ClearMessage,
  ConnectedMessage,
  IncomingMessage,
} from './protocol.js';

describe('Protocol Schemas', () => {
  describe('HandshakeMessage', () => {
    it('decodes a valid handshake', () => {
      const input = { type: 'HANDSHAKE', name: 'my-app', pid: 12345, framework: 'next' };
      const result = Schema.decodeUnknownSync(HandshakeMessage)(input);
      expect(result.type).toBe('HANDSHAKE');
      expect(result.name).toBe('my-app');
      expect(result.pid).toBe(12345);
      expect(result.framework).toBe('next');
    });

    it('decodes handshake without optional fields', () => {
      const input = { type: 'HANDSHAKE', name: 'my-app' };
      const result = Schema.decodeUnknownSync(HandshakeMessage)(input);
      expect(result.name).toBe('my-app');
      expect(result.pid).toBeUndefined();
      expect(result.framework).toBeUndefined();
    });

    it('rejects handshake missing name', () => {
      const input = { type: 'HANDSHAKE' };
      expect(() => Schema.decodeUnknownSync(HandshakeMessage)(input)).toThrow();
    });
  });

  describe('SdkEventMessage', () => {
    it('decodes a valid SDK event message', () => {
      const input = { type: 'SDK_EVENT', payload: { id: 'e1', timestamp: 100 } };
      const result = Schema.decodeUnknownSync(SdkEventMessage)(input);
      expect(result.type).toBe('SDK_EVENT');
      expect(result.payload).toEqual({ id: 'e1', timestamp: 100 });
    });
  });

  describe('NetworkEventMessage', () => {
    it('decodes a valid network event message', () => {
      const input = {
        type: 'NETWORK_EVENT',
        payload: {
          request: { url: '/token', method: 'POST', headers: [] },
          response: { status: 200, headers: [] },
          time: 50,
        },
      };
      const result = Schema.decodeUnknownSync(NetworkEventMessage)(input);
      expect(result.type).toBe('NETWORK_EVENT');
    });
  });

  describe('ClearMessage', () => {
    it('decodes a clear message', () => {
      const input = { type: 'CLEAR' };
      const result = Schema.decodeUnknownSync(ClearMessage)(input);
      expect(result.type).toBe('CLEAR');
    });
  });

  describe('ConnectedMessage', () => {
    it('encodes a connected response', () => {
      const msg = { type: 'CONNECTED' as const, sessionId: 'sess-1' };
      const result = Schema.encodeSync(ConnectedMessage)(msg);
      expect(result).toEqual({ type: 'CONNECTED', sessionId: 'sess-1' });
    });
  });

  describe('IncomingMessage (union)', () => {
    it('decodes handshake via union', () => {
      const input = { type: 'HANDSHAKE', name: 'app' };
      const result = Schema.decodeUnknownSync(IncomingMessage)(input);
      expect(result.type).toBe('HANDSHAKE');
    });

    it('decodes SDK_EVENT via union', () => {
      const input = { type: 'SDK_EVENT', payload: {} };
      const result = Schema.decodeUnknownSync(IncomingMessage)(input);
      expect(result.type).toBe('SDK_EVENT');
    });

    it('decodes NETWORK_EVENT via union', () => {
      const input = {
        type: 'NETWORK_EVENT',
        payload: {
          request: { url: '/x', method: 'GET', headers: [] },
          response: { status: 200, headers: [] },
          time: 0,
        },
      };
      const result = Schema.decodeUnknownSync(IncomingMessage)(input);
      expect(result.type).toBe('NETWORK_EVENT');
    });

    it('decodes CLEAR via union', () => {
      const result = Schema.decodeUnknownSync(IncomingMessage)({ type: 'CLEAR' });
      expect(result.type).toBe('CLEAR');
    });

    it('rejects unknown message types', () => {
      expect(() => Schema.decodeUnknownSync(IncomingMessage)({ type: 'UNKNOWN' })).toThrow();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/devtools-standalone && pnpm test`
Expected: FAIL -- `protocol.js` does not exist yet.

- [ ] **Step 4: Implement the protocol schemas**

Create `packages/devtools-standalone/src/protocol.ts`:

```typescript
import { Schema } from 'effect';

export const HandshakeMessage = Schema.Struct({
  type: Schema.Literal('HANDSHAKE'),
  name: Schema.String,
  pid: Schema.optional(Schema.Number),
  framework: Schema.optional(Schema.String),
});
export type HandshakeMessage = typeof HandshakeMessage.Type;

export const SdkEventMessage = Schema.Struct({
  type: Schema.Literal('SDK_EVENT'),
  payload: Schema.Unknown,
});
export type SdkEventMessage = typeof SdkEventMessage.Type;

export const NetworkEventMessage = Schema.Struct({
  type: Schema.Literal('NETWORK_EVENT'),
  payload: Schema.Struct({
    request: Schema.Struct({
      url: Schema.String,
      method: Schema.String,
      headers: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
      postData: Schema.optional(Schema.Struct({ text: Schema.String })),
    }),
    response: Schema.Struct({
      status: Schema.Number,
      headers: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
      content: Schema.optional(Schema.Struct({ text: Schema.String })),
    }),
    time: Schema.Number,
  }),
});
export type NetworkEventMessage = typeof NetworkEventMessage.Type;

export const ClearMessage = Schema.Struct({
  type: Schema.Literal('CLEAR'),
});
export type ClearMessage = typeof ClearMessage.Type;

export const ConnectedMessage = Schema.Struct({
  type: Schema.Literal('CONNECTED'),
  sessionId: Schema.String,
});
export type ConnectedMessage = typeof ConnectedMessage.Type;

export const ConfigMessage = Schema.Struct({
  type: Schema.Literal('CONFIG'),
  payload: Schema.Unknown,
});
export type ConfigMessage = typeof ConfigMessage.Type;

export const IncomingMessage = Schema.Union(
  HandshakeMessage,
  SdkEventMessage,
  NetworkEventMessage,
  ClearMessage,
);
export type IncomingMessage = typeof IncomingMessage.Type;

export const OutgoingMessage = Schema.Union(ConnectedMessage, ConfigMessage);
export type OutgoingMessage = typeof OutgoingMessage.Type;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/devtools-standalone && pnpm test`
Expected: All protocol tests PASS.

- [ ] **Step 6: Install dependencies and commit**

```bash
pnpm install
git add packages/devtools-standalone/
git commit -m "feat(devtools-standalone): scaffold package and add protocol schemas"
```

---

## Task 2: Session Manager

**Files:**

- Create: `packages/devtools-standalone/src/session-manager.ts`
- Create: `packages/devtools-standalone/src/session-manager.test.ts`

- [ ] **Step 1: Write session manager tests**

Create `packages/devtools-standalone/src/session-manager.test.ts`:

```typescript
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

  it('handles events through session runtime', async () => {
    const state = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        return yield* mgr.handleMessage(session.id, {
          type: 'GET_STATE',
        });
      }),
    );
    expect(state).toBeDefined();
    expect((state as { events: unknown[] }).events).toEqual([]);
  });

  it('clears session state', async () => {
    const state = await run(
      Effect.gen(function* () {
        const mgr = yield* SessionManager;
        const session = yield* mgr.create({ name: 'app-1' });
        yield* mgr.handleMessage(session.id, { type: 'CLEAR' });
        return yield* mgr.handleMessage(session.id, { type: 'GET_STATE' });
      }),
    );
    expect((state as { events: unknown[] }).events).toEqual([]);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-standalone && pnpm test`
Expected: FAIL -- `session-manager.js` does not exist.

- [ ] **Step 3: Implement the session manager**

Create `packages/devtools-standalone/src/session-manager.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/devtools-standalone && pnpm test`
Expected: All session manager tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-standalone/src/session-manager*
git commit -m "feat(devtools-standalone): add session manager with per-session runtimes"
```

---

## Task 3: Bridge -- Fetch Interceptor

**Files:**

- Create: `packages/devtools-bridge/src/lib/fetch-interceptor.ts`
- Create: `packages/devtools-bridge/src/lib/fetch-interceptor.test.ts`

- [ ] **Step 1: Write fetch interceptor tests**

Create `packages/devtools-bridge/src/lib/fetch-interceptor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installFetchInterceptor, uninstallFetchInterceptor } from './fetch-interceptor.js';
import type { HarEntry } from '@wolfcola/devtools-core';

describe('fetchInterceptor', () => {
  let originalFetch: typeof globalThis.fetch;
  let capturedEntries: HarEntry[];

  beforeEach(() => {
    capturedEntries = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'tok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    uninstallFetchInterceptor();
    globalThis.fetch = originalFetch;
  });

  it('captures auth-related requests and calls onEntry', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://auth.example.com/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&code=abc',
    });
    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].request.url).toBe('https://auth.example.com/oauth2/token');
    expect(capturedEntries[0].request.method).toBe('POST');
    expect(capturedEntries[0].response.status).toBe(200);
  });

  it('skips non-auth-related requests', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://api.example.com/users');
    expect(capturedEntries).toHaveLength(0);
  });

  it('skips static asset URLs', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://cdn.example.com/bundle.js');
    expect(capturedEntries).toHaveLength(0);
  });

  it('is idempotent -- does not double-patch', async () => {
    const cb = vi.fn();
    installFetchInterceptor(cb);
    installFetchInterceptor(cb);
    await globalThis.fetch('https://auth.example.com/token');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('captures request body as postData.text', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://auth.example.com/token', {
      method: 'POST',
      body: 'grant_type=client_credentials',
    });
    expect(capturedEntries[0].request.postData?.text).toBe('grant_type=client_credentials');
  });

  it('captures response body as content.text', async () => {
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await globalThis.fetch('https://auth.example.com/token');
    expect(capturedEntries[0].response.content?.text).toContain('access_token');
  });

  it('preserves original fetch behavior -- returns same response', async () => {
    installFetchInterceptor(() => {});
    const res = await globalThis.fetch('https://auth.example.com/token');
    const body = await res.json();
    expect(body.access_token).toBe('tok');
  });

  it('still works when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    installFetchInterceptor((entry) => capturedEntries.push(entry));
    await expect(globalThis.fetch('https://auth.example.com/token')).rejects.toThrow(
      'Network error',
    );
    expect(capturedEntries).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=fetch-interceptor`
Expected: FAIL -- module does not exist.

- [ ] **Step 3: Implement the fetch interceptor**

Create `packages/devtools-bridge/src/lib/fetch-interceptor.ts`:

```typescript
import { isAuthRelated } from '@wolfcola/devtools-core';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

declare global {
  // eslint-disable-next-line no-var
  var __wolfcola_fetch_patched: boolean | undefined;
  // eslint-disable-next-line no-var
  var __wolfcola_original_fetch: typeof fetch | undefined;
}

function headersToHar(headers: Headers | HeadersInit | undefined): HarHeader[] {
  if (!headers) return [];
  const h = headers instanceof Headers ? headers : new Headers(headers as Record<string, string>);
  const result: HarHeader[] = [];
  h.forEach((value, name) => result.push({ name, value }));
  return result;
}

export function installFetchInterceptor(onEntry: (entry: HarEntry) => void): void {
  if (globalThis.__wolfcola_fetch_patched) return;

  const original = globalThis.fetch;
  globalThis.__wolfcola_original_fetch = original;
  globalThis.__wolfcola_fetch_patched = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

    const start = performance.now();
    const response = await original(input, init);
    const duration = performance.now() - start;

    if (isAuthRelated(url)) {
      const bodyText = typeof init?.body === 'string' ? init.body : undefined;
      const cloned = response.clone();
      const responseText = await cloned.text().catch(() => undefined);

      const entry: HarEntry = {
        request: {
          url,
          method: method.toUpperCase(),
          headers: headersToHar(init?.headers),
          ...(bodyText ? { postData: { text: bodyText } } : {}),
        },
        response: {
          status: response.status,
          headers: headersToHar(response.headers),
          ...(responseText ? { content: { text: responseText } } : {}),
        },
        time: duration,
      };
      onEntry(entry);
    }

    return response;
  };
}

export function uninstallFetchInterceptor(): void {
  if (globalThis.__wolfcola_original_fetch) {
    globalThis.fetch = globalThis.__wolfcola_original_fetch;
  }
  globalThis.__wolfcola_fetch_patched = undefined;
  globalThis.__wolfcola_original_fetch = undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=fetch-interceptor`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-bridge/src/lib/fetch-interceptor*
git commit -m "feat(devtools-bridge): add fetch interceptor with auth-related filtering"
```

---

## Task 4: Bridge -- Standalone WebSocket Client

**Files:**

- Create: `packages/devtools-bridge/src/lib/standalone-client.ts`
- Create: `packages/devtools-bridge/src/lib/standalone-client.test.ts`

- [ ] **Step 1: Write standalone client tests**

Create `packages/devtools-bridge/src/lib/standalone-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { StandaloneClient } from './standalone-client.js';

let wss: WebSocketServer;
let port: number;

beforeEach(async () => {
  wss = new WebSocketServer({ port: 0 });
  port = (wss.address() as { port: number }).port;
});

afterEach(async () => {
  globalThis.__wolfcola_ws = undefined;
  await new Promise<void>((resolve) => wss.close(() => resolve()));
});

describe('StandaloneClient', () => {
  it('connects and sends handshake', async () => {
    const serverReceived = new Promise<unknown>((resolve) => {
      wss.on('connection', (ws) => {
        ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();

    const msg = await serverReceived;
    expect(msg).toEqual(expect.objectContaining({ type: 'HANDSHAKE', name: 'test-app' }));
    client.close();
  });

  it('sends SDK events', async () => {
    const serverReceived = new Promise<unknown[]>((resolve) => {
      const msgs: unknown[] = [];
      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          msgs.push(JSON.parse(data.toString()));
          if (msgs.length === 2) resolve(msgs);
        });
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();
    client.sendSdkEvent({ id: 'e1', type: 'sdk:config' });

    const msgs = await serverReceived;
    expect(msgs[1]).toEqual(
      expect.objectContaining({ type: 'SDK_EVENT', payload: { id: 'e1', type: 'sdk:config' } }),
    );
    client.close();
  });

  it('sends network events', async () => {
    const serverReceived = new Promise<unknown[]>((resolve) => {
      const msgs: unknown[] = [];
      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          msgs.push(JSON.parse(data.toString()));
          if (msgs.length === 2) resolve(msgs);
        });
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();
    client.sendNetworkEvent({
      request: { url: '/token', method: 'POST', headers: [] },
      response: { status: 200, headers: [] },
      time: 50,
    });

    const msgs = await serverReceived;
    expect(msgs[1]).toEqual(expect.objectContaining({ type: 'NETWORK_EVENT' }));
    client.close();
  });

  it('sends clear command', async () => {
    const serverReceived = new Promise<unknown[]>((resolve) => {
      const msgs: unknown[] = [];
      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          msgs.push(JSON.parse(data.toString()));
          if (msgs.length === 2) resolve(msgs);
        });
      });
    });

    const client = new StandaloneClient({ name: 'test-app', port });
    await client.connect();
    client.sendClear();

    const msgs = await serverReceived;
    expect(msgs[1]).toEqual({ type: 'CLEAR' });
    client.close();
  });

  it('uses globalThis singleton guard', async () => {
    const client1 = new StandaloneClient({ name: 'app', port });
    await client1.connect();

    const client2 = new StandaloneClient({ name: 'app', port });
    expect(client2.isConnected()).toBe(true);

    client1.close();
  });

  it('handles connection failure gracefully', async () => {
    const client = new StandaloneClient({ name: 'app', port: 1 });
    await expect(client.connect()).resolves.not.toThrow();
    expect(client.isConnected()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=standalone-client`
Expected: FAIL -- module does not exist.

- [ ] **Step 3: Implement the standalone client**

Create `packages/devtools-bridge/src/lib/standalone-client.ts`:

```typescript
import type { HarEntry } from '@wolfcola/devtools-core';

declare global {
  // eslint-disable-next-line no-var
  var __wolfcola_ws: WebSocket | undefined;
}

export interface StandaloneClientOptions {
  name: string;
  port?: number;
  pid?: number;
  framework?: string;
}

export class StandaloneClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly handshake: { type: 'HANDSHAKE'; name: string; pid?: number; framework?: string };

  constructor(private readonly opts: StandaloneClientOptions) {
    this.url = `ws://localhost:${opts.port ?? 19417}`;
    this.handshake = {
      type: 'HANDSHAKE',
      name: opts.name,
      pid: opts.pid,
      framework: opts.framework,
    };
  }

  async connect(): Promise<void> {
    if (globalThis.__wolfcola_ws?.readyState === WebSocket.OPEN) {
      this.ws = globalThis.__wolfcola_ws;
      return;
    }

    try {
      const ws = new WebSocket(this.url);
      await new Promise<void>((resolve) => {
        ws.onopen = () => {
          this.ws = ws;
          globalThis.__wolfcola_ws = ws;
          this.send(this.handshake);
          resolve();
        };
        ws.onerror = () => {
          this.ws = null;
          resolve();
        };
      });
    } catch {
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendSdkEvent(payload: unknown): void {
    this.send({ type: 'SDK_EVENT', payload });
  }

  sendNetworkEvent(payload: HarEntry): void {
    this.send({ type: 'NETWORK_EVENT', payload });
  }

  sendClear(): void {
    this.send({ type: 'CLEAR' });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    globalThis.__wolfcola_ws = undefined;
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
```

- [ ] **Step 4: Add `ws` as dev dependency for tests**

Run: `cd packages/devtools-bridge && pnpm add -D ws @types/ws`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=standalone-client`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools-bridge/src/lib/standalone-client*
git add packages/devtools-bridge/package.json
git commit -m "feat(devtools-bridge): add WebSocket client for standalone debugger"
```

---

## Task 5: Bridge -- Auto-Launch

**Files:**

- Create: `packages/devtools-bridge/src/lib/auto-launch.ts`
- Create: `packages/devtools-bridge/src/lib/auto-launch.test.ts`

- [ ] **Step 1: Write auto-launch tests**

Create `packages/devtools-bridge/src/lib/auto-launch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findBinary, launchDebugger } from './auto-launch.js';
import * as child_process from 'node:child_process';

vi.mock('node:child_process');

describe('findBinary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns path from PATH when binary exists', () => {
    vi.mocked(child_process.execFileSync).mockReturnValue(
      Buffer.from('/usr/local/bin/wolfcola-devtools\n'),
    );
    const result = findBinary();
    expect(result).toBe('/usr/local/bin/wolfcola-devtools');
  });

  it('returns null when binary is not found', () => {
    vi.mocked(child_process.execFileSync).mockImplementation(() => {
      throw new Error('not found');
    });
    const result = findBinary();
    expect(result).toBeNull();
  });
});

describe('launchDebugger', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses execFile-style spawn (not shell) with detached + ignore', () => {
    const mockProcess = { unref: vi.fn() };
    vi.mocked(child_process.spawn).mockReturnValue(mockProcess as never);

    launchDebugger('/usr/local/bin/wolfcola-devtools');

    expect(child_process.spawn).toHaveBeenCalledWith(
      '/usr/local/bin/wolfcola-devtools',
      [],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    );
    expect(mockProcess.unref).toHaveBeenCalled();
  });

  it('passes --port flag when port specified', () => {
    const mockProcess = { unref: vi.fn() };
    vi.mocked(child_process.spawn).mockReturnValue(mockProcess as never);

    launchDebugger('/usr/local/bin/wolfcola-devtools', 8888);

    expect(child_process.spawn).toHaveBeenCalledWith(
      '/usr/local/bin/wolfcola-devtools',
      ['--port', '8888'],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=auto-launch`
Expected: FAIL -- module does not exist.

- [ ] **Step 3: Implement auto-launch**

Create `packages/devtools-bridge/src/lib/auto-launch.ts`:

```typescript
import { execFileSync, spawn } from 'node:child_process';

const BINARY_NAME = 'wolfcola-devtools';

export function findBinary(): string | null {
  try {
    const result = execFileSync('which', [BINARY_NAME], { encoding: 'utf-8' });
    return result.trim() || null;
  } catch {
    return null;
  }
}

export function launchDebugger(binaryPath: string, port?: number): void {
  const args = port ? ['--port', String(port)] : [];
  const child = spawn(binaryPath, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export async function ensureRunning(port: number): Promise<boolean> {
  const binary = findBinary();
  if (!binary) return false;

  launchDebugger(binary, port);

  const delays = [50, 100, 200, 400, 800, 1000];
  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      const connected = await new Promise<boolean>((resolve) => {
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
      });
      if (connected) return true;
    } catch {
      continue;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=auto-launch`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-bridge/src/lib/auto-launch*
git commit -m "feat(devtools-bridge): add binary discovery and auto-launch"
```

---

## Task 6: Bridge -- `attachDebugger()` Public API

**Files:**

- Create: `packages/devtools-bridge/src/lib/attach-debugger.ts`
- Create: `packages/devtools-bridge/src/lib/attach-debugger.test.ts`
- Modify: `packages/devtools-bridge/src/index.ts`

- [ ] **Step 1: Write attachDebugger tests**

Create `packages/devtools-bridge/src/lib/attach-debugger.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { attachDebugger } from './attach-debugger.js';
import { uninstallFetchInterceptor } from './fetch-interceptor.js';

let wss: WebSocketServer;
let port: number;

beforeEach(async () => {
  wss = new WebSocketServer({ port: 0 });
  port = (wss.address() as { port: number }).port;
});

afterEach(async () => {
  uninstallFetchInterceptor();
  globalThis.__wolfcola_ws = undefined;
  globalThis.__wolfcola_fetch_patched = undefined;
  await new Promise<void>((resolve) => wss.close(() => resolve()));
});

describe('attachDebugger', () => {
  it('returns a handle with detach function', async () => {
    const handle = await attachDebugger({ name: 'test-app', port, autoLaunch: false });
    expect(handle.detach).toBeDefined();
    handle.detach();
  });

  it('connects to the debugger', async () => {
    const connected = new Promise<void>((resolve) => {
      wss.on('connection', () => resolve());
    });
    const handle = await attachDebugger({ name: 'test-app', port, autoLaunch: false });
    await connected;
    handle.detach();
  });

  it('sends handshake on connect', async () => {
    const handshake = new Promise<unknown>((resolve) => {
      wss.on('connection', (ws) => {
        ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      });
    });
    const handle = await attachDebugger({ name: 'my-app', port, autoLaunch: false });
    const msg = await handshake;
    expect(msg).toEqual(expect.objectContaining({ type: 'HANDSHAKE', name: 'my-app' }));
    handle.detach();
  });

  it('installs fetch interceptor when network: true', async () => {
    const handle = await attachDebugger({
      name: 'test-app',
      port,
      network: true,
      autoLaunch: false,
    });
    expect(globalThis.__wolfcola_fetch_patched).toBe(true);
    handle.detach();
  });

  it('does not install fetch interceptor when network: false', async () => {
    const handle = await attachDebugger({
      name: 'test-app',
      port,
      network: false,
      autoLaunch: false,
    });
    expect(globalThis.__wolfcola_fetch_patched).toBeUndefined();
    handle.detach();
  });

  it('detach cleans up WebSocket and interceptors', async () => {
    const handle = await attachDebugger({
      name: 'test-app',
      port,
      network: true,
      autoLaunch: false,
    });
    handle.detach();
    expect(globalThis.__wolfcola_ws).toBeUndefined();
    expect(globalThis.__wolfcola_fetch_patched).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=attach-debugger`
Expected: FAIL -- module does not exist.

- [ ] **Step 3: Implement attachDebugger**

Create `packages/devtools-bridge/src/lib/attach-debugger.ts`:

```typescript
import { StandaloneClient } from './standalone-client.js';
import { installFetchInterceptor, uninstallFetchInterceptor } from './fetch-interceptor.js';
import { ensureRunning } from './auto-launch.js';
import type { BridgeHandle } from './emit.js';

export interface AttachDebuggerOptions {
  name: string;
  port?: number;
  pid?: number;
  framework?: string;
  network?: boolean;
  autoLaunch?: boolean;
}

export async function attachDebugger(opts: AttachDebuggerOptions): Promise<BridgeHandle> {
  const port = opts.port ?? 19417;
  const client = new StandaloneClient({
    name: opts.name,
    port,
    pid: opts.pid,
    framework: opts.framework,
  });

  await client.connect();

  if (!client.isConnected() && opts.autoLaunch !== false) {
    const launched = await ensureRunning(port);
    if (launched) {
      await client.connect();
    }
  }

  if (opts.network !== false && client.isConnected()) {
    installFetchInterceptor((entry) => {
      client.sendNetworkEvent(entry);
    });
  }

  return {
    detach: () => {
      uninstallFetchInterceptor();
      client.close();
    },
  };
}
```

- [ ] **Step 4: Update bridge index.ts exports**

Add to `packages/devtools-bridge/src/index.ts`:

```typescript
export { attachDebugger } from './lib/attach-debugger.js';
export type { AttachDebuggerOptions } from './lib/attach-debugger.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern=attach-debugger`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools-bridge/src/lib/attach-debugger*
git add packages/devtools-bridge/src/index.ts
git commit -m "feat(devtools-bridge): add attachDebugger() public API"
```

---

## Task 7: Standalone -- WebSocket Server

**Files:**

- Create: `packages/devtools-standalone/src/ws-server.ts`
- Create: `packages/devtools-standalone/src/ws-server.test.ts`

- [ ] **Step 1: Write WebSocket server tests**

Create `packages/devtools-standalone/src/ws-server.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { Effect, Layer, Fiber } from 'effect';
import { WebSocket } from 'ws';
import { WsServer, WsServerLive } from './ws-server.js';
import { SessionManager, SessionManagerLive } from './session-manager.js';

const TestLayer = Layer.merge(WsServerLive, SessionManagerLive);

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

      const ws = await connectClient(port, { type: 'HANDSHAKE', name: 'test-app' });
      const response = await waitForMessage(ws);

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

      const ws = await connectClient(port, { type: 'HANDSHAKE', name: 'app-1' });
      await waitForMessage(ws);

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

      const ws = await connectClient(port, { type: 'HANDSHAKE', name: 'app-1' });
      const connMsg = (await waitForMessage(ws)) as { sessionId: string };

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-standalone && pnpm test -- --testPathPattern=ws-server`
Expected: FAIL -- module does not exist.

- [ ] **Step 3: Implement the WebSocket server**

Note: Starting with the `ws` library directly for simplicity. Can migrate to `@effect/platform` `SocketServer` in a follow-up.

Create `packages/devtools-standalone/src/ws-server.ts`:

```typescript
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
        Effect.async<never, never, never>((resume) => {
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
```

- [ ] **Step 4: Add `ws` as dependency**

Run: `cd packages/devtools-standalone && pnpm add ws && pnpm add -D @types/ws`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/devtools-standalone && pnpm test -- --testPathPattern=ws-server`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools-standalone/src/ws-server*
git add packages/devtools-standalone/package.json
git commit -m "feat(devtools-standalone): add WebSocket server with session routing"
```

---

## Task 8: Standalone -- IPC Bridge

**Files:**

- Create: `packages/devtools-standalone/src/ipc-bridge.ts`
- Create: `packages/devtools-standalone/src/ipc-bridge.test.ts`

- [ ] **Step 1: Write IPC bridge tests**

Create `packages/devtools-standalone/src/ipc-bridge.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { IPC_CHANNELS, createIpcHandlers } from './ipc-bridge.js';

describe('IPC_CHANNELS', () => {
  it('defines all expected channel names', () => {
    expect(IPC_CHANNELS.EVENT).toBe('wolfcola:event');
    expect(IPC_CHANNELS.DIAGNOSIS).toBe('wolfcola:diagnosis');
    expect(IPC_CHANNELS.SESSIONS).toBe('wolfcola:sessions');
    expect(IPC_CHANNELS.SWITCH_SESSION).toBe('wolfcola:switch-session');
    expect(IPC_CHANNELS.CLEAR_FLOW).toBe('wolfcola:clear-flow');
    expect(IPC_CHANNELS.EXPORT_JSON).toBe('wolfcola:export-json');
    expect(IPC_CHANNELS.EXPORT_MARKDOWN).toBe('wolfcola:export-markdown');
    expect(IPC_CHANNELS.SET_CLEAR_ON_RECONNECT).toBe('wolfcola:set-clear-on-reconnect');
  });
});

describe('createIpcHandlers', () => {
  it('returns handler functions for all channels', () => {
    const mockSessionManager = {
      list: vi.fn(),
      handleMessage: vi.fn(),
      setClearOnReconnect: vi.fn(),
      getSession: vi.fn(),
    };
    const handlers = createIpcHandlers(mockSessionManager as never);
    expect(handlers[IPC_CHANNELS.SESSIONS]).toBeDefined();
    expect(handlers[IPC_CHANNELS.CLEAR_FLOW]).toBeDefined();
    expect(handlers[IPC_CHANNELS.EXPORT_JSON]).toBeDefined();
    expect(handlers[IPC_CHANNELS.EXPORT_MARKDOWN]).toBeDefined();
    expect(handlers[IPC_CHANNELS.SET_CLEAR_ON_RECONNECT]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-standalone && pnpm test -- --testPathPattern=ipc-bridge`
Expected: FAIL -- module does not exist.

- [ ] **Step 3: Implement the IPC bridge**

Create `packages/devtools-standalone/src/ipc-bridge.ts`:

```typescript
import { Effect } from 'effect';
import { redactFlowState, renderFlowMarkdown, runDiagnosis } from '@wolfcola/devtools-core';
import type { SessionManagerShape } from './session-manager.js';

export const IPC_CHANNELS = {
  EVENT: 'wolfcola:event',
  DIAGNOSIS: 'wolfcola:diagnosis',
  SESSIONS: 'wolfcola:sessions',
  SWITCH_SESSION: 'wolfcola:switch-session',
  CLEAR_FLOW: 'wolfcola:clear-flow',
  EXPORT_JSON: 'wolfcola:export-json',
  EXPORT_MARKDOWN: 'wolfcola:export-markdown',
  SET_CLEAR_ON_RECONNECT: 'wolfcola:set-clear-on-reconnect',
} as const;

export function createIpcHandlers(mgr: SessionManagerShape) {
  return {
    [IPC_CHANNELS.SESSIONS]: () => Effect.runPromise(mgr.list()),

    [IPC_CHANNELS.CLEAR_FLOW]: (sessionId: string) =>
      Effect.runPromise(mgr.handleMessage(sessionId, { type: 'CLEAR' })),

    [IPC_CHANNELS.EXPORT_JSON]: async (sessionId: string) => {
      const state = await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'GET_STATE' }));
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      return JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), redacted: true, flow: redacted },
        null,
        2,
      );
    },

    [IPC_CHANNELS.EXPORT_MARKDOWN]: async (sessionId: string) => {
      const state = await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'GET_STATE' }));
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      const diagnosis = runDiagnosis((redacted as { events: never[] }).events);
      return renderFlowMarkdown(redacted as never, diagnosis);
    },

    [IPC_CHANNELS.SET_CLEAR_ON_RECONNECT]: (sessionId: string, value: boolean) =>
      Effect.runPromise(mgr.setClearOnReconnect(sessionId, value)),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/devtools-standalone && pnpm test -- --testPathPattern=ipc-bridge`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-standalone/src/ipc-bridge*
git commit -m "feat(devtools-standalone): add IPC channel definitions and handlers"
```

---

## Task 9: Standalone -- MCP Server

**Files:**

- Create: `packages/devtools-standalone/src/mcp/server.ts`
- Create: `packages/devtools-standalone/src/mcp/server.test.ts`

- [ ] **Step 1: Write MCP server tests**

Create `packages/devtools-standalone/src/mcp/server.test.ts`:

```typescript
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
        return await tools['list-sessions']();
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
        return await tools['list-sessions']();
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
        return await tools['get-flow-summary'](session.id);
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
        return await tools['get-events'](session.id);
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
        await tools['clear-flow'](session.id);
        return await tools['get-events'](session.id);
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
        await tools['set-clear-on-reconnect'](session.id, false);
        const updated = yield* mgr.findByName('app-1');
        return updated!.clearOnReconnect;
      }),
    );
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/devtools-standalone && pnpm test -- --testPathPattern=mcp`
Expected: FAIL -- module does not exist.

- [ ] **Step 3: Implement MCP tools**

Create `packages/devtools-standalone/src/mcp/server.ts`:

```typescript
import { Effect } from 'effect';
import {
  redactFlowState,
  renderFlowMarkdown,
  runDiagnosis,
  serializeDiagnosis,
} from '@wolfcola/devtools-core';
import type { SessionManagerShape } from '../session-manager.js';
import type { ExtendedFlowState } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';

export function createMcpTools(mgr: SessionManagerShape) {
  async function getState(sessionId: string): Promise<ExtendedFlowState | null> {
    const result = await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'GET_STATE' }));
    return result as ExtendedFlowState | null;
  }

  return {
    'list-sessions': async () => {
      const sessions = await Effect.runPromise(mgr.list());
      return sessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        connectedAt: s.connectedAt,
        clearOnReconnect: s.clearOnReconnect,
      }));
    },

    'get-events': async (
      sessionId: string,
      filters?: { type?: string; from?: number; to?: number },
    ) => {
      const state = await getState(sessionId);
      if (!state) return [];
      let events = state.events;
      if (filters?.type) events = events.filter((e) => e.type === filters.type);
      if (filters?.from) events = events.filter((e) => e.timestamp >= filters.from!);
      if (filters?.to) events = events.filter((e) => e.timestamp <= filters.to!);
      return events;
    },

    'get-flow-summary': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      return state.summary;
    },

    'get-diagnosis': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      const diagnosis = runDiagnosis(state.events);
      return serializeDiagnosis(diagnosis);
    },

    'get-event-detail': async (sessionId: string, eventId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      return state.events.find((e) => e.id === eventId) ?? null;
    },

    'search-events': async (
      sessionId: string,
      query: { urlPattern?: string; errorOnly?: boolean; oidcPhase?: string },
    ) => {
      const state = await getState(sessionId);
      if (!state) return [];
      return state.events.filter((e: AuthEvent) => {
        if (query.errorOnly && !e.flags.isError) return false;
        if (query.urlPattern && e.data._tag === 'network') {
          if (!new RegExp(query.urlPattern).test(e.data.url)) return false;
        }
        if (query.oidcPhase && e.oidcSemantics?.oidcPhase !== query.oidcPhase) return false;
        return true;
      });
    },

    'clear-flow': async (sessionId: string) => {
      await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'CLEAR' }));
    },

    'switch-session': async (_sessionId: string) => {
      return { switched: true };
    },

    'export-json': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      return JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), redacted: true, flow: redacted },
        null,
        2,
      );
    },

    'export-markdown': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      const diagnosis = runDiagnosis((redacted as { events: never[] }).events);
      return renderFlowMarkdown(redacted as never, diagnosis);
    },

    'set-clear-on-reconnect': async (sessionId: string, value: boolean) => {
      await Effect.runPromise(mgr.setClearOnReconnect(sessionId, value));
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/devtools-standalone && pnpm test -- --testPathPattern=mcp`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-standalone/src/mcp/
git commit -m "feat(devtools-standalone): add MCP tool implementations"
```

---

## Task 10: Standalone -- Electron Main, Preload, Renderer

**Files:**

- Create: `packages/devtools-standalone/src/main.ts`
- Create: `packages/devtools-standalone/src/preload.ts`
- Create: `packages/devtools-standalone/src/renderer.ts`

This task wires together tested components into Electron's process model. Electron main/preload/renderer require the Electron runtime and cannot be unit-tested with Vitest. The individual components they call are already tested in Tasks 1-9.

- [ ] **Step 1: Create the Electron main process**

Create `packages/devtools-standalone/src/main.ts`:

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { Effect, Layer } from 'effect';
import path from 'node:path';
import { SessionManager, SessionManagerLive } from './session-manager.js';
import { WsServer, WsServerLive } from './ws-server.js';
import { IPC_CHANNELS, createIpcHandlers } from './ipc-bridge.js';

const DEFAULT_PORT = 19417;

function getPort(): number {
  const portArg = process.argv.find((a) => a.startsWith('--port'));
  if (portArg) {
    const idx = process.argv.indexOf(portArg);
    const val = portArg.includes('=') ? portArg.split('=')[1] : process.argv[idx + 1];
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return DEFAULT_PORT;
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'WolfCola DevTools',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(import.meta.dirname, '..', 'assets', 'panel.html'));
  return win;
}

async function main() {
  await app.whenReady();

  const port = getPort();
  mainWindow = createWindow();

  const AppLayer = Layer.merge(SessionManagerLive, WsServerLive);

  const program = Effect.gen(function* () {
    const mgr = yield* SessionManager;
    const server = yield* WsServer;

    const handlers = createIpcHandlers(mgr);
    for (const [channel, handler] of Object.entries(handlers)) {
      ipcMain.handle(channel, (_event, ...args) => (handler as Function)(...args));
    }

    yield* Effect.fork(server.start(port));

    console.log(`[WolfCola DevTools] WebSocket server listening on port ${port}`);
  });

  await Effect.runPromise(Effect.provide(program, AppLayer));

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
}

main().catch(console.error);
```

- [ ] **Step 2: Create the preload script**

Create `packages/devtools-standalone/src/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc-bridge.js';

contextBridge.exposeInMainWorld('wolfcola', {
  onEvent: (callback: (event: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.EVENT, (_e, event) => callback(event));
  },
  onDiagnosis: (callback: (diagnosis: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.DIAGNOSIS, (_e, diagnosis) => callback(diagnosis));
  },
  onSessionsChanged: (callback: (sessions: unknown[]) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SESSIONS, (_e, sessions) => callback(sessions));
  },
  getSessions: () => ipcRenderer.invoke(IPC_CHANNELS.SESSIONS),
  switchSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_SESSION, sessionId),
  clearFlow: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_FLOW, sessionId),
  exportJson: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_JSON, sessionId),
  exportMarkdown: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_MARKDOWN, sessionId),
  setClearOnReconnect: (sessionId: string, value: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_CLEAR_ON_RECONNECT, sessionId, value),
});
```

- [ ] **Step 3: Create the renderer**

Create `packages/devtools-standalone/src/renderer.ts`:

```typescript
import type { ElmModule } from '@wolfcola/devtools-ui/ports';

declare const Elm: ElmModule;
declare const wolfcola: {
  onEvent: (cb: (event: unknown) => void) => void;
  onDiagnosis: (cb: (diagnosis: unknown) => void) => void;
  onSessionsChanged: (cb: (sessions: unknown[]) => void) => void;
  getSessions: () => Promise<unknown[]>;
  switchSession: (id: string) => Promise<void>;
  clearFlow: (id: string) => Promise<void>;
  exportJson: (id: string) => Promise<string | null>;
  exportMarkdown: (id: string) => Promise<string | null>;
  setClearOnReconnect: (id: string, value: boolean) => Promise<void>;
};

const app = Elm.Main.init({ node: document.getElementById('app'), flags: null });

wolfcola.onEvent((event) => {
  app.ports.receiveEvent.send(event);
});

wolfcola.onDiagnosis((diagnosis) => {
  app.ports.receiveDiagnosis.send(diagnosis);
});

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

let activeSessionId: string | null = null;

wolfcola.getSessions().then((sessions) => {
  if (sessions.length > 0) {
    activeSessionId = (sessions[0] as { id: string }).id;
  }
});

wolfcola.onSessionsChanged((sessions) => {
  if (!activeSessionId && sessions.length > 0) {
    activeSessionId = (sessions[0] as { id: string }).id;
  }
});

app.ports.exportJson?.subscribe(async () => {
  if (!activeSessionId) return;
  const json = await wolfcola.exportJson(activeSessionId);
  if (json) copyToClipboard(json);
});

app.ports.exportMarkdown?.subscribe(async () => {
  if (!activeSessionId) return;
  const md = await wolfcola.exportMarkdown(activeSessionId);
  if (md) copyToClipboard(md);
});

app.ports.clearFlow?.subscribe(() => {
  if (activeSessionId) wolfcola.clearFlow(activeSessionId);
});

app.ports.copyToClipboard?.subscribe((text: string) => {
  copyToClipboard(text);
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/devtools-standalone/src/main.ts
git add packages/devtools-standalone/src/preload.ts
git add packages/devtools-standalone/src/renderer.ts
git commit -m "feat(devtools-standalone): add Electron main, preload, and renderer"
```

---

## Task 11: Build Script & Assets

**Files:**

- Create: `packages/devtools-standalone/build.mjs`
- Create: `packages/devtools-standalone/assets/panel.html`

- [ ] **Step 1: Create panel.html**

Create `packages/devtools-standalone/assets/panel.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WolfCola DevTools</title>
    <link rel="stylesheet" href="panel.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="elm.js"></script>
    <script src="renderer.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create the build script**

Create `packages/devtools-standalone/build.mjs`:

```javascript
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const npx = (args) => execFileSync('npx', args, { stdio: 'inherit', cwd: __dirname });

mkdirSync('dist/src', { recursive: true });
mkdirSync('assets', { recursive: true });

npx([
  'esbuild',
  'src/main.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--outfile=dist/src/main.js',
  '--external:electron',
  '--packages=external',
]);

npx([
  'esbuild',
  'src/preload.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--outfile=dist/src/preload.js',
  '--external:electron',
  '--packages=external',
]);

npx([
  'esbuild',
  'src/renderer.ts',
  '--bundle',
  '--platform=browser',
  '--format=iife',
  '--outfile=assets/renderer.js',
]);

const uiDist = resolve(__dirname, '..', 'devtools-ui', 'dist');
cpSync(`${uiDist}/elm.js`, 'assets/elm.js');
cpSync(`${uiDist}/panel.css`, 'assets/panel.css');

console.log('[build] Standalone debugger built successfully.');
```

- [ ] **Step 3: Run the build**

Run: `cd packages/devtools-standalone && node --experimental-strip-types build.mjs`
Expected: Build completes, `dist/` and `assets/` populated.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools-standalone/build.mjs
git add packages/devtools-standalone/assets/panel.html
git commit -m "feat(devtools-standalone): add build script and HTML shell"
```

---

## Task 12: Bridge -- XHR and Node HTTP Interceptors

**Files:**

- Create: `packages/devtools-bridge/src/lib/xhr-interceptor.ts`
- Create: `packages/devtools-bridge/src/lib/xhr-interceptor.test.ts`
- Create: `packages/devtools-bridge/src/lib/node-http-interceptor.ts`
- Create: `packages/devtools-bridge/src/lib/node-http-interceptor.test.ts`

- [ ] **Step 1: Write XHR interceptor tests**

Create `packages/devtools-bridge/src/lib/xhr-interceptor.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { installXhrInterceptor, uninstallXhrInterceptor } from './xhr-interceptor.js';

describe('xhrInterceptor', () => {
  afterEach(() => {
    uninstallXhrInterceptor();
  });

  it('is idempotent -- does not double-patch', () => {
    installXhrInterceptor(() => {});
    installXhrInterceptor(() => {});
    expect(globalThis.__wolfcola_xhr_patched).toBe(true);
  });

  it('exports install and uninstall functions', () => {
    expect(typeof installXhrInterceptor).toBe('function');
    expect(typeof uninstallXhrInterceptor).toBe('function');
  });

  it('uninstall resets the patched flag', () => {
    installXhrInterceptor(() => {});
    expect(globalThis.__wolfcola_xhr_patched).toBe(true);
    uninstallXhrInterceptor();
    expect(globalThis.__wolfcola_xhr_patched).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement XHR interceptor**

Create `packages/devtools-bridge/src/lib/xhr-interceptor.ts`:

```typescript
import { isAuthRelated } from '@wolfcola/devtools-core';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

declare global {
  // eslint-disable-next-line no-var
  var __wolfcola_xhr_patched: boolean | undefined;
  // eslint-disable-next-line no-var
  var __wolfcola_original_xhr_open: typeof XMLHttpRequest.prototype.open | undefined;
  // eslint-disable-next-line no-var
  var __wolfcola_original_xhr_send: typeof XMLHttpRequest.prototype.send | undefined;
}

export function installXhrInterceptor(onEntry: (entry: HarEntry) => void): void {
  if (globalThis.__wolfcola_xhr_patched) return;
  if (typeof XMLHttpRequest === 'undefined') return;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  globalThis.__wolfcola_original_xhr_open = originalOpen;
  globalThis.__wolfcola_original_xhr_send = originalSend;
  globalThis.__wolfcola_xhr_patched = true;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as unknown as { _wolfcola_method: string })._wolfcola_method = method;
    (this as unknown as { _wolfcola_url: string })._wolfcola_url =
      typeof url === 'string' ? url : url.href;
    return originalOpen.call(this, method, url, ...(rest as [boolean?, string?, string?]));
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const url = (this as unknown as { _wolfcola_url: string })._wolfcola_url;
    const method = (this as unknown as { _wolfcola_method: string })._wolfcola_method;
    const start = performance.now();

    this.addEventListener('loadend', () => {
      if (!isAuthRelated(url)) return;

      const responseHeaders: HarHeader[] = [];
      const rawHeaders = this.getAllResponseHeaders();
      rawHeaders.split('\r\n').forEach((line) => {
        const idx = line.indexOf(':');
        if (idx > 0) {
          responseHeaders.push({
            name: line.slice(0, idx).trim(),
            value: line.slice(idx + 1).trim(),
          });
        }
      });

      const entry: HarEntry = {
        request: {
          url,
          method: method.toUpperCase(),
          headers: [],
          ...(typeof body === 'string' ? { postData: { text: body } } : {}),
        },
        response: {
          status: this.status,
          headers: responseHeaders,
          ...(this.responseText ? { content: { text: this.responseText } } : {}),
        },
        time: performance.now() - start,
      };
      onEntry(entry);
    });

    return originalSend.call(this, body);
  };
}

export function uninstallXhrInterceptor(): void {
  if (globalThis.__wolfcola_original_xhr_open && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.open = globalThis.__wolfcola_original_xhr_open;
  }
  if (globalThis.__wolfcola_original_xhr_send && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.send = globalThis.__wolfcola_original_xhr_send;
  }
  globalThis.__wolfcola_xhr_patched = undefined;
  globalThis.__wolfcola_original_xhr_open = undefined;
  globalThis.__wolfcola_original_xhr_send = undefined;
}
```

- [ ] **Step 3: Write Node HTTP interceptor tests**

Create `packages/devtools-bridge/src/lib/node-http-interceptor.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import {
  installNodeHttpInterceptor,
  uninstallNodeHttpInterceptor,
} from './node-http-interceptor.js';
import type { HarEntry } from '@wolfcola/devtools-core';

describe('nodeHttpInterceptor', () => {
  let capturedEntries: HarEntry[];
  let server: http.Server;
  let serverPort: number;

  afterEach(async () => {
    uninstallNodeHttpInterceptor();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  async function startTestServer(path: string, responseBody: string): Promise<void> {
    server = http.createServer((req, res) => {
      if (req.url === path) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(responseBody);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as { port: number }).port;
        resolve();
      });
    });
  }

  it('captures auth-related HTTP requests', async () => {
    capturedEntries = [];
    await startTestServer('/oauth2/token', '{"access_token":"tok"}');
    installNodeHttpInterceptor((entry) => capturedEntries.push(entry));

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { hostname: 'localhost', port: serverPort, path: '/oauth2/token', method: 'POST' },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.end('grant_type=client_credentials');
    });

    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].request.url).toContain('/oauth2/token');
    expect(capturedEntries[0].request.method).toBe('POST');
    expect(capturedEntries[0].response.status).toBe(200);
  });

  it('skips non-auth-related requests', async () => {
    capturedEntries = [];
    await startTestServer('/api/users', '[]');
    installNodeHttpInterceptor((entry) => capturedEntries.push(entry));

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { hostname: 'localhost', port: serverPort, path: '/api/users', method: 'GET' },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.end();
    });

    expect(capturedEntries).toHaveLength(0);
  });

  it('is idempotent', () => {
    installNodeHttpInterceptor(() => {});
    installNodeHttpInterceptor(() => {});
    expect(globalThis.__wolfcola_http_patched).toBe(true);
  });
});
```

- [ ] **Step 4: Implement Node HTTP interceptor**

Create `packages/devtools-bridge/src/lib/node-http-interceptor.ts`:

```typescript
import http from 'node:http';
import https from 'node:https';
import { isAuthRelated } from '@wolfcola/devtools-core';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

declare global {
  // eslint-disable-next-line no-var
  var __wolfcola_http_patched: boolean | undefined;
  // eslint-disable-next-line no-var
  var __wolfcola_original_http_request: typeof http.request | undefined;
  // eslint-disable-next-line no-var
  var __wolfcola_original_https_request: typeof https.request | undefined;
}

function patchModule(
  mod: typeof http | typeof https,
  protocol: string,
  onEntry: (entry: HarEntry) => void,
): typeof http.request {
  const original = mod.request;

  return function patchedRequest(...args: Parameters<typeof http.request>) {
    const req = original.apply(mod, args);
    const opts = typeof args[0] === 'string' ? new URL(args[0]) : args[0];
    const url =
      typeof args[0] === 'string'
        ? args[0]
        : `${protocol}//${(opts as http.RequestOptions).hostname ?? 'localhost'}${(opts as http.RequestOptions).path ?? '/'}`;
    const method = ((opts as http.RequestOptions).method ?? 'GET').toUpperCase();

    if (!isAuthRelated(url)) return req;

    const chunks: Buffer[] = [];
    const originalWrite = req.write.bind(req);
    const start = performance.now();

    req.write = function (chunk: unknown, ...rest: unknown[]) {
      if (Buffer.isBuffer(chunk)) chunks.push(chunk);
      else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
      return originalWrite(chunk, ...(rest as [BufferEncoding?, (() => void)?]));
    };

    req.on('response', (res: http.IncomingMessage) => {
      const responseChunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => responseChunks.push(chunk));
      res.on('end', () => {
        const responseHeaders: HarHeader[] = [];
        const rawHeaders = res.rawHeaders;
        for (let i = 0; i < rawHeaders.length; i += 2) {
          responseHeaders.push({ name: rawHeaders[i], value: rawHeaders[i + 1] });
        }
        const requestBody = Buffer.concat(chunks).toString('utf-8');
        const responseBody = Buffer.concat(responseChunks).toString('utf-8');

        const entry: HarEntry = {
          request: {
            url,
            method,
            headers: [],
            ...(requestBody ? { postData: { text: requestBody } } : {}),
          },
          response: {
            status: res.statusCode ?? 0,
            headers: responseHeaders,
            ...(responseBody ? { content: { text: responseBody } } : {}),
          },
          time: performance.now() - start,
        };
        onEntry(entry);
      });
    });

    return req;
  } as typeof http.request;
}

export function installNodeHttpInterceptor(onEntry: (entry: HarEntry) => void): void {
  if (globalThis.__wolfcola_http_patched) return;

  globalThis.__wolfcola_original_http_request = http.request;
  globalThis.__wolfcola_original_https_request = https.request;
  globalThis.__wolfcola_http_patched = true;

  http.request = patchModule(http, 'http:', onEntry);
  https.request = patchModule(https, 'https:', onEntry);
}

export function uninstallNodeHttpInterceptor(): void {
  if (globalThis.__wolfcola_original_http_request) {
    http.request = globalThis.__wolfcola_original_http_request;
  }
  if (globalThis.__wolfcola_original_https_request) {
    https.request = globalThis.__wolfcola_original_https_request;
  }
  globalThis.__wolfcola_http_patched = undefined;
  globalThis.__wolfcola_original_http_request = undefined;
  globalThis.__wolfcola_original_https_request = undefined;
}
```

- [ ] **Step 5: Run all interceptor tests**

Run: `cd packages/devtools-bridge && pnpm test -- --testPathPattern="(xhr|node-http)-interceptor"`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools-bridge/src/lib/xhr-interceptor*
git add packages/devtools-bridge/src/lib/node-http-interceptor*
git commit -m "feat(devtools-bridge): add XHR and Node http/https interceptors"
```

---

## Task 13: Integration -- End-to-End Smoke Test

**Files:**

- Create: `packages/devtools-standalone/src/integration.test.ts`

- [ ] **Step 1: Write end-to-end integration test**

Create `packages/devtools-standalone/src/integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Effect, Layer, Fiber } from 'effect';
import { WebSocket } from 'ws';
import { WsServer, WsServerLive } from './ws-server.js';
import { SessionManager, SessionManagerLive } from './session-manager.js';

const TestLayer = Layer.merge(WsServerLive, SessionManagerLive);

describe('Integration: Bridge -> Server -> Session', () => {
  it('full flow: handshake -> SDK event -> state updated', async () => {
    const port = 19900 + Math.floor(Math.random() * 100);

    const program = Effect.gen(function* () {
      const server = yield* WsServer;
      const mgr = yield* SessionManager;
      const fiber = yield* Effect.fork(server.start(port));
      yield* Effect.sleep('100 millis');

      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const conn = new WebSocket(`ws://localhost:${port}`);
        conn.on('open', () => resolve(conn));
        conn.on('error', reject);
      });

      ws.send(JSON.stringify({ type: 'HANDSHAKE', name: 'integration-app' }));
      const connMsg = await new Promise<{ type: string; sessionId: string }>((resolve) => {
        ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      });
      expect(connMsg.type).toBe('CONNECTED');

      ws.send(
        JSON.stringify({
          type: 'NETWORK_EVENT',
          payload: {
            request: {
              url: 'https://auth.example.com/oauth2/token',
              method: 'POST',
              headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
              postData: { text: 'grant_type=authorization_code&code=abc123' },
            },
            response: {
              status: 200,
              headers: [{ name: 'content-type', value: 'application/json' }],
              content: { text: '{"access_token":"tok","token_type":"Bearer"}' },
            },
            time: 150,
          },
        }),
      );

      yield* Effect.sleep('300 millis');

      const state = yield* mgr.handleMessage(connMsg.sessionId, { type: 'GET_STATE' });
      const events = (state as { events: unknown[] }).events;
      expect(events.length).toBeGreaterThanOrEqual(1);

      ws.close();
      yield* Fiber.interrupt(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  it('multiple clients get independent sessions', async () => {
    const port = 19950 + Math.floor(Math.random() * 50);

    const program = Effect.gen(function* () {
      const server = yield* WsServer;
      const mgr = yield* SessionManager;
      const fiber = yield* Effect.fork(server.start(port));
      yield* Effect.sleep('100 millis');

      const connect = (name: string) =>
        new Promise<{ ws: WebSocket; sessionId: string }>((resolve, reject) => {
          const ws = new WebSocket(`ws://localhost:${port}`);
          ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'HANDSHAKE', name }));
            ws.on('message', (data) => {
              const msg = JSON.parse(data.toString());
              if (msg.type === 'CONNECTED') resolve({ ws, sessionId: msg.sessionId });
            });
          });
          ws.on('error', reject);
        });

      const client1 = await connect('app-1');
      const client2 = await connect('app-2');

      expect(client1.sessionId).not.toBe(client2.sessionId);

      const sessions = yield* mgr.list();
      expect(sessions).toHaveLength(2);

      client1.ws.close();
      client2.ws.close();
      yield* Fiber.interrupt(fiber);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd packages/devtools-standalone && pnpm test -- --testPathPattern=integration`
Expected: All PASS.

- [ ] **Step 3: Run full test suite across both packages**

Run: `pnpm --filter @wolfcola/devtools-standalone test && pnpm --filter @wolfcola/devtools-bridge test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools-standalone/src/integration.test.ts
git commit -m "test(devtools-standalone): add end-to-end integration tests"
```
