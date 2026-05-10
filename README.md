# WolfCola DevTools

**Captures, correlates, and diagnoses** OIDC/OAuth 2.0 authentication flows in real time — works standalone with any OIDC provider or as an enhanced companion to the Ping Identity SDK.

A Chrome DevTools panel that replaces the Network-panel-and-jwt.io workflow with a single view: OIDC-annotated network traffic, SDK-level event correlation, inline JWT decoding, and an automated diagnosis engine that tells you what went wrong and how to fix it.

![Flow view with diagnosis banner and node rail](packages/devtools-extension/screenshots/Flow-Screen.png)

---

## Packages

| Package | Description | npm |
| --- | --- | --- |
| [`@wolfcola/devtools-extension`](packages/devtools-extension) | Chrome extension — DevTools panel with Timeline, Flow, and Learn views | private |
| [`@wolfcola/devtools-bridge`](packages/devtools-bridge) | Opt-in SDK adapter — emits `AuthEvent`s from DaVinci, Journey, and OIDC clients | [![npm](https://img.shields.io/npm/v/@wolfcola/devtools-bridge)](https://www.npmjs.com/package/@wolfcola/devtools-bridge) |
| [`@wolfcola/devtools-types`](packages/devtools-types) | Shared `AuthEvent` Effect Schema definitions and TypeScript types | [![npm](https://img.shields.io/npm/v/@wolfcola/devtools-types)](https://www.npmjs.com/package/@wolfcola/devtools-types) |

---

## Quick start

```bash
pnpm install
pnpm build
```

Load the extension as unpacked from `packages/devtools-extension/dist/` — see the [extension README](packages/devtools-extension) for full instructions.

To wire up SDK-level events in your app:

```bash
pnpm add @wolfcola/devtools-bridge
```

```ts
import { davinci } from '@forgerock/davinci-client';
import { attachDevToolsBridge } from '@wolfcola/devtools-bridge';

const client = await davinci({ config });
attachDevToolsBridge(client, config);
```

The bridge is a no-op when the extension is not installed.

---

## Development

```bash
pnpm install
pnpm build          # build all packages
pnpm lint           # eslint
pnpm test           # vitest
```

---

## License

MIT — see [LICENSE](./LICENSE) for details.
