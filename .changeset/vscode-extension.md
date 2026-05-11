---
"@wolfcola/devtools-extension": minor
---

Extract shared logic into `@wolfcola/devtools-core` and shared Elm UI into `@wolfcola/devtools-ui`. Add VS Code extension (`oidc-devtools`) for OIDC/OAuth debugging via Chrome DevTools Protocol.

### New packages

- **`@wolfcola/devtools-core`** — annotators, diagnosis engine, event store, and export logic extracted from the browser extension
- **`@wolfcola/devtools-ui`** — shared Elm UI (Timeline, Flow, Learn views) compiled to JS with TypeScript port interface
- **`oidc-devtools`** (VS Code extension) — live OIDC/OAuth2 debugging via CDP with TreeView, WebView, and diagnosis

### Browser extension changes

- Now imports shared logic from `@wolfcola/devtools-core` instead of bundling it inline
- Now imports compiled Elm UI from `@wolfcola/devtools-ui` instead of compiling Elm in-tree
- Provides chrome.storage-backed `EventStoreChromeLive` layer (replaces the old `EventStoreLive`)
- No user-facing behavior changes
