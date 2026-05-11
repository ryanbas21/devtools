# OIDC DevTools — VS Code Extension

VS Code extension for live OIDC/OAuth2 debugging. Connects to Chrome via the Chrome DevTools Protocol (CDP) to capture and analyze authentication flows without leaving your editor.

## Features

- **Live network capture** — captures auth-related traffic via CDP (`Network` domain)
- **SDK event injection** — captures `devtools-bridge` events via `Page.addScriptToEvaluateOnNewDocument` + `Runtime.bindingCalled`
- **Timeline TreeView** — native VS Code tree with status icons, OIDC phase badges, and durations
- **Flow WebView** — the same Elm UI as the browser extension, with VS Code theme integration
- **Status bar** — connection state and live event count
- **Export** — JSON (with redaction) or Markdown (with diagnosis) opened as a new document
- **Debug configuration** — `oidc-devtools` type for `launch.json`

## Quick start

### Option 1: Command palette

1. Launch Chrome with remote debugging:
   ```bash
   google-chrome --remote-debugging-port=9222
   ```
2. In VS Code, run **"OIDC DevTools: Start Capture"** from the command palette
3. Enter the debug port (default: 9222)
4. Browse your app — auth-related events appear in the Timeline

### Option 2: Launch configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "oidc-devtools",
  "request": "launch",
  "name": "Debug OIDC Flow",
  "url": "http://localhost:3000",
  "port": 9222
}
```

## Commands

| Command | Description |
|---------|-------------|
| OIDC DevTools: Start Capture | Connect to Chrome and begin capturing |
| OIDC DevTools: Stop Capture | Disconnect from Chrome |
| OIDC DevTools: Clear Events | Clear the timeline |
| OIDC DevTools: Export Flow | Export as JSON or Markdown |

## How it works

```
VS Code Extension Host
  ├── CDP Client (WebSocket → Chrome)
  │     ├── Network.requestWillBeSent / responseReceived / loadingFinished
  │     └── Runtime.bindingCalled ← injected SDK capture script
  ├── TreeView Provider (Timeline)
  ├── WebView Panel (Elm UI — Flow + Learn views)
  └── Status Bar (connection state + event count)
```

The extension connects to Chrome's debug WebSocket, subscribes to the `Network` domain for HTTP traffic, and injects a small script to capture SDK events. Captured events flow through the same annotation pipeline and diagnosis engine as the browser extension (`@wolfcola/devtools-core`). The Elm UI (`@wolfcola/devtools-ui`) renders in a WebView with VS Code theme colors mapped to the panel's CSS variables.

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, Arc)
- Browser must be launched with `--remote-debugging-port`

Firefox and Safari are not supported (CDP is Chromium-only).

## Build

```bash
pnpm build
```

Outputs `dist/extension.js` (CJS, for VS Code extension host) and `dist/webview/` (Elm JS, CSS, adapter).

## Testing

```bash
pnpm test    # unit tests (vitest)
```

## License

MIT
