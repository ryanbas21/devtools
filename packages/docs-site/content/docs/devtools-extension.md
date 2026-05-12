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

Install from [Firefox Add-ons](https://addons.mozilla.org). The extension supports Firefox 115+ (ESR) and all modern Firefox releases.

### Manual Installation (Development)

For local development or testing unreleased builds:

```bash
git clone https://github.com/ryanbas21/devtools.git
cd devtools
pnpm install
pnpm --filter @wolfcola/devtools-extension build
```

Then load the unpacked extension from `packages/devtools-extension/` in your browser's extension management page (the `manifest.json` is in the package root).

## Using the DevTools Panel

Once installed, open your browser DevTools (F12 or Cmd+Opt+I) and look for the **OIDC DevTools** tab. The panel activates automatically when the inspected page includes the `@wolfcola/devtools-bridge` SDK.

## Views

The extension provides three views, accessible via tabs at the top of the panel.

### Timeline

The Timeline view shows a chronological list of every `AuthEvent` emitted by the bridge. Each event displays:

- **Event type** (e.g. `sdk:node-change`, `session:cookie`, `sdk:oidc-state`)
- **Timestamp** relative to the page load
- **Payload** expandable JSON tree with the full event data

Use the filter bar at the top to narrow events by type or search within payloads.

### Flow

The Flow view renders the current OIDC flow as a state diagram. Each node represents a `FlowState`, and edges represent the transitions triggered by `AuthEvent` objects. This is especially useful for visualizing complex DaVinci orchestration flows that involve multiple steps and decision nodes.

Color coding indicates the state of each node:

- **Blue** — completed successfully
- **Yellow** — in progress
- **Red** — errored

### Learn

The Learn view provides contextual documentation for the OIDC concepts involved in the current flow. When you select an event in the Timeline or a node in the Flow view, the Learn panel shows:

- What the event or state represents in the OIDC spec
- Common issues and troubleshooting tips
- Links to the relevant RFC sections

<callout type="info">The Learn view content is bundled with the extension and works offline.</callout>

## Troubleshooting

If the OIDC DevTools tab does not appear:

1. Make sure the extension is enabled in your browser's extension manager
2. Verify that the inspected page includes the `@wolfcola/devtools-bridge` package
3. Close and reopen DevTools — the panel registers on DevTools initialization
4. Check the browser console for errors from the extension background script
