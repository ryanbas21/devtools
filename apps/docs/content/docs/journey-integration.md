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

### Attach the Journey Bridge

```typescript
import { attachJourneyBridge } from '@wolfcola/devtools-bridge';

const handle = attachJourneyBridge(journeyClient);

// Optionally pass SDK config and devtools options
const handle = attachJourneyBridge(journeyClient, sdkConfig, { consoleLog: true });
```

The bridge subscribes to the client via `client.subscribe()` and reads state via `client.getState()`.

### Cleanup

```typescript
handle.detach();
```

<callout type="warning">Always call `handle.detach()` when you are done. Failing to do so may cause memory leaks from lingering event listeners.</callout>

## What Gets Captured

With the Journey bridge attached, the following events are emitted:

- **`sdk:config`** -- Emitted once on the first mutation (when `config` is provided). Contains the SDK configuration object.
- **`sdk:journey-step`** -- Emitted for each fulfilled or rejected mutation. Contains `JourneyData` with the step type and associated fields.

## How It Works

The bridge monitors RTK Query state at `journeyReducer.mutations`. It expects a `JourneySubscribable` interface:

```typescript
interface JourneySubscribable {
  subscribe: (listener: () => void) => () => void;
  getState: () => unknown;
}
```

On each subscription callback:

1. The bridge decodes the state with `Schema.decodeUnknownOption` looking for `journeyReducer.mutations`
2. For each mutation entry not yet emitted, it checks if `status` is `'fulfilled'` or `'rejected'`
3. **Fulfilled mutations:** The step payload is decoded and mapped to `JourneyData`. The `stepType` is determined by: `authId` present = `'Step'`, `successUrl` present = `'LoginSuccess'`, otherwise `'LoginFailure'`
4. **Rejected mutations:** A `LoginFailure` event is emitted with the extracted error message
5. Stale mutation IDs no longer in the cache are automatically pruned from the deduplication set

### JourneyData Fields

- `stepType`: `'Step'` | `'LoginSuccess'` | `'LoginFailure'`
- `callbacks`: Array of callback objects from the step
- `authId`, `tokenId`, `successUrl`: Step identifiers
- `realm`, `stage`, `header`, `description`: Step metadata
- `errorCode`, `errorMessage`, `errorReason`: Error details (for `LoginFailure`)

## Troubleshooting

- **No events appearing** -- Verify that `window.__PING_DEVTOOLS_EXTENSION__` exists. The bridge only emits events when the Ping DevTools extension is detected.
- **Missing step transitions** -- The bridge deduplicates by mutation request ID. Each mutation is only emitted once.
- **Pending mutations ignored** -- Only `fulfilled` and `rejected` mutations are emitted. Pending mutations are skipped.
