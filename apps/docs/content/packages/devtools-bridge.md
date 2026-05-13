---
title: '@wolfcola/devtools-bridge'
description: 'SDK adapter for emitting auth events to the Ping DevTools extension'
section: packages
order: 3
---

# @wolfcola/devtools-bridge

The devtools bridge connects your OIDC client to the Ping DevTools browser extension. It monitors SDK state changes and emits `AuthEvent` objects via `CustomEvent` on the window, where the extension picks them up.

## Installation

```bash
npm install @wolfcola/devtools-bridge
```

**Dependencies:** `@wolfcola/devtools-types`, `effect`

**Optional peer dependency:** `@forgerock/davinci-client` (only needed for the DaVinci bridge)

## Quick Start

```typescript
import { attachDaVinciBridge } from '@wolfcola/devtools-bridge';

const handle = attachDaVinciBridge(daVinciClient, sdkConfig);

// Events are now forwarded to the DevTools extension automatically.
// When done:
handle.detach();
```

## Bridge Functions

All bridge functions return a `BridgeHandle` with a single `detach()` method. When called outside a browser environment (SSR), they return a no-op handle. Events are only dispatched when `window.__PING_DEVTOOLS_EXTENSION__` is present (the extension sets this marker).

### `attachDaVinciBridge(client, config?, devtoolsOptions?)`

```typescript
function attachDaVinciBridge(
  client: Subscribable,
  config?: object,
  devtoolsOptions?: DevtoolsOptions,
): BridgeHandle;
```

Attaches to a DaVinci client. The client must implement the `Subscribable` interface with `subscribe(listener)` and `getNode()` methods. On each subscription callback the bridge:

1. Decodes the node using an internal `DaVinciNodeSchema` (via `Schema.decodeUnknownOption`)
2. Skips if the node status has not changed from the previous emission
3. Emits the SDK config once (on first node transition) as an `sdk:config` event via `emitConfigEvent`
4. Emits an `sdk:node-change` event with `SdkData` including `nodeStatus`, `previousStatus`, `interactionId`, `interactionToken`, `nodeId`, `nodeName`, `collectors`, `error`, `authorization`, etc.
5. Snapshots `document.cookie` and `localStorage` before and after, emitting `session:cookie` and `session:storage` diff events

The bridge only emits events when `window.__PING_DEVTOOLS_EXTENSION__` is present.

### `attachJourneyBridge(client, config?, devtoolsOptions?)`

```typescript
function attachJourneyBridge(
  client: JourneySubscribable,
  config?: object,
  devtoolsOptions?: DevtoolsOptions,
): BridgeHandle;
```

Attaches to a Journey client that implements `subscribe(listener)` and `getState()`. Monitors RTK Query state at `journeyReducer.mutations`. For each fulfilled or rejected mutation entry that has not been emitted yet:

- **Fulfilled:** Decodes the step payload and maps it to `JourneyData` with `stepType` of `'Step'`, `'LoginSuccess'`, or `'LoginFailure'` based on the presence of `authId`, `successUrl`, or neither
- **Rejected:** Emits a `LoginFailure` event with the extracted error message

Emits `sdk:journey-step` events. Automatically trims stale mutation IDs from the deduplication set.

### `attachOidcBridge(client, config?, devtoolsOptions?)`

```typescript
function attachOidcBridge(
  client: OidcSubscribable,
  config?: { clientId?: string } & object,
  devtoolsOptions?: DevtoolsOptions,
): BridgeHandle;
```

Attaches to an OIDC client that implements `subscribe(listener)` and `getState()`. Monitors RTK Query state at `oidc.mutations`. Maps mutation endpoint names to OIDC phases:

| Endpoint          | Phase       |
| ----------------- | ----------- |
| `authorizeFetch`  | `authorize` |
| `authorizeIframe` | `authorize` |
| `exchange`        | `exchange`  |
| `revoke`          | `revoke`    |
| `userInfo`        | `userinfo`  |
| `endSession`      | `logout`    |

Emits `sdk:oidc-state` events with `OidcData` containing `phase`, `status` (`'success'` or `'error'`), `clientId`, and error details when applicable.

## Client Interfaces

The bridge functions expect clients that implement specific structural interfaces. These are not exported — they are satisfied structurally by the Ping Identity SDKs.

### `Subscribable` (DaVinci)

```typescript
interface Subscribable {
  subscribe: (listener: () => void) => () => void;
  getNode: () => unknown;
  cache?: {
    getCache: (requestId: string) => unknown;
  };
}
```

### `JourneySubscribable`

```typescript
interface JourneySubscribable {
  subscribe: (listener: () => void) => () => void;
  getState: () => unknown;
}
```

The state must contain `journeyReducer.mutations` with RTK Query mutation entries.

### `OidcSubscribable`

```typescript
interface OidcSubscribable {
  subscribe: (listener: () => void) => () => void;
  getState: () => unknown;
}
```

The state must contain `oidc.mutations` with RTK Query mutation entries.

## Event Emission

### `emitAuthEvent(event, options?)`

Manually emits an `AuthEvent`. The event is:

1. Pushed to `window.__PING_DEVTOOLS_STATE__` (capped at 500 entries, oldest trimmed)
2. Optionally logged to the console if `options.consoleLog` is `true`
3. Dispatched as `window.dispatchEvent(new CustomEvent('pingDevtools', { detail: event }))`

No-ops when `window` is undefined (SSR-safe).

### `emitConfigEvent(config, options?)`

Emits an SDK configuration event with type `'sdk:config'` and `SdkConfigData` (`_tag: 'sdk-config'`). Internally calls `emitAuthEvent`.

## Constants and Types

### `DEVTOOLS_EVENT_NAME`

The `CustomEvent` name: `'pingDevtools'`.

### `DevtoolsOptions`

```typescript
interface DevtoolsOptions {
  consoleLog?: boolean;
}
```

When `consoleLog` is `true`, every emitted event is also logged via `console.log`.

### `BridgeHandle`

```typescript
interface BridgeHandle {
  detach: () => void;
}
```

Call `detach()` to unsubscribe the bridge from the SDK client.

## Event Storage

Events are stored on `window.__PING_DEVTOOLS_STATE__` as an array of `AuthEvent` objects. The array is capped at 500 entries; when the limit is exceeded, the oldest entries are removed via `splice`.

<callout type="warning">Always call `handle.detach()` when you are done. Failing to do so may cause memory leaks from lingering subscription listeners.</callout>
