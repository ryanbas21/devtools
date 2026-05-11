# E2E Tests

Playwright end-to-end tests for the WolfCola DevTools browser extension.

## Tests

| Test | What it verifies |
|------|-----------------|
| `extension-loads` | Service worker registers, DevTools panel mounts |
| `network-capture` | OIDC network events are captured and annotated |
| `panel-renders-events` | Events render in the timeline, clear button works |
| `firefox-build` | Firefox build produces valid manifest and dist files |

## Running

```bash
pnpm test
```

Chrome must be installed. The tests load the built extension into a Chrome instance with a temporary user data directory.

## Setup

The tests use a shared fixture (`fixtures/extension.ts`) that:
1. Creates a temporary Chrome profile with the extension loaded
2. Provides a `BrowserContext` with the extension ID resolved
3. Starts a mock OIDC server (`mock-oidc-server/server.ts`) for network capture tests

## Mock OIDC server

A lightweight HTTP server that implements:
- `/.well-known/openid-configuration` — discovery document
- `/authorize` — authorization endpoint (302 redirect)
- `/token` — token endpoint (returns access/refresh/ID tokens)
- `/userinfo` — userinfo endpoint

## Prerequisites

- Chrome installed
- Extension must be built first: `cd packages/devtools-extension && pnpm build`

## License

MIT
