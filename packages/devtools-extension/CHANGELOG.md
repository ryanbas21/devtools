# @wolfcola/devtools-extension

## 1.0.0

### Minor Changes

- [#11](https://github.com/ryanbas21/devtools/pull/11) [`2a82f51`](https://github.com/ryanbas21/devtools/commit/2a82f514acea0cd906de50eafc096c880c883780) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Add Firefox extension support with build target (`pnpm build:firefox`), AMO publishing in CI, and Firefox load instructions. Minimum Firefox version: 128+.

- [#13](https://github.com/ryanbas21/devtools/pull/13) [`ef1fcd4`](https://github.com/ryanbas21/devtools/commit/ef1fcd4ef6d2239a3eb0c3d4dcc0075b020bd2c0) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Extract shared logic into `@wolfcola/devtools-core` and shared Elm UI into `@wolfcola/devtools-ui`. Add VS Code extension (`oidc-devtools`) for OIDC/OAuth debugging via Chrome DevTools Protocol.

  ### New packages
  - **`@wolfcola/devtools-core`** — annotators, diagnosis engine, event store, and export logic extracted from the browser extension
  - **`@wolfcola/devtools-ui`** — shared Elm UI (Timeline, Flow, Learn views) compiled to JS with TypeScript port interface
  - **`oidc-devtools`** (VS Code extension) — live OIDC/OAuth2 debugging via CDP with TreeView, WebView, and diagnosis

  ### Browser extension changes
  - Now imports shared logic from `@wolfcola/devtools-core` instead of bundling it inline
  - Now imports compiled Elm UI from `@wolfcola/devtools-ui` instead of compiling Elm in-tree
  - Provides chrome.storage-backed `EventStoreChromeLive` layer (replaces the old `EventStoreLive`)
  - No user-facing behavior changes

### Patch Changes

- [#28](https://github.com/ryanbas21/devtools/pull/28) [`53ae506`](https://github.com/ryanbas21/devtools/commit/53ae506eb86099d92641c8a1caf77f5b0855cc3f) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Automate manifest version stamping: append CI build number as 4th version
  segment so every Chrome Web Store and Firefox Add-ons upload has a unique,
  always-increasing version.
- Updated dependencies [[`07a98e3`](https://github.com/ryanbas21/devtools/commit/07a98e37a75a735cceff87f5efbef11f55395543)]:
  - @wolfcola/devtools-types@1.0.0
  - @wolfcola/devtools-core@1.0.0
