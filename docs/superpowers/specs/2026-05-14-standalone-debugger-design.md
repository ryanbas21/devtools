# Standalone Debugger App — Design Spec

## Overview

A standalone Electron desktop app that serves as an external OIDC/OAuth2 debugger. Applications opt in by adding `devtools-bridge` to their codebase. When the app starts in dev mode, the bridge spawns the debugger window and streams SDK events + instrumented network traffic over a WebSocket connection. This follows the `react-devtools` model — a globally installed tool that apps connect to automatically.

## Goals

- Provide the same OIDC/OAuth2 debugging experience as the Chrome extension, outside the browser
- Zero impact on the app being debugged (graceful degradation if debugger is unavailable)
- Reuse existing packages (`devtools-types`, `devtools-core`, `devtools-ui`) with no changes
- Support multiple connected apps simultaneously
- Handle HMR gracefully

## Non-Goals (v1)

- Persistent session storage (disk/SQLite) — in-memory only, export via JSON/Markdown
- MITM proxy mode for raw network capture — network instrumentation via bridge only
- Cross-machine debugging (remote connections) — localhost only

---

## Package Structure

### New: `packages/devtools-standalone`

The Electron app, installed globally via `npm i -g @wolfcola/devtools-standalone`.

**Main process (`main.ts`):**

- WebSocket server via `@effect/platform` `SocketServer` + `Socket` on port `19417`
- One `EventStoreInMemory` instance per connected session
- Routes incoming messages through `MessageHandler` from `devtools-core`
- Runs `DiagnosisEngine` on each event
- Forwards processed events + diagnosis results to renderer via Electron IPC
- Manages window creation, lifecycle, system tray

**Preload script (`preload.ts`):**

- Exposes `wolfcola` API on `contextBridge`:
  - `onEvent(callback)` — receive events from main process
  - `onDiagnosis(callback)` — receive diagnosis results
  - `exportJson()` / `exportMarkdown()` — trigger exports
  - `clearFlow()` — clear current session
  - `getSessions()` / `switchSession(id)` — multi-client management

**Renderer (`renderer.ts`):**

- Nearly identical to existing `panel.ts` from `devtools-extension`
- Initializes Elm app, wires up ports
- Uses `window.wolfcola.onEvent()` instead of `chrome.runtime.onMessage`
- Elm ports outbound → call preload API instead of `chrome.runtime.sendMessage`

**Build:**

- `electron-builder` for packaging/distribution
- esbuild for main/preload/renderer bundling (same toolchain as extension)
- Copy `devtools-ui` assets (elm.js, panel.css, panel.html) into Electron app

### Enhanced: `packages/devtools-bridge`

New `attachDebugger()` API alongside existing bridge functions.

```typescript
import { attachDebugger } from '@wolfcola/devtools-bridge';

attachDebugger({
  name: 'my-app', // shown in debugger session tab
  port: 19417, // default
  network: true, // instrument fetch/XHR
  autoLaunch: true, // spawn debugger if not running
});
```

### Unchanged

- `devtools-types` — Effect Schema definitions
- `devtools-core` — Annotators, diagnosis, event store, message handler

### Minor Changes

- `devtools-ui` — Elm UI + ports. Requires small additions: session tab bar, "Clear on reconnect" toggle, and "waiting for connection" empty state. All existing functionality unchanged.

---

## Communication Architecture

```
User's App (Node/Browser)           Standalone Debugger (Electron)

devtools-bridge                     Main Process
  WebSocket client ──── WS ────>      WebSocket server (:19417)
  fetch/XHR interceptor                MessageHandler (devtools-core)
  SDK bridges (OIDC, etc)              EventStoreInMemory (per session)
  auto-launch logic                    DiagnosisEngine
                                       IPC to renderer

                                    Renderer Process
                                       Elm UI (devtools-ui)
                                       Ports adapter
                                       Preload (IPC bridge)
```

### WebSocket Protocol

Messages from bridge to debugger use existing message types:

- `{ type: 'SDK_EVENT', payload: AuthEvent }` — SDK-observed events
- `{ type: 'NETWORK_EVENT', payload: AuthEvent }` — Instrumented fetch/XHR events
- `{ type: 'CLEAR' }` — Reset flow

Messages from debugger to bridge:

- `{ type: 'CONNECTED', sessionId: string }` — Acknowledge connection
- `{ type: 'CONFIG', payload: object }` — Request bridge config changes

All message types defined as Effect Schemas for runtime validation on both ends.

### Handshake

On WebSocket connection, the bridge sends:

```json
{ "type": "HANDSHAKE", "name": "my-app", "pid": 12345, "framework": "next" }
```

The debugger responds with `CONNECTED` and a `sessionId`.

### Effect Platform Integration

The server uses `@effect/platform`'s `SocketServer` and `Socket` services:

- `SocketServer` manages connection lifecycle (accept, close) as an Effect `Layer`
- Each `Socket` connection is handled in an `Effect.gen` scope with automatic resource cleanup
- Incoming messages decoded via Effect `Schema` for type-safe message handling
- Composes in the same `ManagedRuntime` as `EventStoreInMemory` and `MessageHandler`
- The bridge client uses `@effect/platform`'s `Socket` client for the WebSocket connection

---

## Network Instrumentation

The bridge captures network traffic by intercepting HTTP APIs in the app's runtime.

### `fetch` interception

- Wrap `globalThis.fetch` with a transparent interceptor
- Capture URL, method, headers, body before the request
- Capture status, headers, cloned body after the response
- Convert raw request/response to HAR-like shape for `buildNetworkEvent`
- Only auth-related traffic passes the `isAuthRelated` filter before sending

