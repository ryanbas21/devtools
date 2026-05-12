---
title: 'DaVinci Integration'
description: 'Integrate wolfcola devtools with ForgeRock DaVinci flows'
section: guides
order: 5
---

# DaVinci Integration

ForgeRock DaVinci is an orchestration platform for identity flows. The wolfcola devtools suite provides first-class support for instrumenting DaVinci flows through the `@wolfcola/devtools-bridge` package.

## Overview

DaVinci flows consist of a series of nodes that the user progresses through. Each node may involve user interaction (login forms, MFA challenges), server-side decisions (risk evaluation, policy checks), or external service calls (social login providers, identity verification).

The devtools bridge captures every node transition as an `AuthEvent` and the overall flow progress as a `FlowState`, giving you full visibility into what is happening during authentication.

## Setup

### Install the Bridge

```bash
npm install @wolfcola/devtools-bridge
```

### Create a DaVinci Bridge

```typescript
import { createBridge } from '@wolfcola/devtools-bridge';
import { davinci } from '@wolfcola/devtools-bridge/adapters/davinci';

// Pass your DaVinci client instance to the adapter
const bridge = createBridge(davinci(daVinciClient));
```

The `davinci` adapter hooks into the DaVinci SDK's event system and translates its internal events into the standard `AuthEvent` schema that the devtools panel understands.

## What Gets Captured

With the DaVinci adapter active, the bridge emits events for:

- **Flow start** — when `daVinciClient.start()` is called
- **Node transitions** — each time the flow advances to a new node
- **User submissions** — form data submitted at each node (passwords are redacted)
- **Collector callbacks** — interactions with individual collectors within a node
- **Errors** — authentication failures, network errors, timeout errors
- **Flow completion** — successful authentication with token issuance

## Flow State Tracking

The bridge also maintains a `FlowState` object that represents the current position in the DaVinci flow:

```typescript
// FlowState is updated automatically
// Access it from the DevTools panel or programmatically:
bridge.getFlowState();
// => { step: "username-password", tokens: null, error: null }
```

The DevTools extension visualizes this as a node graph in the Flow view, where each step is a node and transitions are edges.

## Advanced Configuration

### Filtering Events

You can filter which events are emitted to the devtools panel:

```typescript
const bridge = createBridge(davinci(daVinciClient), {
  filter: (event) => event.type !== 'collector_callback',
});
```

### Custom Metadata

Attach custom metadata to every event for debugging:

```typescript
const bridge = createBridge(davinci(daVinciClient), {
  metadata: {
    environment: 'staging',
    flowId: 'login-v2',
  },
});
```

### Cleanup

When the component unmounts or the flow completes, destroy the bridge to stop event capture and release resources:

```typescript
bridge.destroy();
```

<callout type="warning">Always call `bridge.destroy()` when you are done. Failing to do so may cause memory leaks from lingering event listeners.</callout>

## Troubleshooting

- **No events appearing** — Verify that the DaVinci SDK version is compatible. The adapter supports `@forgerock/davinci-client` v1.x and v2.x.
- **Missing node transitions** — Some custom DaVinci nodes may not emit standard events. Contact the node author to ensure compatibility.
- **Redacted fields showing as empty** — The bridge redacts sensitive fields by default. To see raw values during development, pass `redact: false` in the bridge options (never do this in production).
