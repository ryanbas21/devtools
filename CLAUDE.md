# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & test commands

```bash
pnpm test                                    # Vitest — all packages
pnpm --filter @wolfcola/devtools-core test   # single package
pnpm test -- --testPathPattern=fetch         # filter by test name

pnpm build                                   # build all packages
pnpm --filter @wolfcola/devtools-ui build    # Elm UI → dist/elm.js
pnpm --filter @wolfcola/devtools-extension build  # esbuild → dist/

pnpm typecheck                               # tsc --build (all)
pnpm lint                                    # eslint
pnpm syncpack:lint                           # version alignment check
```

Pre-commit hooks (lefthook): eslint, prettier, syncpack-lint. All run automatically.

## Architecture

**Monorepo** (pnpm workspaces, 11 packages). Chrome/Firefox devtools extension for OIDC/OAuth2 debugging.

### Data flow

```
App (devtools-bridge)
  ├─ postMessage (Chrome ext) ──→ Content Script → Service Worker → DevTools Panel
  └─ WebSocket (standalone)  ──→ Electron main process → IPC → Renderer
```

Both paths feed into the same pipeline: `handleMessage` → `EventStoreService` → `DiagnosisEngine` → UI (Elm ports).

### Core packages

- **devtools-types** — Effect Schema definitions (`AuthEvent`, `FlowState`). Source of truth for all event shapes.
- **devtools-core** — Pure logic: annotators (network, OIDC, CORS, DPoP, JWT), diagnosis engine, export (redact + markdown), `EventStoreService` (abstract), `handleMessage`. No UI deps.
- **devtools-ui** — Elm app compiling to `dist/elm.js`. TypeScript communicates via ports defined in `ports.ts`.
- **devtools-bridge** — SDK adapter for app developers. `attachOidcBridge()`, `attachDebugger()`, network interceptors (fetch/XHR/Node HTTP).
- **devtools-extension** — Chrome/Firefox WebExtension. Service worker holds `ManagedRuntime` with `EventStoreChromeLive`.
- **devtools-standalone** — Electron desktop app. WebSocket server (`@effect/platform` NodeSocketServer), session management, MCP server (`@effect/ai`).

### Effect patterns used

- `Context.Tag` + `Layer` for dependency injection (`EventStoreService`, `SessionManager`, `WsServer`)
- `ManagedRuntime.make(Layer)` to run Effects from callback-world (service worker, Electron main)
- `Schema.parseJson(Schema)` for WebSocket protocol validation
- `@effect/platform` `NodeSocketServer.makeWebSocket` for the standalone WS server — handles bind lifecycle, `FiberSet` for concurrent connections, scoped cleanup
- `@effect/ai` `Tool.make` + `Toolkit` + `McpServer.layerStdio` for MCP integration
- Version catalog in `pnpm-workspace.yaml` — use `catalog:effect` for Effect deps

### Elm UI

- Elm source in `packages/devtools-ui/src/`. Build: `pnpm --filter @wolfcola/devtools-ui build`
- Must rebuild Elm UI before extension/standalone if Elm files changed
- Ports interface: `packages/devtools-ui/src/ports.ts` — `receiveEvent`, `receiveDiagnosis`, `exportJson`, `clearFlow`, etc.

### E2E tests

- Playwright in `e2e/`. Run: `cd e2e && pnpm test:chrome`
- Uses shared Chromium persistent context with `--load-extension`
- Known flaky: `event-selection-inspector.test.ts:98` (tab switching)

## Key conventions

- **Effect over raw JS** — Use Effect services, Layers, Schemas for new code. Use `Schema.decodeUnknown` (effectful) inside generators, not `decodeUnknownSync`.
- **No `as any` / `as never`** — Use proper types. At interop boundaries (Electron IPC, XHR monkey-patching), use narrowing casts (`as unknown as SpecificType`) with a comment explaining why.
- **TDD** — Write tests first. Effect services tested via `Effect.runPromise(Effect.provide(program, TestLayer))`.
- **`repos/effect/` is read-only** — Vendored Effect source for API exploration. Never modify.
- **Packages build with esbuild** — `build.mjs` scripts. Standalone Electron bundles as CJS (`.cjs`) with `--external:electron`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `ryanbas21/devtools`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Effect reference source

The Effect repository is vendored at `repos/effect/` as a git subtree (read-only reference material). Use it to explore APIs, find usage examples, and understand implementation details. **Never modify files under `repos/`.**

To update the vendored source:

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
```
