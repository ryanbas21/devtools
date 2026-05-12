---
title: 'Generic OIDC Integration'
description: 'Integrate wolfcola devtools with OIDC clients using the OIDC bridge adapter'
section: guides
order: 7
---

# Generic OIDC Integration

The OIDC bridge adapter instruments OIDC clients that expose their state via an RTK Query-style subscribable store. It maps mutation endpoint results to OIDC protocol phases.

## Setup

### Install the Bridge

```bash
npm install @wolfcola/devtools-bridge
```

### Attach the OIDC Bridge

```typescript
import { attachOidcBridge } from '@wolfcola/devtools-bridge';

const handle = attachOidcBridge(oidcClient);

// Optionally pass config with clientId and devtools options
const handle = attachOidcBridge(oidcClient, { clientId: 'my-app' }, { consoleLog: true });
```

The bridge subscribes to the client via `client.subscribe()` and reads state via `client.getState()`.

### Cleanup

```typescript
handle.detach();
```

<callout type="warning">Always call `handle.detach()` when you are done. Failing to do so may cause memory leaks from lingering event listeners.</callout>

## What Gets Captured

With the OIDC bridge attached, the following events are emitted:

- **`sdk:config`** -- Emitted once on the first mutation (when `config` is provided). Contains the SDK configuration object.
- **`sdk:oidc-state`** -- Emitted for each fulfilled or rejected mutation that maps to a known OIDC endpoint. Contains `OidcData` with the protocol phase, status, and error details.

## How It Works

The bridge monitors RTK Query state at `oidc.mutations`. It expects an `OidcSubscribable` interface:

```typescript
interface OidcSubscribable {
  subscribe: (listener: () => void) => () => void;
  getState: () => unknown;
}
```

### Endpoint-to-Phase Mapping

The bridge maps RTK Query mutation endpoint names to OIDC protocol phases:

| Endpoint          | Phase       |
| ----------------- | ----------- |
| `authorizeFetch`  | `authorize` |
| `authorizeIframe` | `authorize` |
| `exchange`        | `exchange`  |
| `revoke`          | `revoke`    |
| `userInfo`        | `userinfo`  |
| `endSession`      | `logout`    |

Mutations with endpoint names not in this map are silently ignored.

### Processing

On each subscription callback:

1. The bridge decodes the state with `Schema.decodeUnknownOption` looking for `oidc.mutations`
2. For each mutation entry not yet emitted, it checks if `status` is `'fulfilled'` or `'rejected'`
3. The `endpointName` is mapped to an OIDC phase
4. **Fulfilled mutations:** An `OidcData` event is emitted with `status: 'success'`
5. **Rejected mutations:** An `OidcData` event is emitted with `status: 'error'`, including `errorCode` and `errorMessage` extracted from the error payload
6. Stale mutation IDs no longer in the cache are automatically pruned from the deduplication set

### OidcData Fields

- `phase`: `'authorize'` | `'exchange'` | `'revoke'` | `'userinfo'` | `'logout'`
- `status`: `'success'` | `'error'`
- `clientId`: From the config object (if provided)
- `errorCode`: Extracted from `error.data.error` or HTTP status
- `errorMessage`: Extracted from `error.data.error_description`, `error.data.message`, or `error.message`

## Troubleshooting

- **No events appearing** -- Verify that `window.__PING_DEVTOOLS_EXTENSION__` exists. The bridge only emits events when the Ping DevTools extension is detected.
- **Missing OIDC events** -- Only mutations with recognized endpoint names are emitted. Custom endpoints not in the mapping table are ignored.
- **Pending mutations ignored** -- Only `fulfilled` and `rejected` mutations are emitted. Pending mutations are skipped.
