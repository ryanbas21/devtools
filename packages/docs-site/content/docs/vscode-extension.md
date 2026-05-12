---
title: 'VS Code Extension'
description: 'Use the OIDC DevTools VS Code extension with CDP support'
section: guides
order: 3
---

# VS Code Extension

The wolfcola DevTools VS Code extension brings OIDC flow inspection directly into your editor. It connects to a running browser via the Chrome DevTools Protocol (CDP) and streams `AuthEvent` data into a VS Code panel.

## Installation

Install from the VS Code Marketplace:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "wolfcola devtools"
4. Click Install

Alternatively, install from the command line:

```bash
code --install-extension wolfcola.devtools-vscode
```

## CDP WebSocket Connection

The extension requires a WebSocket connection to a browser running with remote debugging enabled.

### Starting Chrome with CDP

```bash
google-chrome --remote-debugging-port=9222
```

### Starting Edge with CDP

```bash
msedge --remote-debugging-port=9222
```

### Configuring the Extension

Open VS Code settings and set the CDP endpoint:

```json
{
  "wolfcola.devtools.cdpEndpoint": "ws://localhost:9222"
}
```

The extension will auto-discover available pages and connect to the first one that has the `@wolfcola/devtools-bridge` SDK active.

## Features

### Live Event Stream

The extension sidebar shows a live feed of `AuthEvent` objects as they are emitted. Events are color-coded by type and can be expanded to view the full JSON payload.

### Flow State Visualization

A webview panel renders the current `FlowState` as an interactive diagram, similar to the browser extension's Flow view. You can pan, zoom, and click nodes to inspect their data.

### CodeLens Integration

When the extension detects that your workspace contains `@wolfcola/devtools-bridge` import statements, it adds CodeLens annotations above `createBridge()` calls showing the connection status and last event received.

### Diagnostics

The extension reports issues as VS Code diagnostics:

- Missing or misconfigured bridge initialization
- Schema validation failures on captured events
- Connection drops or CDP endpoint issues

<callout type="warning">The CDP connection requires the browser to be started with the `--remote-debugging-port` flag. Without it, the extension cannot connect.</callout>

## Commands

The extension contributes the following commands to the Command Palette:

- **OIDC DevTools: Connect** — Connect to the configured CDP endpoint
- **OIDC DevTools: Disconnect** — Close the CDP connection
- **OIDC DevTools: Show Flow** — Open the flow visualization panel
- **OIDC DevTools: Clear Events** — Clear the event stream
