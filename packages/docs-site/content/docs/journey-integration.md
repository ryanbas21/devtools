---
title: 'Journey Integration'
description: 'Integrate wolfcola devtools with Ping Identity Journey/Tree-based authentication'
section: guides
order: 6
---

# Journey Integration

Ping Identity Journey (formerly Tree-based authentication) uses a series of callbacks to guide users through authentication. The wolfcola devtools bridge provides a dedicated adapter for instrumenting Journey flows.

## Setup

### Install the Bridge

```bash
npm install @wolfcola/devtools-bridge
```

### Create a Journey Bridge

```typescript
import { createBridge } from '@wolfcola/devtools-bridge';
import { journey } from '@wolfcola/devtools-bridge/adapters/journey';

const bridge = createBridge(journey(journeyConfig));
```

The `journey` adapter hooks into the Journey SDK's callback mechanism and translates each step into the standard `AuthEvent` schema.

## What Gets Captured

With the Journey adapter active, the bridge emits events for:

- **Flow start** -- when the Journey tree begins
- **Callback transitions** -- each time the flow presents a new set of callbacks
- **User submissions** -- data submitted at each callback step (passwords are redacted)
- **Step transitions** -- progression through the authentication tree
- **Session token issuance** -- successful authentication with token delivery
- **Errors** -- authentication failures and timeout errors

## Flow State Tracking

The bridge maintains a `FlowState` object representing the current position in the Journey tree:

```typescript
bridge.getFlowState();
// => { step: "username-password", tokens: null, error: null }
```

The DevTools extension visualizes this in the Flow view, showing each callback step as a node in the tree.

## Advanced Configuration

### Filtering Events

```typescript
const bridge = createBridge(journey(journeyConfig), {
  filter: (event) => event.type !== 'callback_transition',
});
```

### Custom Metadata

```typescript
const bridge = createBridge(journey(journeyConfig), {
  metadata: {
    environment: 'staging',
    tree: 'login-v2',
  },
});
```

### Cleanup

```typescript
bridge.destroy();
```

<callout type="warning">Always call `bridge.destroy()` when you are done. Failing to do so may cause memory leaks from lingering event listeners.</callout>

## Troubleshooting

- **No events appearing** -- Verify that the Journey SDK is correctly configured and the adapter receives the config object.
- **Missing step transitions** -- Some custom callback handlers may not emit standard events. Ensure callbacks follow the Ping Identity SDK conventions.
- **Redacted fields showing as empty** -- The bridge redacts sensitive fields by default. Pass `redact: false` in bridge options during development only.
