---
title: 'VS Code Extension'
description: 'Use the OIDC DevTools VS Code extension with CDP support'
section: guides
order: 3
---

# VS Code Extension

The wolfcola DevTools VS Code extension brings OIDC flow inspection directly into your editor. It connects to a running browser via the Chrome DevTools Protocol (CDP) and streams auth events into VS Code.

## Installation

Install from the VS Code Marketplace:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "OIDC DevTools"
4. Click Install

Alternatively, install from the command line:

```bash
code --install-extension ryanbasmajian.oidc-devtools
```

## CDP Connection

The extension requires a WebSocket connection to a Chromium-based browser running with remote debugging enabled.

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

The extension auto-discovers available page targets and connects to the first one with auth-related activity.

<callout type="warning">The CDP connection requires the browser to be started with the `--remote-debugging-port` flag. Without it, the extension cannot connect.</callout>

## Features

### Live Network Capture

When a capture session is active, the extension uses the CDP `Network` domain to intercept HTTP traffic. Auth-related requests are identified using the same network observer and OIDC annotation pipeline as the browser extension — URL pattern matching, well-known discovery, DPoP detection, and PAR detection all work identically.

### SDK Event Injection

If the inspected page includes `@wolfcola/devtools-bridge`, the extension captures bridge events via CDP script injection. This provides SDK node state, session diffs, and config data without needing the browser extension installed.

### Timeline Tree View

The sidebar shows a native VS Code tree view of captured events. Each item displays:

- Status icon (success, error, in-progress)
- OIDC phase badge
- Duration

Click an event to reveal details in the Flow webview or to select it for inspection.

### Flow Webview Panel

A webview panel renders the same Elm-based flow visualization as the browser extension, adapted to follow the active VS Code color theme. The panel receives real-time event updates during an active capture session.

### Diagnosis

The extension runs the same diagnosis engine as the browser extension. Issues are detected automatically when events are processed — CORS problems, missing PKCE, expired tokens, DPoP validation failures, and more.

### Status Bar

A status bar item at the bottom of the VS Code window shows:

- Connection state (disconnected, connecting, connected)
- Live event count during an active capture

### Export

Export the captured flow as a new VS Code document in either format:

- **JSON** — full flow data with automatic sensitive data redaction
- **Markdown** — human-readable report with diagnosis summary

## Commands

The extension contributes the following commands to the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

| Command                          | Description                                                  |
| -------------------------------- | ------------------------------------------------------------ |
| **OIDC DevTools: Start Capture** | Connect to the CDP endpoint and begin capturing auth traffic |
| **OIDC DevTools: Stop Capture**  | Disconnect and stop the capture session                      |
| **OIDC DevTools: Clear Events**  | Clear the timeline and event store                           |
| **OIDC DevTools: Export Flow**   | Export the current flow as JSON or Markdown                  |
| **OIDC DevTools: Select Event**  | Reveal the flow panel and highlight a specific event         |

## Debug Configuration

The extension registers an `oidc-devtools` debug configuration type, allowing you to add capture sessions to your `launch.json`:

```json
{
  "type": "oidc-devtools",
  "request": "attach",
  "name": "Capture OIDC Flow",
  "port": 9222
}
```

## Troubleshooting

### Extension cannot connect

- Verify the browser was started with `--remote-debugging-port=9222`
- Check that no other process is using port 9222
- Try navigating to `http://localhost:9222/json` in a browser to verify CDP is responding

### No events captured

- Make sure the inspected page performs OIDC authentication
- Check the Output panel (View > Output) and select "OIDC DevTools" for diagnostic logs
- Verify the page is not using a service worker that intercepts network requests before CDP can observe them
