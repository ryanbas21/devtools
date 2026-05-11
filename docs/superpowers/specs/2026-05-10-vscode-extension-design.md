# OIDC DevTools — VS Code Extension Design

## Goal

Bring the WolfCola OIDC/OAuth debugging extension to VS Code with full feature parity. Developers get live network capture, SDK event correlation, the diagnosis engine, and the same Flow/Learn UI — all without leaving their editor.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ VS Code Extension Host                              │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ CDP Client  │→ │ Event Store  │→ │ Diagnosis  │ │
│  │ (network +  │  │ (in-memory)  │  │ Engine     │ │
│  │  SDK inject)│  │              │  │ (reused)   │ │
│  └─────────────┘  └──────┬───────┘  └────────────┘ │
│                          │                          │
│              ┌───────────┼───────────┐              │
│              ▼                       ▼              │
│  ┌──────────────────┐  ┌──────────────────────┐    │
│  │ TreeView Provider│  │ WebView Panel        │    │
│  │ (Timeline)       │  │ (Elm: Flow + Learn)  │    │
│  └──────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────┘
          │
          │ CDP (WebSocket)
          ▼
┌─────────────────────────────────────────────────────┐
│ Chrome (--remote-debugging-port=9222)               │
│                                                     │
│  Network domain → HAR-like events                   │
│  Runtime.bindingCalled → SDK events (injected)      │
└─────────────────────────────────────────────────────┘
```

### Key decisions

- **CDP direct connection** — no browser extension required for VS Code usage. The VS Code extension connects to Chrome via Chrome DevTools Protocol.
- **SDK events via CDP injection** — `Page.addScriptToEvaluateOnNewDocument` injects a listener for `__pingDevtools` postMessage events. `Runtime.addBinding` pipes them back to VS Code. Zero changes to `devtools-bridge`.
- **Chromium only** — CDP limits us to Chrome, Edge, Brave, Arc. Firefox and Safari are out of scope.

## Package Structure

### New packages

**`packages/devtools-ui`** — Extracted Elm UI (shared between browser and VS Code):
- All Elm source (`Main.elm`, `View/`, `Update/`, `Types/`)
- `ports.ts` — port interface contract
- `build.mjs` — Elm compilation + terser minification
- Outputs a compiled JS bundle consumed by both targets

**`packages/devtools-core`** — Extracted shared logic:
- Annotators (OIDC, CORS, DPoP, PAR)
- Diagnosis engine
- Event store service
- Message type definitions

**`packages/vscode-extension`** — The VS Code extension:
- `extension.ts` — activation, commands, launch config
- `cdp-client.ts` — CDP connection, network capture
- `sdk-injector.ts` — script injection for SDK events
- `timeline-tree.ts` — TreeView provider
- `flow-webview.ts` — WebView panel (loads shared Elm)
- `launch.ts` — Chrome launch + attach logic

### Modified packages

**`packages/devtools-extension`** — becomes thinner:
- Imports annotators/diagnosis/event-store from `devtools-core`
- Imports compiled Elm from `devtools-ui`
- Retains only browser-extension-specific code (manifest, service worker, content scripts, Chrome messaging)

### Unchanged packages

- `packages/devtools-bridge` — no changes needed
- `packages/devtools-types` — unchanged (possibly extended with new event types)

## CDP Client

### Network capture

Subscribe to Chrome DevTools Protocol Network domain:

- `Network.enable()` — start intercepting
- `Network.requestWillBeSent` — request URL, method, headers, body
- `Network.responseReceived` — status code, response headers
- `Network.loadingFinished` → `Network.getResponseBody` — response body

Assemble CDP events into the same `AuthEvent` shape the existing annotators expect. Annotators run identically — they are transport-agnostic.

### SDK event injection

On connection, register a binding and inject a capture script:

```
Runtime.addBinding({ name: '__wolfcolaBridge' })

