# @wolfcola/devtools-extension

## 1.2.0

### Patch Changes

- Updated dependencies [[`bc42519`](https://github.com/ryanbas21/devtools/commit/bc42519de6075ec9f60d1b3091ef0603b9ead74a), [`4b2b276`](https://github.com/ryanbas21/devtools/commit/4b2b27643c4533e79732c9cc69ca25c9ff581efd)]:
  - @wolfcola/devtools-core@1.2.0
  - @wolfcola/devtools-types@1.2.0

## 1.1.1

### Patch Changes

- Updated dependencies []:
  - @wolfcola/devtools-core@1.1.1
  - @wolfcola/devtools-types@1.1.1

## 1.1.0

### Minor Changes

- [#47](https://github.com/ryanbas21/devtools/pull/47) [`f3e7c29`](https://github.com/ryanbas21/devtools/commit/f3e7c29f83e4eca83b702dad34e4ca23cb6ed09b) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Add Payload tab to inspector panel, separating request/response bodies from the Headers tab into a dedicated tab matching Chrome DevTools naming conventions

### Patch Changes

- [#39](https://github.com/ryanbas21/devtools/pull/39) [`f4fcc75`](https://github.com/ryanbas21/devtools/commit/f4fcc753d18750443e09550dc4f069b01f2362f3) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Automate manifest.json version sync: after `changeset version` bumps
  package.json, the new `sync-manifest` CLI copies the version into
  manifest.json so Chrome Web Store publishes show real version numbers.
- Updated dependencies []:
  - @wolfcola/devtools-core@1.1.0
  - @wolfcola/devtools-types@1.1.0

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
