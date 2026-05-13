---
title: 'DevTools Extension'
description: 'Use the OIDC DevTools browser extension for Chrome and Firefox'
section: guides
order: 2
---

# DevTools Extension

The wolfcola DevTools browser extension adds a dedicated panel to your browser's developer tools for inspecting OIDC authentication flows in real time.

## Installation

### Chrome

Install from the [Chrome Web Store](https://chrome.google.com/webstore). Search for "wolfcola devtools" or follow the direct link from the repository README.

### Firefox

Install from [Firefox Add-ons](https://addons.mozilla.org). The extension supports Firefox 128+ and all modern Firefox releases.

### Manual Installation (Development)

For local development or testing unreleased builds:

```bash
git clone https://github.com/ryanbas21/devtools.git
cd devtools
pnpm install
pnpm --filter @wolfcola/devtools-extension build
```

Then load the unpacked extension from `packages/devtools-extension/dist/` in your browser's extension management page.

## Network-First Detection

The extension works **without the `@wolfcola/devtools-bridge` SDK**. It uses a network observer in the service worker that automatically detects OIDC-related traffic by:

1. **URL pattern matching** against common auth endpoint patterns (`/authorize`, `/token`, `/userinfo`, `/revoke`, `/introspect`, `/par`, `/jwks`, `/.well-known/openid-configuration`, etc.)
2. **Well-known discovery** — when a `.well-known/openid-configuration` response is seen, the extension parses it and matches all discovered endpoints going forward
3. **CORS detection** — identifies status-zero failures and missing headers on auth requests
4. **Static asset filtering** — ignores JS, CSS, images, and fonts

When the `@wolfcola/devtools-bridge` SDK is also present, the extension receives richer events (SDK node state, session diffs, config data) in addition to network events.

<callout type="info">Network-first detection means you can open the OIDC DevTools panel on any page that talks to an OIDC provider and immediately see annotated traffic, even without instrumenting your app.</callout>

## Using the DevTools Panel

Open your browser DevTools (F12 or Cmd+Opt+I) and look for the **OIDC DevTools** tab.

## Views

The extension provides three views, accessible via tabs at the top of the panel.

### Timeline

The Timeline view shows a chronological table of every `AuthEvent` captured. Each row displays:

- **Type badge** — `NET` (network), `SDK` (bridge event), `SES` (session diff), or `CFG` (config)
- **Status code** — HTTP status for network events
- **OIDC phase tag** — the detected phase (`discovery`, `authorize`, `token`, `par`, `userinfo`, etc.)
- **Timestamp** relative to the page load

Clicking a row opens the Inspector panel on the right with detailed information about that event.

A **graph sidebar** on the right shows SDK node transitions as a vertical rail when bridge events are present.

### Flow

The Flow view renders the current authentication flow as a visual diagram. Each node represents an SDK state, and edges show transitions triggered by events.

Features include:

- **Node rail** — vertical sequence of SDK nodes with status indicators
- **Detail cards** — expanded information for the selected node
- **Time-travel playback** — Prev/Play/Pause/Reset controls that replay SDK node transitions with timing that mirrors the real elapsed time (clamped between 300ms and 1500ms per step)
- **Flow Health banner** — a summary strip showing the overall diagnosis for the flow (error count, warning count)

Color coding indicates the state of each node:

- **Blue** — completed successfully
- **Yellow** — in progress
- **Red** — errored

### Learn

The Learn view provides a canvas-based lifecycle visualization that adapts to the detected authentication pattern. The layout is automatically chosen based on the events captured:

| Layout          | Detected when                                          |
| --------------- | ------------------------------------------------------ |
| **DaVinci**     | DaVinci SDK node events are present                    |
| **Journey**     | Journey step events are present                        |
| **OIDC + PAR**  | OIDC events with a `par` phase are present             |
| **OIDC + DPoP** | OIDC events with DPoP proofs are present               |
| **OIDC (Code)** | Default fallback for standard authorization code flows |

The canvas supports pan, zoom, and card expansion for exploring the lifecycle stages.

<callout type="info">The Learn view content is bundled with the extension and works offline.</callout>

## Inspector Tabs

When you select an event in the Timeline, the Inspector panel shows context-aware tabs. Only tabs relevant to the selected event are displayed.

### Diagnosis

Appears at the top when issues are detected. Shows diagnosis entries with severity (error, warning, info), a title, description, and numbered remediation steps.

### Headers

Available for network events. Shows the request URL, HTTP method, and request/response headers. JWT values in `Authorization` headers are automatically decoded inline. If the network event was triggered by an SDK node, a "Caused By" link navigates to the originating event.

### Payload

Available for network events that have a request or response body. Shows the parsed body as a JSON tree with a copy-to-clipboard button.

### Cookies

Available for network events. Extracts cookies from the request `Cookie` header and response `Set-Cookie` headers.

### CORS

Shows CORS detection results. Green indicates no issues; red shows the specific CORS failure reason (status-zero, missing `Access-Control-Allow-Origin`, wildcard with credentials, etc.).

### SDK State

Available for DaVinci SDK events. Shows the node status transition (e.g. `start` to `continue`), HTTP status, node metadata (name, description, event name), interaction IDs, error details, and authorization data.

### Collectors

Available for SDK events with collector data. Lists each collector object with individual copy buttons and a "Copy all" button.

### Session

Available for session diff events. Shows the storage key, and the before/after values color-coded for easy comparison.

### Config

Available for SDK config events. Displays the raw SDK configuration as a JSON tree.

### OIDC

Available for events with OIDC semantic annotations. Shows the detected phase, grant type, client ID, state parameter, PKCE status, DPoP status, token presence, PAR request URI, and any OIDC error details.

## Diagnosis Engine

The extension includes a built-in diagnosis engine that automatically detects issues in captured flows. Diagnosis rules run on both individual events and the overall flow.

### CORS Rules

- **Preflight rejection** — network failure with status zero
- **Missing Allow-Origin** — server omits `Access-Control-Allow-Origin`
- **Wildcard with credentials** — `*` origin combined with `credentials: include`
- **Credentials not allowed** — cookies sent but server denies credentials

### Token and Session Rules

- **Missing interaction token** — node transition without `interactionToken`
- **Session not found** — session expired or missing on server

### Flow Config Rules

- **Node error** — DaVinci node returned error/failure status
- **Connector error** — DaVinci connector HTTP error
- **Policy not found** — flow policy ID does not exist

### OIDC Rules

- **State mismatch** — state parameter differs between request and callback
- **Missing PKCE** — authorization request without PKCE challenge
- **Missing PKCE verifier** — token request without `code_verifier`
- **Nonce missing** — missing nonce when `openid` scope is requested
- **Redirect URI mismatch** — redirect URI not registered at the authorization server
- **Implicit flow detected** — `response_type=token` (discouraged)
- **Expired authorization code** — code reuse detected (single-use violation)

### DPoP Rules

- **Invalid structure** — DPoP proof JWT missing required claims (`htm`, `htu`, `iat`, `jti`)
- **Method mismatch** — `htm` claim does not match HTTP method
- **URI mismatch** — `htu` claim does not match request URL
- **Nonce required** — server requires DPoP nonce but none provided
- **Missing proof** — token endpoint request without DPoP header

### PAR Rules

- **Missing request_uri** — PAR response missing `request_uri`
- **Inline params with request_uri** — both `request_uri` and inline parameters present (conflict)

Each diagnosis entry includes a severity level, a human-readable title and description, and numbered remediation steps.

## Import and Export

### Export

Click the export button in the toolbar to save the current flow. Two formats are available:

- **JSON** — full `FlowExport` object with automatic sensitive data redaction (tokens, passwords, credentials, cookies are replaced with `<redacted:...>` placeholders)
- **Markdown** — human-readable report including a diagnosis summary

### Import

Click the import button and paste a previously exported JSON string to load a saved flow.

## Snapshots

Save up to 5 flow snapshots to local storage for later comparison. Use the snapshot toolbar to save, load, and delete snapshots.

## Theme

The extension supports light and dark mode via the theme toggle in the toolbar. The preference is persisted and applies immediately.

## Troubleshooting

If the OIDC DevTools tab does not appear:

1. Make sure the extension is enabled in your browser's extension manager
2. Close and reopen DevTools — the panel registers on DevTools initialization
3. Check the browser console for errors from the extension background script

If no events appear:

1. Navigate to a page that performs OIDC authentication
2. The extension detects auth traffic automatically via network observation
3. For richer SDK events, add the `@wolfcola/devtools-bridge` package to your app
