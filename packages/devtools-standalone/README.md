# @wolfcola/devtools-standalone

Standalone Electron desktop app for OIDC/OAuth2 debugging — no browser extension required. Apps connect via WebSocket using [`@wolfcola/devtools-bridge`](../devtools-bridge). Also runs as a headless MCP server for AI agent integration.

## Contents

- [Quick start](#quick-start)
- [Modes](#modes)
- [WebSocket protocol](#websocket-protocol)
- [MCP tools](#mcp-tools)
- [Architecture](#architecture)
- [Effect services](#effect-services)

---

## Quick start

```bash
# Build (requires devtools-ui to be built first)
pnpm --filter @wolfcola/devtools-ui build
pnpm --filter @wolfcola/devtools-standalone build

# Run the Electron app
pnpm --filter @wolfcola/devtools-standalone start

# Run as headless MCP server
electron dist/src/main.cjs --mcp
```

Connect your app:

```ts
import { attachDebugger } from '@wolfcola/devtools-bridge';

const handle = await attachDebugger({ name: 'my-app' });
// handle.connected → true if WebSocket is open
// handle.detach()  → cleanup
```

---

## Modes

### GUI mode (default)

Electron window (1200x800) with the Elm UI. A WebSocket server binds to `127.0.0.1:19417` (localhost only). Connected apps appear as sessions; events flow into the same timeline/flow/diagnosis views as the browser extension.

```bash
electron dist/src/main.cjs              # default port
electron dist/src/main.cjs --port 9000  # custom port
```

### MCP mode (`--mcp`)

Headless stdio-based MCP server for Claude and other AI agents. Same session management and tools, no UI.

```bash
electron dist/src/main.cjs --mcp
```

---

## WebSocket protocol

All messages are JSON. The server validates incoming messages with Effect Schema.

### Handshake

```
Client → { "type": "HANDSHAKE", "name": "my-app", "pid": 1234, "framework": "react" }
Server → { "type": "CONNECTED", "sessionId": "550e8400-..." }
```

### Event ingestion

```
Client → { "type": "SDK_EVENT", "payload": { ... } }
Client → { "type": "NETWORK_EVENT", "payload": { "request": ..., "response": ..., "time": ... } }
```

### Clear

```
Client → { "type": "CLEAR" }
```

### Errors

```
Server → { "type": "ERROR", "message": "Failed to process message" }
```

---

## MCP tools

| Tool                     | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `list-sessions`          | List all connected/disconnected sessions              |
| `get-events`             | Get events with optional type/time filtering          |
| `get-flow-summary`       | Summary metrics (node count, error count, etc.)       |
| `get-diagnosis`          | Run diagnosis engine on session events                |
| `get-event-detail`       | Full event details (headers, body, OIDC semantics)    |
| `search-events`          | Find events by URL pattern, error-only, or OIDC phase |
| `clear-flow`             | Clear all events in a session                         |
| `export-json`            | Redacted JSON export                                  |
| `export-markdown`        | Redacted Markdown export with diagnosis               |
| `set-clear-on-reconnect` | Toggle auto-clear on session reconnect                |

All queries apply `redactFlowState` before returning data.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Electron Main                   │
│                                                 │
│  SessionManager (Ref<Session[]>)                │
│    • create / reconnect / disconnect            │
│    • per-session ManagedRuntime + EventStore     │
│                                                 │
│  ┌────────────┐  ┌───────────┐  ┌───────────┐  │
│  │  WsServer  │  │ IpcBridge │  │ MCP Server│  │
│  │  (Effect)  │  │ (Electron)│  │  (Stdio)  │  │
│  └─────┬──────┘  └─────┬─────┘  └───────────┘  │
│        │               │                        │
└────────┼───────────────┼────────────────────────┘
         │               │
    WebSocket        IPC Channels
         │               │
         ▼               ▼
   ┌──────────┐   ┌─────────────┐
   │ SDK /    │   │ Elm UI      │
   │ App      │   │ (Renderer)  │
   └──────────┘   └─────────────┘
```

Events flow: `StandaloneClient → WsServer → SessionManager.ingestEvent → handleMessage → EventStoreService → DiagnosisEngine → IPC → Elm UI`

---

## Effect services

| Service           | Layer                 | Purpose                                                                      |
| ----------------- | --------------------- | ---------------------------------------------------------------------------- |
| `SessionManager`  | `SessionManagerLive`  | In-memory session state (`Ref<Session[]>`) with per-session `ManagedRuntime` |
| `WsServer`        | `WsServerLive`        | `@effect/platform-node` WebSocket server with Schema-validated protocol      |
| `WolfcolaToolkit` | `WolfcolaToolkitLive` | `@effect/ai` MCP tool definitions                                            |

---

## Testing

```bash
pnpm --filter @wolfcola/devtools-standalone test
```

Unit tests cover protocol schema validation, session manager operations, WebSocket handshake/event flow, and MCP tool invocation.

## License

MIT
