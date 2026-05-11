# @wolfcola/devtools-core

Shared logic for WolfCola DevTools. Contains annotators, diagnosis engine, event store, and export utilities. Used by both the browser extension and VS Code extension.

## Modules

### Annotators (`src/annotators/`)

Pure functions that analyze network traffic and detect OIDC/OAuth patterns.

| Module | Purpose |
|--------|---------|
| `network-observer` | Filters auth-related requests and builds `AuthEvent` from HAR entries |
| `oidc-annotator` | Detects OIDC phases (authorize, token, userinfo, etc.) and extracts parameters |
| `cors-detector` | Identifies CORS issues (missing headers, wildcard+credentials, status zero) |
| `dpop-detector` | Detects DPoP proof JWTs and validates claims |
| `par-detector` | Detects Pushed Authorization Requests |
| `oidc-discovery` | Parses `.well-known/openid-configuration` and matches endpoints |
| `oidc-flow-tracker` | Tracks multi-step OIDC flows across requests |
| `jwt-utils` | JWT decoding, pattern matching, and expiry detection |

### Diagnosis engine (`src/diagnosis/`)

Rule-based diagnostic engine that analyzes captured events and produces actionable issues.

**Rule categories:**
- CORS rules — preflight failures, missing `Access-Control-Allow-Origin`, wildcard+credentials
- Token rules — missing interaction tokens, expired sessions
- Flow config rules — DaVinci node errors, connector errors, policy not found
- OIDC rules — state mismatch, redirect URI mismatch, missing PKCE
- DPoP rules — proof JWT validation, method/URI mismatches
- PAR rules — missing `request_uri`, inline params with `request_uri`

### Event store (`src/event-store/`)

Effect-based event store with dependency injection via `Context.Tag` and `Layer`.

- `EventStoreInMemory` — in-memory store with no-op persistence (for VS Code and testing)
- Consumers provide their own Layer for persistent storage (e.g., `chrome.storage.local`)

### Export (`src/export/`)

- `redact` — strips sensitive data (tokens, passwords, credentials) from flow state
- `markdown` — renders a flow as a Markdown table with diagnosis results

## Usage

```ts
import {
  buildNetworkEvent,
  isAuthRelated,
  runDiagnosis,
  redactFlowState,
  renderFlowMarkdown,
  EventStoreService,
  EventStoreInMemory,
} from '@wolfcola/devtools-core';
```

## Testing

```bash
pnpm test    # 161 tests
```

## License

MIT