Page.addScriptToEvaluateOnNewDocument({
  source: `
    window.addEventListener('message', (e) => {
      if (e.data?.type === '__pingDevtools') {
        __wolfcolaBridge(JSON.stringify(e.data));
      }
    });
  `
})
```

When `devtools-bridge` emits `__pingDevtools`, the injected script catches it and calls the binding. CDP fires `Runtime.bindingCalled` back to the extension host. This reuses the existing `devtools-bridge` contract with zero changes.

### Connection lifecycle

1. Extension launches Chrome (or attaches to existing) via `--remote-debugging-port`
2. Discovers targets via `http://localhost:<port>/json`
3. Connects WebSocket to target page
4. Enables Network domain + injects SDK script
5. `addScriptToEvaluateOnNewDocument` persists across navigations
6. On disconnect, status bar shows disconnected state

## VS Code UI

### TreeView (Timeline)

Registered as a view container in the Activity Bar by default. User can drag to Panel or any other location.

```
OIDC DEVTOOLS: TIMELINE
├── ● 200 GET /authorize          [OIDC] [NET]     120ms
├── ● 302 GET /authorize          [OIDC] [NET]     45ms
├── ○ authorize_start             [SDK]
├── ● 200 POST /token             [OIDC] [NET]     230ms
├── ✕ CORS Error GET /userinfo    [CORS] [NET]
└── ○ token_received              [SDK]
```

- Status icons: green (success), red (error), blue (SDK event)
- Badges: event type, OIDC phase, CORS flag
- Built-in filter + custom filter command for event types
- Click to select → updates Flow WebView

### WebView (Flow + Learn)

- Opens as editor tab when clicking a flow in the TreeView
- Loads compiled Elm from `devtools-ui`
- `postMessage` ↔ Elm ports (same port contract as browser extension)
- Adapts to VS Code color theme via CSS variables (`--vscode-editor-background`, etc.)
- Elm app is transport-agnostic — doesn't know if it's in Chrome DevTools or VS Code

### Status Bar

```
$(plug) OIDC DevTools: Connected to localhost:9222  |  12 events
```

- States: disconnected / connecting / connected
- Click opens command palette with OIDC DevTools actions
- Live event count

### Commands

- `OIDC DevTools: Start Capture` — launch Chrome or attach to existing
- `OIDC DevTools: Stop Capture` — disconnect CDP
- `OIDC DevTools: Clear Events` — reset timeline
- `OIDC DevTools: Export Flow` — JSON/Markdown export (reuses existing export logic)

### Launch Configuration

```json
{
  "type": "oidc-devtools",
  "request": "launch",
  "name": "Debug OIDC Flow",
  "url": "http://localhost:3000",
  "port": 9222
}
```

Supports both `launch` (start Chrome) and `attach` (connect to existing).

## Implementation Phases

Each phase must pass all existing browser extension tests before proceeding.

### Phase 1: Extract shared logic into `devtools-core`

Move annotators, diagnosis engine, event store, message handler out of `devtools-extension` into `devtools-core`. Update imports. Verify browser extension builds and tests pass.

### Phase 2: Extract Elm UI into `devtools-ui`

Move Elm source and build script into `devtools-ui`. Output compiled JS bundle. `devtools-extension` consumes the bundle. Verify browser extension builds, loads, renders, and e2e tests pass.

### Phase 3: Build `vscode-extension` scaffold

VS Code extension manifest, activation, commands, status bar. CDP client with network capture. SDK event injection. TreeView provider consuming events through `devtools-core` annotators.

### Phase 4: Wire WebView to shared Elm UI

WebView loads `devtools-ui` bundle. Port adapter translates between VS Code `postMessage` and Elm ports. Flow + Learn views render in VS Code.

### Phase 5: Launch configuration and polish

`launch.json` support with `oidc-devtools` type. Chrome auto-launch. VS Code theme integration via CSS variables. Export commands.

## Constraints

- **Chromium only** — Firefox/Safari not supported via CDP
- **Browser extension must keep working** — e2e tests are the gate for every phase
- **Elm UI is the single source of truth** — both targets consume `devtools-ui`, no forking
- **Zero changes to `devtools-bridge`** — SDK injection reuses existing `__pingDevtools` contract
