---
title: 'Standalone Debugger'
description: 'Use the standalone Electron debugger for OIDC/OAuth2 debugging without a browser extension'
section: guides
order: 3
---

# Standalone Debugger

The standalone debugger is an Electron desktop app that provides the same OIDC debugging UI as the browser extension, but connects via WebSocket instead of browser APIs. This makes it suitable for:

- **Node.js servers and backend services** — no browser extension available
- **React Native and mobile webviews** — can't install browser extensions
- **Electron apps** — debug your own Electron app's auth flows
- **Any environment** where installing a browser extension is impractical

## Quick Start

### 1. Start the debugger

```bash
# From the monorepo
pnpm --filter @wolfcola/devtools-standalone build
pnpm --filter @wolfcola/devtools-standalone start
```

The debugger opens an Electron window and starts a WebSocket server on `localhost:19417`.

### 2. Connect your app

Install the bridge in your application:

```bash
npm install @wolfcola/devtools-bridge
```

Then call `attachDebugger`:

```typescript
import { attachDebugger } from '@wolfcola/devtools-bridge';

const handle = await attachDebugger({
  name: 'my-app',
});

// Events are now forwarded to the standalone debugger.
// When done:
handle.detach();
```

That's it. The bridge connects via WebSocket, installs a fetch interceptor to capture auth-related network requests, and forwards everything to the debugger.

## Configuration

`attachDebugger` accepts these options:

| Option       | Type      | Default | Purpose                                                    |
| ------------ | --------- | ------- | ---------------------------------------------------------- |
| `name`       | `string`  | —       | App name shown in the session list (required)              |
| `port`       | `number`  | `19417` | WebSocket server port                                      |
| `autoLaunch` | `boolean` | `true`  | Launch the debugger binary if not already running          |
| `network`    | `boolean` | `true`  | Install fetch interceptor to capture auth-related requests |
| `pid`        | `number`  | —       | Process ID (optional metadata)                             |
| `framework`  | `string`  | —       | Framework name (optional metadata)                         |

### Auto-launch

When `autoLaunch` is enabled (the default), the bridge searches your PATH for `wolfcola-devtools`, launches it as a background process, and retries the WebSocket connection with exponential backoff. If the binary isn't found or launch fails, the bridge logs a warning and returns `{ connected: false }`.

### Custom port

```typescript
// Start the debugger on a custom port
// electron dist/src/main.cjs --port 9000

const handle = await attachDebugger({
  name: 'my-app',
  port: 9000,
});
```

## Node.js HTTP Interceptor

For server-side apps that use Node's `http`/`https` modules instead of `fetch`, install the Node HTTP interceptor separately:

```typescript
import {
  attachDebugger,
  installNodeHttpInterceptor,
  uninstallNodeHttpInterceptor,
} from '@wolfcola/devtools-bridge';

const handle = await attachDebugger({ name: 'my-server', network: false });

installNodeHttpInterceptor((entry) => {
  // Forward captured HTTP requests to the debugger
  client.sendNetworkEvent(entry);
});

// Cleanup
uninstallNodeHttpInterceptor();
handle.detach();
```

The interceptor patches `http.request` and `https.request` to capture request/response data for auth-related URLs.

## Sessions

Each connected app appears as a session in the debugger. Sessions track:

- **Name** — from the `name` option in `attachDebugger`
- **Status** — connected or disconnected
- **Framework** and **PID** — optional metadata
- **Events** — all `AuthEvent` objects received from the app

When an app disconnects and reconnects, the debugger can either preserve or clear the previous session's events (controlled by the "clear on reconnect" setting per session).

## MCP Mode

The standalone debugger can also run as a headless MCP server for AI agent integration:

```bash
electron dist/src/main.cjs --mcp
```

In this mode there is no UI — the debugger communicates via stdio using the Model Context Protocol. This is useful for automated debugging with Claude or other AI assistants. See the [package reference](/packages/devtools-standalone) for the full list of MCP tools.

## Views

The standalone debugger uses the same Elm UI as the browser extension. You get the same three views:

- **Timeline** — chronological list of all auth events
- **Flow** — state diagram of the current OIDC flow
- **Learn** — contextual documentation for OIDC concepts

See the [DevTools Extension](/docs/devtools-extension) guide for details on each view.

## Troubleshooting

**WebSocket connection fails:**

1. Verify the debugger is running: look for the Electron window or check if port 19417 is in use
2. Check that no firewall is blocking localhost connections
3. Try a custom port if 19417 is taken: `--port 9000`

**No events appearing:**

1. Confirm `handle.connected` is `true` after calling `attachDebugger`
2. Verify your app is making auth-related requests (the interceptor filters by URL pattern)
3. Check the browser/Node console for warnings from the bridge

**Auto-launch not working:**

1. Ensure `wolfcola-devtools` is on your PATH
2. Try launching the debugger manually first to rule out startup errors
