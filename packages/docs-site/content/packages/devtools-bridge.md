---
title: '@wolfcola/devtools-bridge'
description: 'SDK adapter for emitting events from OIDC clients'
section: packages
order: 3
---

# @wolfcola/devtools-bridge

The devtools bridge is a lightweight SDK adapter that connects your OIDC client to the wolfcola DevTools panel. It captures authentication events and flow state, then forwards them to the browser extension or VS Code extension for inspection.

## Installation

```bash
npm install @wolfcola/devtools-bridge
```

## Quick Start

```typescript
import { createBridge } from '@wolfcola/devtools-bridge';
import { davinci } from '@wolfcola/devtools-bridge/adapters/davinci';

const bridge = createBridge(davinci(myDaVinciClient));

// Events are now forwarded to the DevTools panel automatically.
// When done:
bridge.destroy();
```

## Adapters

Adapters translate SDK-specific events into the standard `AuthEvent` schema. Each adapter is a separate entry point so unused adapters are tree-shaken from your bundle.

### DaVinci Adapter

```typescript
import { davinci } from '@wolfcola/devtools-bridge/adapters/davinci';

const bridge = createBridge(davinci(daVinciClient));
```

Supports `@forgerock/davinci-client` v1.x and v2.x. Captures node transitions, collector callbacks, and flow completion.

### Journey Adapter

```typescript
import { journey } from '@wolfcola/devtools-bridge/adapters/journey';

const bridge = createBridge(journey(journeyConfig));
```

Supports ForgeRock Journey/Tree-based authentication. Captures callbacks, step transitions, and session token issuance.

### Generic OIDC Adapter

```typescript
import { oidc } from '@wolfcola/devtools-bridge/adapters/oidc';

const bridge = createBridge(
  oidc({
    onAuthorize: (cb) => myClient.on('authorize', cb),
    onToken: (cb) => myClient.on('token', cb),
    onError: (cb) => myClient.on('error', cb),
  }),
);
```

Use the generic adapter when your OIDC client does not have a dedicated adapter. You provide hook functions that the bridge calls to subscribe to events.

## Bridge API

### `createBridge(adapter, options?)`

Creates a new bridge instance.

**Options:**

| Option       | Type                            | Default      | Description                                             |
| ------------ | ------------------------------- | ------------ | ------------------------------------------------------- |
| `filter`     | `(event: AuthEvent) => boolean` | `() => true` | Filter which events are emitted                         |
| `metadata`   | `Record<string, string>`        | `{}`         | Custom metadata attached to every event                 |
| `redact`     | `boolean`                       | `true`       | Redact sensitive fields like passwords and tokens       |
| `bufferSize` | `number`                        | `1000`       | Maximum number of events to keep in the internal buffer |

### `bridge.emit(event)`

Manually emit an `AuthEvent`. Useful for custom events that the adapter does not capture automatically.

### `bridge.destroy()`

Disconnect from the OIDC client and stop emitting events. Always call this when the bridge is no longer needed to prevent memory leaks.

### `bridge.getFlowState()`

Returns the current `FlowState` object, which represents the latest known position in the authentication flow.

<callout type="info">The bridge uses `postMessage` to communicate with the browser extension. It has zero runtime dependencies beyond `@wolfcola/devtools-types`.</callout>

## Bundle Impact

The bridge is designed to be lightweight. When using a specific adapter, only that adapter's code is included in your bundle:

| Import                     | Minified + gzipped |
| -------------------------- | ------------------ |
| `createBridge` + `davinci` | ~1.2 kB            |
| `createBridge` + `journey` | ~1.0 kB            |
| `createBridge` + `oidc`    | ~0.8 kB            |
