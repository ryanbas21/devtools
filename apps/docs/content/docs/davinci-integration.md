---
title: 'DaVinci Integration'
description: 'Integrate wolfcola devtools with Ping Identity DaVinci flows'
section: guides
order: 5
---

# DaVinci Integration

Ping Identity DaVinci is an orchestration platform for identity flows. The wolfcola devtools suite provides first-class support for instrumenting DaVinci flows through the `@wolfcola/devtools-bridge` package.

## Overview

DaVinci flows consist of a series of nodes that the user progresses through. Each node may involve user interaction (login forms, MFA challenges), server-side decisions (risk evaluation, policy checks), or external service calls (social login providers, identity verification).

The devtools bridge monitors a DaVinci client's `Subscribable` interface and emits an `AuthEvent` on every node status transition, giving you full visibility into what is happening during authentication.

## Setup

### Install the Bridge

```bash
npm install @wolfcola/devtools-bridge
```

### Attach the DaVinci Bridge

```typescript
import { attachDaVinciBridge } from '@wolfcola/devtools-bridge';

// Pass your DaVinci client instance
const handle = attachDaVinciBridge(daVinciClient);

// Optionally pass SDK config and devtools options
const handle = attachDaVinciBridge(
  daVinciClient,
  {
    clientId: 'my-app',
    redirectUri: 'https://example.com/callback',
  },
  { consoleLog: true },
);
```

The bridge subscribes to the client via `client.subscribe()` and reads node state via `client.getNode()`. It decodes each node using an internal schema and only emits events when the node status actually changes.

### Cleanup

```typescript
handle.detach();
```

<callout type="warning">Always call `handle.detach()` when you are done. Failing to do so may cause memory leaks from lingering event listeners.</callout>

## What Gets Captured

With the DaVinci bridge attached, the following events are emitted:

- **`sdk:config`** -- Emitted once on the first node transition (when `config` is provided). Contains the SDK configuration object.
- **`sdk:node-change`** -- Emitted on every node status transition. Contains `SdkData` with `nodeStatus`, `previousStatus`, `interactionId`, `interactionToken`, `nodeId`, `nodeName`, `nodeDescription`, `eventName`, `httpStatus`, `collectors`, `error`, `authorization`, `session`, and `responseBody`.
- **`session:cookie`** -- Emitted when `document.cookie` changes between node transitions.
- **`session:storage`** -- Emitted when `localStorage` values change between node transitions.

## How It Works

The bridge uses the `Subscribable` interface expected by the DaVinci SDK:

```typescript
interface Subscribable {
  subscribe: (listener: () => void) => () => void;
  getNode: () => unknown;
  cache?: {
    getCache: (requestId: string) => unknown;
  };
}
```

On each subscription callback:

1. The bridge calls `client.getNode()` and decodes the result with `Schema.decodeUnknownOption`
2. If the node status matches the previous status, the event is skipped (deduplication)
3. If `window.__PING_DEVTOOLS_EXTENSION__` is not present, the event is dropped (no extension installed)
4. The node data is mapped to `SdkData` via the pure `nodeToSdkData` function
5. Session snapshots (cookies + localStorage) are taken before and after, with diffs emitted as separate events

## Troubleshooting

- **No events appearing** -- Verify that `window.__PING_DEVTOOLS_EXTENSION__` exists. The bridge only emits events when the Ping DevTools extension is detected.
- **Missing node transitions** -- The bridge deduplicates by `nodeStatus`. If two consecutive nodes have the same status string, only the first is emitted.
- **Optional peer dependency** -- The bridge has `@forgerock/davinci-client` as an optional peer dependency. You do not need to install it separately if you are already using the DaVinci SDK.
