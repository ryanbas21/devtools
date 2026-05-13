---
title: 'Getting Started'
description: 'Install and configure wolfcola devtools'
section: guides
order: 1
---

# Getting Started

Install the wolfcola devtools packages you need.

## OIDC DevTools

### Browser Extension (No SDK Required)

Install the browser extension from the [Chrome Web Store](https://chrome.google.com/webstore) or [Firefox Add-ons](https://addons.mozilla.org). The extension uses **network-first detection** to automatically identify and annotate OIDC traffic without any code changes to your app.

<callout type="info">Network-first detection works by matching URLs against common auth endpoint patterns and parsing `.well-known/openid-configuration` responses. No SDK integration is needed for basic flow visibility.</callout>

### Bridge SDK (Optional, Richer Events)

For deeper visibility into SDK state (node transitions, session diffs, config data), install the bridge:

```bash
npm install @wolfcola/devtools-bridge
```

The bridge provides adapters for Ping Identity SDKs: DaVinci (`@forgerock/davinci-client`), Journey, and OIDC (`@forgerock/oidc-client`). See the integration guides for setup details.

### VS Code Extension

Install the VS Code extension for in-editor flow inspection via CDP. See the [VS Code Extension](/docs/vscode-extension) guide.

## Tree-Shake Verification

```bash
npm install -D @wolfcola/treeshake-check
```

Run the CLI from your package directory:

```bash
npx treeshake-check
```

Or point it at a specific package:

```bash
npx treeshake-check --cwd packages/my-lib
```

## Dead Export Detection

```bash
npm install -D @wolfcola/dead-export-finder
```

Scan your monorepo for unused exports:

```bash
npx dead-export-finder
```

## Next Steps

- Read the [Tree-Shaking Guide](/docs/tree-shaking)
- Explore the [Architecture](/architecture)
- Learn about the [DevTools Extension](/docs/devtools-extension)
- Check out the [VS Code Extension](/docs/vscode-extension)
