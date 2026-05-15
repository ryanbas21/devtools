# @wolfcola/devtools-bridge

Opt-in SDK adapter that connects your Ping Identity / ForgeRock application to WolfCola DevTools — the [browser extension](../devtools-extension), the [VS Code extension](../vscode-extension), or the [standalone debugger](../devtools-standalone). Add it to your app in one line — it is a no-op when no debugger is available, so it is safe to ship in production builds.

## Contents

- [Installation](#installation)
- [Bridges](#bridges)
  - [DaVinci — `attachDevToolsBridge`](#davinci--attachdevtoolsbridge)
  - [AM Journey — `attachJourneyBridge`](#am-journey--attachjourneybridge)
  - [OIDC / OAuth — `attachOidcBridge`](#oidc--oauth--attachoidcbridge)
- [Standalone debugger — `attachDebugger`](#standalone-debugger--attachdebugger)
- [Low-level API](#low-level-api)
- [How it works](#how-it-works)
- [Safety](#safety)

---

## Installation

```bash
pnpm add @wolfcola/devtools-bridge
```

`effect` is a peer dependency. `@forgerock/davinci-client` is an optional peer dependency required only if you use `attachDevToolsBridge`.

---

## Bridges

### DaVinci — `attachDevToolsBridge`

Subscribes to a DaVinci client store and emits `sdk:node-change` on every node status transition, plus `session:cookie` / `session:storage` diffs after each transition.

```ts
import { davinci } from '@forgerock/davinci-client';
import { attachDevToolsBridge } from '@wolfcola/devtools-bridge';

const client = await davinci({ config });

// Pass config as the second argument — emitted once as sdk:config on the first transition
const bridge = attachDevToolsBridge(client, config);

// Unsubscribe when the component unmounts
bridge.detach();
```

**What it captures per node transition:**

| Field            | Source                                        |
| ---------------- | --------------------------------------------- |
| `nodeStatus`     | DaVinci node `.status`                        |
| `previousStatus` | Previous status (tracked locally)             |
| `interactionId`  | `server.interactionId`                        |
| `nodeName`       | `client.name`                                 |
| `collectors`     | `client.collectors` (full objects)            |
| `error`          | `error.code / message / type`                 |
| `session`        | `server.session` (DaVinci session token)      |
| `responseBody`   | Full DaVinci server response (from RTK cache) |

The bridge only emits when `nodeStatus` actually changes, so rapid store updates that don't advance the node do not generate noise.

---

### AM Journey — `attachJourneyBridge`

Subscribes to a Journey RTK store and emits `sdk:journey-step` for each mutation that settles (`fulfilled` or `rejected`). Each event carries the full AM step response including all callbacks with their `input`/`output` arrays.

```ts
import { journey } from '@forgerock/journey-client'; // your RTK-based journey client
import { attachJourneyBridge } from '@wolfcola/devtools-bridge';

const client = await journey({ config });

attachJourneyBridge(client, config);
```

**`JourneySubscribable` interface** — any object with this shape works:

```ts
interface JourneySubscribable {
  subscribe: (listener: () => void) => () => void;
  getState: () => unknown; // must expose { journeyReducer: { mutations: Record<string, MutationEntry> } }
}
```

**Emitted events by step type:**

| `stepType`     | When                              | Notable fields                             |
| -------------- | --------------------------------- | ------------------------------------------ |
| `Step`         | AM returns `authId`               | `callbacks`, `authId`, `stage`, `header`   |
| `LoginSuccess` | AM returns `tokenId`              | `tokenId`, `successUrl`                    |
| `LoginFailure` | AM returns an error / RTK rejects | `errorCode`, `errorMessage`, `errorReason` |

---

### OIDC / OAuth — `attachOidcBridge`

Subscribes to an OIDC client RTK store and emits `sdk:oidc-state` for each settled mutation. Maps RTK endpoint names to human-readable phases.

```ts
import { oidcClient } from '@forgerock/oidc-client'; // your RTK-based OIDC client
import { attachOidcBridge } from '@wolfcola/devtools-bridge';

const client = oidcClient({ config });

attachOidcBridge(client, config);
```

**`OidcSubscribable` interface:**

```ts
interface OidcSubscribable {
  subscribe: (listener: () => void) => () => void;
  getState: () => unknown; // must expose { oidc: { mutations: Record<string, MutationEntry> } }
}
```

**Endpoint → phase mapping:**

| RTK endpoint name | Emitted phase |
| ----------------- | ------------- |
| `authorizeFetch`  | `authorize`   |
| `authorizeIframe` | `authorize`   |
| `exchange`        | `exchange`    |
| `revoke`          | `revoke`      |
| `userInfo`        | `userinfo`    |
| `endSession`      | `logout`      |

Pass `config.clientId` to surface it in the extension's node detail card:

```ts
attachOidcBridge(client, { clientId: 'my-spa-client', ...rest });
```

---

## Standalone debugger — `attachDebugger`

Connects your app to the [standalone Electron debugger](../devtools-standalone) via WebSocket instead of the browser extension. Works in both browser and Node.js environments.

```ts
import { attachDebugger } from '@wolfcola/devtools-bridge';

const handle = await attachDebugger({
  name: 'my-spa',
  port: 19417, // default
  autoLaunch: true, // launch debugger if not running (default true)
  network: true, // install fetch interceptor (default true)
  framework: 'react', // optional metadata
});

// Later:
handle.detach(); // cleanup interceptors and close WebSocket
```

**Options:**

| Option       | Type      | Default | Purpose                                                    |
| ------------ | --------- | ------- | ---------------------------------------------------------- |
| `name`       | `string`  | —       | App name shown in session list (required)                  |
| `port`       | `number`  | `19417` | WebSocket server port                                      |
| `autoLaunch` | `boolean` | `true`  | Launch debugger binary if not already running              |
| `network`    | `boolean` | `true`  | Install fetch interceptor to capture auth-related requests |
| `pid`        | `number`  | —       | Process ID (optional metadata)                             |
| `framework`  | `string`  | —       | Framework name (optional metadata)                         |

**What happens on `attachDebugger()`:**

1. Opens a WebSocket to `ws://localhost:{port}` and sends a handshake
2. If not connected and `autoLaunch` is enabled, finds `wolfcola-devtools` in PATH, spawns it, and retries with exponential backoff (~2.5s max)
3. If connected and `network` is enabled, installs a fetch interceptor that forwards auth-related requests to the debugger
4. Returns `{ connected, detach() }`

**Node.js HTTP interceptor** — for server-side apps that use `http`/`https` instead of `fetch`:

```ts
import {
  installNodeHttpInterceptor,
  uninstallNodeHttpInterceptor,
} from '@wolfcola/devtools-bridge';

installNodeHttpInterceptor((entry) => {
  client.sendNetworkEvent(entry);
});

// Later:
uninstallNodeHttpInterceptor();
```

---

## Low-level API

If you need to emit events from outside a supported client, use the primitives directly.

```ts
import { emitAuthEvent, emitConfigEvent, DEVTOOLS_EVENT_NAME } from '@wolfcola/devtools-bridge';

emitAuthEvent({
  id: crypto.randomUUID(),
  timestamp: performance.now(),
  type: 'sdk:node-change',
  source: 'sdk',
  flowId: null,
  causedBy: null,
  data: { _tag: 'sdk', nodeStatus: 'next' },
  flags: { isCors: false, isError: false, isAuthRelated: true },
});

emitConfigEvent({ clientId: 'my-app', environment: 'dev' });
```

Both functions dispatch a `CustomEvent` named `DEVTOOLS_EVENT_NAME` (`'pingDevtools'`) on `window`. The content script picks this up and forwards it to the extension service worker.

---

## How it works

```
Your app
  ├── attachDevToolsBridge(davinciClient)   ─┐
  ├── attachJourneyBridge(journeyClient)    ─┤─ emitAuthEvent()
  └── attachOidcBridge(oidcClient)          ─┘
            │
            │  window.dispatchEvent(new CustomEvent('pingDevtools', { detail: event }))
            ▼
      content-script.js
            │
            │  chrome.runtime.sendMessage({ type: 'SDK_EVENT', payload: event })
            ▼
      service-worker.ts  ──(validates via AuthEventSchema)──▶  EventStore
            │
            │  chrome.runtime.sendMessage({ type: 'EVENTS_UPDATED' })
            ▼
      panel (Elm)  ──  Timeline view + Flow view

── OR (VS Code extension) ──

Your app
  └── emitAuthEvent()
            │
            │  window.postMessage({ type: '__pingDevtools', ... })
            ▼
      CDP-injected script  (Page.addScriptToEvaluateOnNewDocument)
            │
            │  Runtime.bindingCalled('__wolfcolaBridge', payload)
            ▼
      VS Code extension host  ──▶  TreeView + WebView (Elm)

── OR (Standalone debugger) ──

Your app
  └── attachDebugger({ name: 'my-app' })
            │
            │  WebSocket to ws://localhost:19417
            │  HANDSHAKE → SDK_EVENT / NETWORK_EVENT
            ▼
      Electron main process  ──▶  SessionManager ──▶  EventStore
            │
            │  IPC (wolfcola:event, wolfcola:diagnosis)
            ▼
      Electron renderer  ──▶  Elm UI (same panel as extension)
```

The VS Code extension captures SDK events via a CDP-injected script that listens for the same `__pingDevtools` postMessage — no browser extension needed.

The standalone debugger receives events over WebSocket. `attachDebugger()` handles connection, auto-launch, and network interception automatically.

Each bridge function:

1. Subscribes to the client store
2. Validates the current state with an Effect Schema decoder (returns `Option.none` on mismatch — never throws)
3. Deduplicates by tracking already-emitted request IDs in a `Set`
4. Trims that `Set` to only IDs still present in the store, bounding memory use
5. Dispatches the event only when `window.__PING_DEVTOOLS_EXTENSION__` is present

---

## Safety

- **No-op without the extension** — all bridges check for `window.__PING_DEVTOOLS_EXTENSION__` before dispatching. If the marker is absent, nothing is emitted.
- **No-op in SSR / Node** — all bridges return `{ detach: () => undefined }` immediately when `typeof window === 'undefined'`.
- **Tree-shakeable** — `sideEffects: false` in `package.json`; unused bridges are eliminated by your bundler.
- **No sensitive data leakage** — the bridge never reads passwords or form values; it only observes the client's Redux/RTK state.
