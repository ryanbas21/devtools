---
title: '@wolfcola/devtools-standalone'
description: 'Standalone Electron OIDC/OAuth2 debugger with WebSocket server and MCP integration'
section: packages
order: 5
---

# @wolfcola/devtools-standalone

Standalone Electron desktop app for OIDC/OAuth2 debugging. Apps connect via WebSocket using `@wolfcola/devtools-bridge`. Also runs as a headless MCP server for AI agent integration.

## Installation

This is a private workspace package — it is not published to npm. Build and run it from the monorepo:

```bash
pnpm --filter @wolfcola/devtools-ui build
pnpm --filter @wolfcola/devtools-standalone build
pnpm --filter @wolfcola/devtools-standalone start
```

<callout type="info">The Elm UI must be built before the standalone package, since the build copies `elm.js` and `panel.css` from devtools-ui.</callout>

**Dependencies:** `effect`, `@effect/platform`, `@effect/platform-node`, `@effect/ai`, `ws`, `electron`, `@wolfcola/devtools-core`, `@wolfcola/devtools-types`, `@wolfcola/devtools-ui`

## Modes

### GUI Mode (default)

Opens an Electron window with the same Elm UI as the browser extension. A WebSocket server binds to `127.0.0.1:19417` (localhost only).

```bash
electron dist/src/main.cjs              # default port
electron dist/src/main.cjs --port 9000  # custom port
```

### MCP Mode

Headless stdio-based MCP server for Claude and other AI agents. Same session management and tools, no UI.

```bash
electron dist/src/main.cjs --mcp
```

## WebSocket Protocol

All messages are JSON, validated with Effect Schema on the server side.

### Handshake

```json
// Client →
{ "type": "HANDSHAKE", "name": "my-app", "pid": 1234, "framework": "react" }

// Server →
{ "type": "CONNECTED", "sessionId": "550e8400-..." }
```

### Event Ingestion

```json
// SDK event
{ "type": "SDK_EVENT", "payload": { ... } }

// Network event (HAR entry format)
{ "type": "NETWORK_EVENT", "payload": { "request": {}, "response": {}, "time": 0 } }
```

### Clear and Error

```json
// Clear session events
{ "type": "CLEAR" }

// Server error response
{ "type": "ERROR", "message": "Failed to process message" }
```

## MCP Tools

When running in MCP mode, the following tools are available:

| Tool                     | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `list-sessions`          | List all connected and disconnected sessions          |
| `get-events`             | Get events with optional type/time filtering          |
| `get-flow-summary`       | Summary metrics (node count, error count, etc.)       |
| `get-diagnosis`          | Run diagnosis engine on session events                |
| `get-event-detail`       | Full event details (headers, body, OIDC semantics)    |
| `search-events`          | Find events by URL pattern, error-only, or OIDC phase |
| `clear-flow`             | Clear all events in a session                         |
| `export-json`            | Redacted JSON export                                  |
| `export-markdown`        | Redacted Markdown export with diagnosis               |
| `set-clear-on-reconnect` | Toggle auto-clear on session reconnect                |

All queries apply `redactFlowState` before returning data — sensitive values (tokens, passwords, credentials) are never exposed through MCP.

## Effect Services

| Service           | Layer                 | Purpose                                                                      |
| ----------------- | --------------------- | ---------------------------------------------------------------------------- |
| `SessionManager`  | `SessionManagerLive`  | In-memory session state (`Ref<Session[]>`) with per-session `ManagedRuntime` |
| `WsServer`        | `WsServerLive`        | `@effect/platform-node` WebSocket server with Schema-validated protocol      |
| `WolfcolaToolkit` | `WolfcolaToolkitLive` | `@effect/ai` MCP tool definitions                                            |

The `SessionManager` creates a fresh `ManagedRuntime` with its own `EventStoreInMemory` for each session. This isolates session state and allows clean disposal on disconnect.

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
   │ Your App │   │ Elm UI      │
   │          │   │ (Renderer)  │
   └──────────┘   └─────────────┘
```

Events flow through: `StandaloneClient → WsServer → SessionManager.ingestEvent → handleMessage → EventStoreService → DiagnosisEngine → IPC → Elm UI`

<callout type="warning">All state is transient — in-memory only. Closing the debugger loses all captured events. Use the export tools (JSON or Markdown) to save session data before closing.</callout>