### `XMLHttpRequest` interception

- Monkey-patch `XMLHttpRequest.prototype.open` and `send`
- Same capture logic as fetch
- Lower priority (most modern apps use fetch)

### Node.js `http`/`https` interception

- Patch `http.request` and `https.request`
- Enables server-side OIDC flow capture (Next.js, Express, etc.)
- Same conversion to `AuthEvent` via `buildNetworkEvent`

### Filtering

The existing `network-observer.ts` has 19 OIDC endpoint patterns for the `isAuthRelated` check. Non-auth traffic is dropped before sending over WebSocket, so the bridge does not flood the debugger.

---

## Auto-Launch & Discovery

1. **Connection attempt** — Try `ws://localhost:19417`. If it connects, done.
2. **Find the binary** — Check `PATH` for `wolfcola-devtools`, common global install locations, fall back to `npx @wolfcola/devtools-standalone`.
3. **Spawn** — `child_process.spawn(binaryPath, { detached: true, stdio: 'ignore' })` then `unref()` so the debugger outlives the app.
4. **Retry** — Poll with backoff (50ms, 100ms, 200ms, up to 2s). If still can't connect after ~3s, log a warning and continue without the debugger.

### Graceful Degradation

- `autoLaunch: false` → try to connect, no error if unavailable
- Debugger crashes mid-session → bridge buffers briefly, attempts reconnect
- No debugger at all → app runs normally, zero impact

### Port Configuration

- Default: `19417`
- Configurable via `--port` flag on Electron app and `port` option in `attachDebugger()`
- If port is taken, debugger logs error and exits

---

## HMR Handling

### Singleton Guards

- WebSocket connection stored on `globalThis.__wolfcola_ws` — reused across HMR re-evaluations
- Network interceptor flags (`globalThis.__wolfcola_fetch_patched`, etc.) prevent duplicate patching

### Stable Session Identity

- Session ID derived from `name` + app identity, not WebSocket connection ID
- Bridge reconnects with same session identity → debugger reattaches to existing session tab

### Clear on Reconnect Toggle

- Toggle in the debugger UI per session: "Clear on reconnect" (on by default)
- Toggle on → EventStore cleared on reconnect, fresh timeline
- Toggle off → new events appended to existing timeline
- Preference stored per-session in the Elm model

---

## Session Management

### Multi-Client Support

- WebSocket server accepts multiple connections
- Each connection gets its own `EventStoreInMemory` instance
- Session identity: `{ id, name, pid?, connectedAt }`

### UI

- Tab bar across the top of the window (above timeline/flow/inspector)
- Each tab shows app name + connection status (green = live, grey = disconnected)
- Clicking a tab switches the Elm UI to that session's events
- Renderer holds multiple event stores, swaps which one feeds Elm ports on tab switch

### Lifecycle

- App connects → new session tab appears
- App disconnects → tab stays, marked "disconnected", data preserved for review
- User closes a tab → session data cleared
- Debugger restarts → all sessions lost (v1)

---

## Elm UI Changes

Minimal changes to `devtools-ui`:

- **Session tab bar** — New Elm module or addition to `View.elm` rendering the tab bar above existing UI
- **"Clear on reconnect" toggle** — Per-session toggle in the tab bar area
- **"Waiting for connection" state** — Shown when no clients are connected

All existing timeline, flow graph, inspector, diagnosis, and export functionality remains unchanged.

---

## MCP Server

The standalone debugger exposes an MCP (Model Context Protocol) server so local LLMs can query and control OIDC debugging sessions. This runs alongside the WebSocket server in the Electron main process, sharing the same `EventStore` and `DiagnosisEngine` services.

### Transport

- Stdio transport — the Electron app accepts `--mcp` flag to start in MCP server mode (no window, stdio only)
- Alternatively, the MCP server runs on a local HTTP/SSE endpoint alongside the WebSocket server when the app is running normally
- Configurable in Claude Code / Cursor / other MCP clients via standard `mcp.json`

### Read Tools

| Tool               | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `list-sessions`    | List all connected/disconnected debugging sessions                            |
| `get-events`       | Get all events for a session (with optional filters: type, time range)        |
| `get-flow-summary` | Get the summary for a session (node count, error count, CORS flags, duration) |
| `get-diagnosis`    | Get the latest diagnosis results for a session                                |
| `get-event-detail` | Get full detail for a specific event by ID (headers, body, OIDC semantics)    |
| `search-events`    | Search events by URL pattern, error status, or OIDC phase                     |

### Control Tools

| Tool                     | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `clear-flow`             | Clear all events in a session                         |
| `switch-session`         | Switch the active session in the debugger UI          |
| `export-json`            | Export a session's flow state as JSON                 |
| `export-markdown`        | Export a session's flow state as Markdown             |
| `set-clear-on-reconnect` | Toggle the "Clear on reconnect" setting for a session |

### Implementation

- Built with `@effect/platform` and the MCP SDK
- Tools are thin wrappers around the same `EventStoreService` and `DiagnosisEngine` that the Electron renderer uses via IPC
- Effect Schemas used for tool input/output validation
- The MCP server and the Electron UI are two equal consumers of the same backend services

---

## Distribution

- Published to npm as `@wolfcola/devtools-standalone`
- Global install: `npm i -g @wolfcola/devtools-standalone`
- Binary name: `wolfcola-devtools`
- Packaged via `electron-builder` for macOS, Linux, Windows
- Future: standalone downloadable binaries (GitHub Releases)
