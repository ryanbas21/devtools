---
title: 'Generic OIDC Integration'
description: 'Integrate wolfcola devtools with any OIDC client using the generic adapter'
section: guides
order: 7
---

# Generic OIDC Integration

If your OIDC client does not have a dedicated adapter (like DaVinci or Journey), you can use the generic OIDC adapter. It works with any client library by letting you provide hook functions that the bridge calls to subscribe to events.

## Setup

### Install the Bridge

```bash
npm install @wolfcola/devtools-bridge
```

### Create a Generic OIDC Bridge

```typescript
import { createBridge } from '@wolfcola/devtools-bridge';
import { oidc } from '@wolfcola/devtools-bridge/adapters/oidc';

const bridge = createBridge(
  oidc({
    onAuthorize: (cb) => myClient.on('authorize', cb),
    onToken: (cb) => myClient.on('token', cb),
    onError: (cb) => myClient.on('error', cb),
  }),
);
```

You provide three hook functions that subscribe to your client's events. The adapter translates these into standard `AuthEvent` objects.

## Hook Functions

| Hook          | Called when                               | Event type emitted |
| ------------- | ----------------------------------------- | ------------------ |
| `onAuthorize` | Authorization request starts or completes | `authorize`        |
| `onToken`     | Tokens are issued or refreshed            | `token`            |
| `onError`     | An authentication error occurs            | `error`            |

### Optional Hooks

You can also provide additional hooks for more detailed event capture:

```typescript
const bridge = createBridge(
  oidc({
    onAuthorize: (cb) => myClient.on('authorize', cb),
    onToken: (cb) => myClient.on('token', cb),
    onError: (cb) => myClient.on('error', cb),
    onRedirect: (cb) => myClient.on('redirect', cb),
    onLogout: (cb) => myClient.on('logout', cb),
  }),
);
```

## What Gets Captured

With the generic OIDC adapter active, the bridge emits events for:

- **Authorization start** -- when the auth flow begins
- **Token issuance** -- access tokens, refresh tokens, ID tokens
- **Token refresh** -- automatic or manual token renewal
- **Errors** -- failed auth requests, expired tokens, network errors
- **Redirects** -- OIDC redirect events (if `onRedirect` hook provided)
- **Logout** -- session termination (if `onLogout` hook provided)

## Advanced Configuration

### Filtering Events

```typescript
const bridge = createBridge(oidc({ onAuthorize, onToken, onError }), {
  filter: (event) => event.type !== 'redirect',
});
```

### Custom Metadata

```typescript
const bridge = createBridge(oidc({ onAuthorize, onToken, onError }), {
  metadata: {
    provider: 'auth0',
    environment: 'staging',
  },
});
```

### Cleanup

```typescript
bridge.destroy();
```

<callout type="info">The generic adapter has the smallest bundle footprint (~0.8 kB minified + gzipped) since it delegates all event subscription to your hook functions.</callout>

## Troubleshooting

- **No events appearing** -- Verify that your hook functions are correctly subscribing to your client's events. The callbacks must be invoked when events fire.
- **Missing event types** -- The generic adapter only captures what you wire up. If you need redirect or logout events, provide the optional hooks.
- **Redacted fields showing as empty** -- The bridge redacts sensitive fields by default. Pass `redact: false` during development only.
