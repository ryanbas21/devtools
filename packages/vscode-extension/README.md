# OIDC DevTools — VS Code Extension

VS Code extension for live OIDC/OAuth2 debugging. Connects to Chrome/Chromium via the Chrome DevTools Protocol (CDP) to capture and analyze authentication flows without leaving your editor.

## Features

- **Live network capture** — captures auth-related traffic via CDP (`Network` domain)
- **OIDC annotation pipeline** — same annotation engine as the browser extension (phase detection, DPoP, PAR, well-known discovery)
- **SDK event injection** — captures `devtools-bridge` events via CDP script injection — no browser extension needed
- **Timeline TreeView** — native VS Code tree with status icons, OIDC phase badges, and durations
- **Flow WebView** — the same Elm UI as the browser extension, adapted to VS Code's color theme
- **Diagnosis engine** — automated issue detection (CORS, missing PKCE, expired tokens, etc.)
- **Status bar** — connection state and live event count
- **Export** — JSON (with redaction) or Markdown (with diagnosis) opened as a new document

## Quick start

### Prerequisites

- Node.js 20+, pnpm 10+
- A Chromium-based browser (Chrome, Chromium, Edge, Brave, Arc)

### 1. Build the extension

From the **repository root**:

```bash
pnpm install
pnpm build
```

This builds all packages including the shared `devtools-core` and `devtools-ui` that the VS Code extension depends on.

### 2. Launch the extension

```bash
code --extensionDevelopmentPath=/path/to/wolfcola-devtools/packages/vscode-extension
```

This opens a VS Code window with the extension loaded. You should see the **OIDC DevTools** icon in the Activity Bar (left sidebar).

### 3. Launch your browser with remote debugging

**Important:** This must be a separate browser instance. If your normal browser is already running, the debug port flag gets silently ignored. Use `--user-data-dir` to force a new instance.

```bash
# Chromium (Arch Linux, etc.)
chromium --remote-debugging-port=9222 --no-first-run --user-data-dir=/tmp/oidc-devtools-test

# Google Chrome
google-chrome --remote-debugging-port=9222 --no-first-run --user-data-dir=/tmp/oidc-devtools-test

# Microsoft Edge
microsoft-edge --remote-debugging-port=9222 --no-first-run --user-data-dir=/tmp/oidc-devtools-test

# macOS Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --user-data-dir=/tmp/oidc-devtools-test
```

Verify CDP is working:

```bash
curl http://localhost:9222/json
```

You should see JSON listing page targets.

### 4. Connect and capture

1. In the VS Code extension window: `Ctrl+Shift+P` → **"OIDC DevTools: Start Capture"**
2. Enter `9222` when prompted for the port
3. The status bar should show **"Connected"**
4. Navigate your browser to a page with OIDC/OAuth traffic
5. Auth-related events appear in the Timeline TreeView
6. Click an event to open the Flow WebView with full details

### Quick test with the mock OIDC server

The repo includes a mock OIDC server for testing:

```bash
# Terminal 1: start the mock server
cd e2e && npx tsx mock-oidc-server/start.ts

# Terminal 2: launch browser
chromium --remote-debugging-port=9222 --no-first-run --user-data-dir=/tmp/oidc-devtools-test http://localhost:3000/test-app
```

Then connect from VS Code and click **"Start OIDC Flow"** in the browser. You'll see discovery, token, and userinfo events captured in the Timeline.

## Troubleshooting

### "Failed to connect"

- Verify the browser is running with `--remote-debugging-port=9222`
- Verify with `curl http://localhost:9222/json` — you should see JSON output
- If your normal browser is already running, the debug port is silently ignored. Use `--user-data-dir=/tmp/oidc-devtools-test` to force a separate instance.

### Commands not appearing in the palette

- Make sure you launched VS Code with `--extensionDevelopmentPath=...` pointing to the `packages/vscode-extension` directory
- The extension must be built first (`pnpm build` from the repo root)

### No events appearing

- The extension only captures auth-related requests (URLs matching `/authorize`, `/token`, `/userinfo`, `/.well-known/openid-configuration`, etc.)
- Non-auth traffic (static assets, API calls) is filtered out
- Check that the browser has an open tab with `http://` or `https://` URL (DevTools pages and `chrome://` URLs are filtered)

## Commands

| Command | Description |
|---------|-------------|
| OIDC DevTools: Start Capture | Connect to browser and begin capturing |
| OIDC DevTools: Stop Capture | Disconnect |
| OIDC DevTools: Clear Events | Clear the timeline |
| OIDC DevTools: Export Flow | Export as JSON or Markdown |

## How it works

```
VS Code Extension Host
  ├── CDP Client (WebSocket → Chrome)
  │     ├── Network.requestWillBeSent / responseReceived / loadingFinished
  │     └── Runtime.bindingCalled ← injected SDK capture script
  ├── handleMessage pipeline (from @wolfcola/devtools-core)
  │     ├── buildNetworkEvent → isAuthRelated filter
  │     ├── enrichWithOidcSemantics (annotateOidc + detectDpop + detectPar)
  │     ├── parseWellKnownResponse → OIDC config discovery
  │     └── EventStore (in-memory)
  ├── TreeView Provider (Timeline)
  ├── WebView Panel (Elm UI — Flow + Learn views)
  └── Status Bar (connection state + event count)
```

The extension runs the exact same `handleMessage` pipeline as the browser extension's service worker. Events flow through the same annotation engine, OIDC discovery, and diagnosis rules. The only difference is the transport: CDP WebSocket instead of `chrome.devtools.network`.

## Requirements

- Chromium-based browser (Chrome, Chromium, Edge, Brave, Arc)
- Browser must be launched with `--remote-debugging-port`
- Firefox and Safari are not supported (CDP is Chromium-only)

## Build

From the repo root:

```bash
pnpm install
pnpm build    # builds all packages including dependencies
```

Or just the VS Code extension (after dependencies are built):

```bash
cd packages/vscode-extension && pnpm build
```

## Development

```bash
# Watch mode (rebuilds on file changes)
cd packages/vscode-extension && pnpm watch

# Run tests
pnpm test
```

## License

MIT
