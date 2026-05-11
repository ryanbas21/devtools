# OIDC DevTools VS Code Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the WolfCola OIDC/OAuth debugging extension to VS Code with full feature parity — live network capture via CDP, SDK event injection, shared Elm UI, and the same diagnosis engine.

**Architecture:** CDP connects VS Code to Chrome for network capture. A small script injected via `Page.addScriptToEvaluateOnNewDocument` captures SDK events through `Runtime.bindingCalled`. Shared packages (`devtools-core` for logic, `devtools-ui` for Elm) are consumed by both the browser extension and VS Code extension. The VS Code UI is a TreeView (timeline) + WebView (Flow/Learn views).

**Tech Stack:** TypeScript, Effect, Elm 0.19.1, VS Code Extension API, Chrome DevTools Protocol, esbuild, pnpm workspaces

---

## File Structure

### New packages

```
packages/devtools-core/
├── package.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
├── vite.config.ts
└── src/
    ├── index.ts                          # barrel export
    ├── annotators/
    │   ├── oidc-annotator.ts             # moved from devtools-extension
    │   ├── cors-detector.ts              # moved from devtools-extension
    │   ├── dpop-detector.ts              # moved from devtools-extension
    │   ├── par-detector.ts               # moved from devtools-extension
    │   ├── oidc-discovery.ts             # moved from devtools-extension
    │   ├── oidc-flow-tracker.ts          # moved from devtools-extension
    │   ├── network-observer.ts           # moved from devtools-extension
    │   ├── oidc-annotator.test.ts        # moved from devtools-extension
    │   ├── cors-detector.test.ts         # moved
    │   ├── dpop-detector.test.ts         # moved
    │   ├── par-detector.test.ts          # moved
    │   ├── oidc-discovery.test.ts        # moved
    │   ├── oidc-flow-tracker.test.ts     # moved
    │   ├── oidc-integration.test.ts      # moved
    │   └── network-observer.test.ts      # moved
    ├── diagnosis/
    │   ├── diagnosis-engine.ts           # moved from devtools-extension
    │   ├── diagnosis-engine.test.ts      # moved
    │   ├── serialize-diagnosis.ts        # moved
    │   └── serialize-diagnosis.test.ts   # moved
    ├── event-store/
    │   ├── event-store.service.ts        # moved, persist/rehydrate made abstract
    │   └── event-store.service.test.ts   # moved
    ├── message-handler/
    │   ├── message-handler.ts            # moved from devtools-extension
    │   └── message-handler.test.ts       # moved
    └── export/
        ├── markdown.ts                   # moved from devtools-extension
        ├── markdown.test.ts              # moved
        ├── redact.ts                     # moved
        └── redact.test.ts               # moved

packages/devtools-ui/
├── package.json
├── elm.json                              # moved from devtools-extension root
├── build.mjs                             # Elm compilation + terser
└── src/
    ├── Main.elm                          # moved from devtools-extension/src/panel/
    ├── src/                              # moved from devtools-extension/src/panel/src/
    │   ├── Model.elm
    │   ├── View.elm
    │   ├── Update.elm
    │   ├── Types.elm
    │   ├── Timeline.elm
    │   ├── FlowView.elm
    │   ├── LearnView.elm
    │   ├── Inspector.elm
    │   ├── Graph.elm
    │   ├── Decode.elm
    │   ├── Helpers.elm
    │   └── JsonTree.elm
    ├── ports.ts                          # TypeScript port interface definition
    ├── panel.css                         # extracted from panel.html <style>
    └── panel.html                        # simplified, references external CSS + elm.js

packages/vscode-extension/
├── package.json                          # VS Code extension manifest (contributes, activationEvents)
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
├── vite.config.ts
├── esbuild.mjs                           # bundles extension + webview
├── .vscodeignore
└── src/
    ├── extension.ts                      # activate/deactivate, register commands
    ├── cdp/
    │   ├── cdp-client.ts                 # CDP WebSocket connection + Network domain
    │   ├── cdp-client.test.ts
    │   ├── sdk-injector.ts               # Page.addScriptToEvaluateOnNewDocument
    │   ├── sdk-injector.test.ts
    │   └── target-discovery.ts           # GET /json to find targets
    ├── providers/
    │   ├── timeline-tree.ts              # TreeDataProvider for timeline
    │   ├── timeline-tree.test.ts
    │   └── timeline-item.ts              # TreeItem subclass
    ├── panels/
    │   ├── flow-webview.ts               # WebviewPanel for Flow/Learn
    │   └── flow-webview.test.ts
    ├── launch/
    │   ├── debug-config-provider.ts      # DebugConfigurationProvider
    │   ├── chrome-launcher.ts            # spawn Chrome with --remote-debugging-port
    │   └── chrome-launcher.test.ts
    ├── status-bar.ts                     # StatusBarItem management
    └── webview/
        ├── index.html                    # WebView HTML shell
        └── webview-adapter.ts            # postMessage ↔ Elm port bridge
```

### Modified files

```
packages/devtools-extension/
├── package.json                          # add @wolfcola/devtools-core dependency
├── src/
│   ├── background/
│   │   ├── service-worker.ts             # re-export from devtools-core, add chrome.storage persist
│   │   └── event-store.service.ts        # DELETED — moved to devtools-core
│   │   └── message-handler.ts            # DELETED — moved to devtools-core
│   │   └── diagnosis-engine.ts           # DELETED — moved to devtools-core
│   │   └── serialize-diagnosis.ts        # DELETED — moved to devtools-core
│   ├── devtools/
│   │   └── (all annotator files)         # DELETED — moved to devtools-core
│   ├── export/
│   │   └── (markdown.ts, redact.ts)      # DELETED — moved to devtools-core
│   ├── panel/
│   │   ├── panel.ts                      # imports Elm type from devtools-ui/ports
│   │   ├── Main.elm                      # DELETED — moved to devtools-ui
│   │   └── src/                          # DELETED — moved to devtools-ui
│   └── shared/
│       └── jwt-utils.ts                  # moved to devtools-core/export/ or kept
├── build.mjs                             # MODIFIED — no longer compiles Elm, copies from devtools-ui
├── elm.json                              # DELETED — moved to devtools-ui

pnpm-workspace.yaml                       # unchanged (already uses packages/*)
tsconfig.base.json                        # unchanged
vitest.workspace.ts                       # unchanged (already uses packages/*)
```

---

## Phase 1: Extract `devtools-core`

### Task 1: Scaffold `devtools-core` package

**Files:**
- Create: `packages/devtools-core/package.json`
- Create: `packages/devtools-core/tsconfig.json`
- Create: `packages/devtools-core/tsconfig.lib.json`
- Create: `packages/devtools-core/tsconfig.spec.json`
- Create: `packages/devtools-core/vite.config.ts`
- Create: `packages/devtools-core/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@wolfcola/devtools-core",
  "version": "0.0.0",
  "private": true,
  "description": "Shared logic for WolfCola DevTools — annotators, diagnosis, event store",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "import": "./dist/src/index.js",
      "default": "./dist/src/index.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.lib.json",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@wolfcola/devtools-types": "workspace:*",
    "effect": "catalog:effect"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

- [ ] **Step 3: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "nodenext",
    "module": "NodeNext",
    "target": "ES2022",
    "outDir": "./dist",
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "strict": true,
    "noImplicitOverride": true,
    "declaration": true,
    "declarationMap": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "lib": ["es2022", "dom", "dom.iterable"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts"],
  "references": [{ "path": "../devtools-types/tsconfig.lib.json" }]
}
```

Note: `"lib": ["dom"]` is needed because `network-observer.ts` uses `URLSearchParams`, `URL`, and `crypto.randomUUID()`. These are also available in Node 20+ but the types come from `dom`.

- [ ] **Step 4: Create tsconfig.spec.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc/vitest",
    "types": [
      "vitest/globals",
      "vitest/importMeta",
      "vite/client",
      "node",
      "vitest"
    ],
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noImplicitOverride": true,
    "lib": ["es2022", "dom", "dom.iterable"]
  },
  "include": ["vite.config.ts", "src/**/*.test.ts", "src/**/*.spec.ts"],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 5: Create vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create empty barrel export**

```ts
// packages/devtools-core/src/index.ts
// Barrel exports — populated as modules are moved in
```

- [ ] **Step 7: Install dependencies**

Run: `pnpm install`

- [ ] **Step 8: Verify the package builds**

Run: `cd packages/devtools-core && pnpm build`
Expected: successful compilation (empty barrel export)

- [ ] **Step 9: Commit**

```bash
git add packages/devtools-core/
git commit -m "chore: scaffold devtools-core package"
```

---

### Task 2: Move annotators to `devtools-core`

**Files:**
- Create: `packages/devtools-core/src/annotators/oidc-annotator.ts`
- Create: `packages/devtools-core/src/annotators/cors-detector.ts`
- Create: `packages/devtools-core/src/annotators/dpop-detector.ts`
- Create: `packages/devtools-core/src/annotators/par-detector.ts`
- Create: `packages/devtools-core/src/annotators/oidc-discovery.ts`
- Create: `packages/devtools-core/src/annotators/oidc-flow-tracker.ts`
- Create: `packages/devtools-core/src/annotators/network-observer.ts`
- Create: all corresponding `.test.ts` files
- Modify: `packages/devtools-core/src/index.ts`

- [ ] **Step 1: Copy all annotator source files**

Copy (do not delete originals yet) all files from `packages/devtools-extension/src/devtools/` into `packages/devtools-core/src/annotators/`:

```
cors-detector.ts          → annotators/cors-detector.ts
cors-detector.test.ts     → annotators/cors-detector.test.ts
dpop-detector.ts          → annotators/dpop-detector.ts
dpop-detector.test.ts     → annotators/dpop-detector.test.ts
par-detector.ts           → annotators/par-detector.ts
par-detector.test.ts      → annotators/par-detector.test.ts
oidc-annotator.ts         → annotators/oidc-annotator.ts
oidc-annotator.test.ts    → annotators/oidc-annotator.test.ts
oidc-discovery.ts         → annotators/oidc-discovery.ts
oidc-discovery.test.ts    → annotators/oidc-discovery.test.ts
oidc-flow-tracker.ts      → annotators/oidc-flow-tracker.ts
oidc-flow-tracker.test.ts → annotators/oidc-flow-tracker.test.ts
oidc-integration.test.ts  → annotators/oidc-integration.test.ts
network-observer.ts       → annotators/network-observer.ts
network-observer.test.ts  → annotators/network-observer.test.ts
```

Also copy `packages/devtools-extension/src/shared/jwt-utils.ts` and its test to `packages/devtools-core/src/annotators/jwt-utils.ts`.

- [ ] **Step 2: Fix import paths in copied files**

All relative imports between annotator files stay the same (they're in the same directory now). The key changes:

In `network-observer.ts`: change `import { detectCorsFlags } from './cors-detector.js'` — this import already works since both files are in the same dir now. Same for the other cross-imports.

In `par-detector.ts`: change `import type { OidcConfig } from './oidc-discovery.js'` — already same dir.

In `oidc-annotator.ts`: change `import type { OidcConfig } from './oidc-discovery.js'` — already same dir.

In `network-observer.ts`: change `import { detectCorsFlags } from '../devtools/cors-detector.js'` to `import { detectCorsFlags } from './cors-detector.js'` (if the original used a relative path with `../devtools/`). Check each file — these are all currently in the same `devtools/` directory, so they reference each other with `./`. Since we're moving them all to the same `annotators/` directory, the `./` references stay valid.

- [ ] **Step 3: Update barrel export**

```ts
// packages/devtools-core/src/index.ts
export { annotateOidc } from './annotators/oidc-annotator.js';
export { detectCorsFlags } from './annotators/cors-detector.js';
export { detectDpop } from './annotators/dpop-detector.js';
export { detectPar } from './annotators/par-detector.js';
export {
  parseWellKnownResponse,
  isWellKnownUrl,
  matchesDiscoveredEndpoint,
} from './annotators/oidc-discovery.js';
export type { OidcConfig } from './annotators/oidc-discovery.js';
export {
  trackOidcEvent,
  makeEmptyOidcFlowState,
} from './annotators/oidc-flow-tracker.js';
export type { OidcFlowState, OidcFlow } from './annotators/oidc-flow-tracker.js';
export {
  isAuthRelated,
  buildNetworkEvent,
} from './annotators/network-observer.js';
export type { HarEntry, HarHeader } from './annotators/network-observer.js';
export {
  JWT_PATTERN,
  decodeJwtPayload,
  extractJwt,
  findExpiredJwtsInHeaders,
} from './annotators/jwt-utils.js';
```

- [ ] **Step 4: Run tests in devtools-core**

Run: `cd packages/devtools-core && pnpm test`
Expected: All annotator tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-core/
git commit -m "feat(devtools-core): move annotators from devtools-extension"
```

---

### Task 3: Move diagnosis engine and export logic to `devtools-core`

**Files:**
- Create: `packages/devtools-core/src/diagnosis/diagnosis-engine.ts`
- Create: `packages/devtools-core/src/diagnosis/diagnosis-engine.test.ts`
- Create: `packages/devtools-core/src/diagnosis/serialize-diagnosis.ts`
- Create: `packages/devtools-core/src/diagnosis/serialize-diagnosis.test.ts`
- Create: `packages/devtools-core/src/export/markdown.ts`
- Create: `packages/devtools-core/src/export/markdown.test.ts`
- Create: `packages/devtools-core/src/export/redact.ts`
- Create: `packages/devtools-core/src/export/redact.test.ts`
- Modify: `packages/devtools-core/src/index.ts`

- [ ] **Step 1: Copy diagnosis files**

Copy from `packages/devtools-extension/src/background/`:
```
diagnosis-engine.ts       → diagnosis/diagnosis-engine.ts
diagnosis-engine.test.ts  → diagnosis/diagnosis-engine.test.ts
serialize-diagnosis.ts    → diagnosis/serialize-diagnosis.ts
serialize-diagnosis.test.ts → diagnosis/serialize-diagnosis.test.ts
```

- [ ] **Step 2: Copy export files**

Copy from `packages/devtools-extension/src/export/`:
```
markdown.ts       → export/markdown.ts
markdown.test.ts  → export/markdown.test.ts
redact.ts         → export/redact.ts
redact.test.ts    → export/redact.test.ts
```

- [ ] **Step 3: Fix imports in diagnosis files**

In `diagnosis-engine.ts`: imports are from `@wolfcola/devtools-types` (no change needed) and from local types (no change — diagnosis-engine.ts has no cross-directory imports in the original).

In `serialize-diagnosis.ts`: imports from `./diagnosis-engine.js` — already correct since both are in `diagnosis/`.

- [ ] **Step 4: Fix imports in export files**

In `markdown.ts`: imports from `@wolfcola/devtools-types` and `../background/diagnosis-engine.js`. Change to `import { ... } from '../diagnosis/diagnosis-engine.js'`.

In `redact.ts`: imports from `@wolfcola/devtools-types` only — no change needed.

- [ ] **Step 5: Update barrel export**

Add to `packages/devtools-core/src/index.ts`:

```ts
export {
  runDiagnosis,
  runFlowRules,
  runEventRules,
} from './diagnosis/diagnosis-engine.js';
export type {
  Severity,
  DiagnosisCategory,
  FlowIssue,
  EventIssue,
  DiagnosisResult,
} from './diagnosis/diagnosis-engine.js';
export {
  serializeDiagnosis,
} from './diagnosis/serialize-diagnosis.js';
export type {
  SerializableDiagnosisResult,
} from './diagnosis/serialize-diagnosis.js';
export { renderFlowMarkdown } from './export/markdown.js';
export { redactFlowState } from './export/redact.js';
```

- [ ] **Step 6: Run all devtools-core tests**

Run: `cd packages/devtools-core && pnpm test`
Expected: All tests pass (annotators + diagnosis + export)

- [ ] **Step 7: Commit**

```bash
git add packages/devtools-core/
git commit -m "feat(devtools-core): move diagnosis engine and export logic"
```

---

### Task 4: Move event store and message handler to `devtools-core`

**Files:**
- Create: `packages/devtools-core/src/event-store/event-store.service.ts`
- Create: `packages/devtools-core/src/event-store/event-store.service.test.ts`
- Create: `packages/devtools-core/src/message-handler/message-handler.ts`
- Create: `packages/devtools-core/src/message-handler/message-handler.test.ts`
- Modify: `packages/devtools-core/src/index.ts`

- [ ] **Step 1: Copy and adapt event-store.service.ts**

Copy from `packages/devtools-extension/src/background/event-store.service.ts`.

The key change: the original `EventStoreLive` layer uses `chrome.storage.local` for `persist()` and `rehydrate()`. In `devtools-core`, make these operations abstract — the consumer provides the storage backend.

Replace the `EventStoreLive` layer with an `EventStoreInMemory` layer that has no-op persist/rehydrate (the test layer pattern already used in `message-handler.test.ts`). The browser extension will provide its own layer with chrome.storage. The VS Code extension will provide its own with in-memory or VS Code globalState.

```ts
// packages/devtools-core/src/event-store/event-store.service.ts
import { Context, Effect, Layer, Ref, pipe } from 'effect';
import type { AuthEvent, FlowState } from '@wolfcola/devtools-types';
import type { OidcConfig } from '../annotators/oidc-discovery.js';

export interface ExtendedFlowState extends FlowState {
  oidcConfig: OidcConfig | null;
  lastOidcEventId: string | null;
}

export function makeEmptyFlowState(): ExtendedFlowState {
  return {
    flowId: null,
    capturedAt: new Date().toISOString(),
    events: [],
    summary: { nodeCount: 0, errorCount: 0, corsFlags: [], duration: 0, sdkConnected: false },
    lastSdkEventId: null,
    oidcConfig: null,
    lastOidcEventId: null,
  };
}

function updateSummary(state: ExtendedFlowState, event: AuthEvent): ExtendedFlowState {
  const summary = { ...state.summary };

  if (event.flags.isError) summary.errorCount += 1;
  if (event.type === 'sdk:node-change') {
    summary.nodeCount += 1;
    summary.sdkConnected = true;
  }
  if (event.flags.isCors && event.data._tag === 'network' && event.data.corsFlag) {
    summary.corsFlags = [...summary.corsFlags, event.data.corsFlag];
  }

  const timestamps = [...state.events, event].map((e) => e.timestamp);
  summary.duration = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

  return {
    ...state,
    flowId: state.flowId ?? event.flowId,
    events: [...state.events, event],
    summary,
    lastSdkEventId: event.type === 'sdk:node-change' ? event.id : state.lastSdkEventId,
  };
}

export interface EventStoreServiceShape {
  append: (event: AuthEvent) => Effect.Effect<void>;
  getState: () => Effect.Effect<ExtendedFlowState>;
  clear: () => Effect.Effect<void>;
  persist: () => Effect.Effect<void>;
  rehydrate: () => Effect.Effect<void>;
  setOidcConfig: (config: OidcConfig) => Effect.Effect<void>;
  setLastOidcEventId: (id: string) => Effect.Effect<void>;
}

export class EventStoreService extends Context.Tag('EventStoreService')<
  EventStoreService,
  EventStoreServiceShape
>() {}

/**
 * In-memory event store with no-op persist/rehydrate.
 * Use this for testing or environments without persistent storage.
 * For browser extension: wrap this and provide chrome.storage-backed persist/rehydrate.
 */
export const EventStoreInMemory = Layer.effect(
  EventStoreService,
  pipe(
    Ref.make<ExtendedFlowState>(makeEmptyFlowState()),
    Effect.map((stateRef) => ({
      append: (event: AuthEvent) => Ref.update(stateRef, (s) => updateSummary(s, event)),
      getState: () => Ref.get(stateRef),
      clear: () => Ref.set(stateRef, makeEmptyFlowState()),
      persist: () => Effect.void,
      rehydrate: () => Effect.void,
      setOidcConfig: (config: OidcConfig) =>
        Ref.update(stateRef, (s) => ({ ...s, oidcConfig: config })),
      setLastOidcEventId: (id: string) =>
        Ref.update(stateRef, (s) => ({ ...s, lastOidcEventId: id })),
    })),
  ),
);
```

- [ ] **Step 2: Copy and adapt event-store.service.test.ts**

Copy the test file. Update imports to use the local `./event-store.service.js`. Replace `EventStoreLive` with `EventStoreInMemory` in tests. The tests that called `persist()`/`rehydrate()` with chrome.storage mocks should be adapted — `persist()` and `rehydrate()` are now no-ops in the in-memory layer, so those tests verify the no-op behavior or are moved to the browser extension package.

- [ ] **Step 3: Copy and adapt message-handler.ts**

Copy from `packages/devtools-extension/src/background/message-handler.ts`. Fix imports:

```ts
// Change these imports:
// import { buildNetworkEvent } from '../devtools/network-observer.js';
// import { annotateOidc } from '../devtools/oidc-annotator.js';
// import { detectDpop } from '../devtools/dpop-detector.js';
// import { detectPar } from '../devtools/par-detector.js';
// import { parseWellKnownResponse, isWellKnownUrl } from '../devtools/oidc-discovery.js';
// import { EventStoreService } from './event-store.service.js';

// To:
import { buildNetworkEvent } from '../annotators/network-observer.js';
import { EventStoreService } from '../event-store/event-store.service.js';
import { AuthEventSchema } from '@wolfcola/devtools-types';
import type { AuthEvent, OidcSemantics } from '@wolfcola/devtools-types';
import type { HarEntry } from '../annotators/network-observer.js';
import { annotateOidc } from '../annotators/oidc-annotator.js';
import { detectDpop } from '../annotators/dpop-detector.js';
import { detectPar } from '../annotators/par-detector.js';
import { parseWellKnownResponse, isWellKnownUrl } from '../annotators/oidc-discovery.js';
```

The rest of the file is unchanged — it's all Effect code with no browser dependencies.

- [ ] **Step 4: Copy and adapt message-handler.test.ts**

Copy the test. Fix imports. The test already uses a `TestStoreLive` layer (no chrome.storage), so it works as-is after import path fixes.

Update import paths:
```ts
import { handleMessage } from './message-handler.js';
import { EventStoreService, makeEmptyFlowState } from '../event-store/event-store.service.js';
import type { ExtendedFlowState } from '../event-store/event-store.service.js';
import type { OidcConfig } from '../annotators/oidc-discovery.js';
```

- [ ] **Step 5: Update barrel export**

Add to `packages/devtools-core/src/index.ts`:

```ts
export {
  EventStoreService,
  EventStoreInMemory,
  makeEmptyFlowState,
  updateSummary,
} from './event-store/event-store.service.js';
export type {
  ExtendedFlowState,
  EventStoreServiceShape,
} from './event-store/event-store.service.js';
export { handleMessage } from './message-handler/message-handler.js';
```

Note: `updateSummary` is exported because the browser extension's `EventStoreChromeLive` layer (Task 5) needs it to avoid code duplication.

- [ ] **Step 6: Run all devtools-core tests**

Run: `cd packages/devtools-core && pnpm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/devtools-core/
git commit -m "feat(devtools-core): move event store and message handler"
```

---

### Task 5: Rewire `devtools-extension` to use `devtools-core`

**Files:**
- Modify: `packages/devtools-extension/package.json`
- Modify: `packages/devtools-extension/src/background/service-worker.ts`
- Create: `packages/devtools-extension/src/background/event-store-chrome.ts` (chrome.storage Layer)
- Modify: `packages/devtools-extension/src/panel/panel.ts`
- Delete: all moved source files from devtools-extension
- Modify: `packages/devtools-extension/src/devtools/devtools.ts`

- [ ] **Step 1: Add devtools-core dependency**

In `packages/devtools-extension/package.json`, add to `dependencies`:
```json
"@wolfcola/devtools-core": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: Create chrome.storage-backed EventStore layer**

Create `packages/devtools-extension/src/background/event-store-chrome.ts`.

The approach: `devtools-core` exports `EventStoreInMemory` which handles all the core logic (append with `updateSummary`, getState, clear, setOidcConfig, setLastOidcEventId) but has no-op `persist`/`rehydrate`. For the browser extension, we need a layer that adds `chrome.storage.local` persistence. We do this by re-implementing the full layer (since Effect layers are atomic), importing `makeEmptyFlowState` and reusing the same `updateSummary` logic.

To avoid duplicating `updateSummary`, export it from `devtools-core`. In `packages/devtools-core/src/event-store/event-store.service.ts`, make sure `updateSummary` is exported:

```ts
// Add 'export' to the existing function declaration:
export function updateSummary(state: ExtendedFlowState, event: AuthEvent): ExtendedFlowState {
```

And add it to the barrel in `packages/devtools-core/src/index.ts`:

```ts
export {
  EventStoreService,
  EventStoreInMemory,
  makeEmptyFlowState,
  updateSummary,
} from './event-store/event-store.service.js';
```

Then create the chrome layer:

```ts
import { Effect, Layer, Ref, pipe } from 'effect';
import {
  EventStoreService,
  makeEmptyFlowState,
  updateSummary,
} from '@wolfcola/devtools-core';
import type { ExtendedFlowState } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';
import type { OidcConfig } from '@wolfcola/devtools-core';

export const EventStoreChromeLive = Layer.effect(
  EventStoreService,
  pipe(
    Ref.make<ExtendedFlowState>(makeEmptyFlowState()),
    Effect.map((stateRef) => ({
      append: (event: AuthEvent) => Ref.update(stateRef, (s) => updateSummary(s, event)),
      getState: () => Ref.get(stateRef),
      clear: () => Ref.set(stateRef, makeEmptyFlowState()),
      persist: () =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) =>
            Effect.tryPromise(() => chrome.storage.local.set({ 'ping:auth-flow': state })),
          ),
          Effect.orDie,
        ),
      rehydrate: () =>
        pipe(
          Effect.tryPromise(() => chrome.storage.local.get('ping:auth-flow')),
          Effect.orDie,
          Effect.flatMap((result) => {
            const stored = result['ping:auth-flow'] as ExtendedFlowState | undefined;
            return stored ? Ref.set(stateRef, stored) : Effect.void;
          }),
        ),
      setOidcConfig: (config: OidcConfig) =>
        Ref.update(stateRef, (s) => ({ ...s, oidcConfig: config })),
      setLastOidcEventId: (id: string) =>
        Ref.update(stateRef, (s) => ({ ...s, lastOidcEventId: id })),
    })),
  ),
);
```

- [ ] **Step 3: Update service-worker.ts to use devtools-core**

Replace `packages/devtools-extension/src/background/service-worker.ts`:

```ts
import { ManagedRuntime, Effect } from 'effect';
import { EventStoreChromeLive } from './event-store-chrome.js';
import { EventStoreService, handleMessage, runDiagnosis, serializeDiagnosis } from '@wolfcola/devtools-core';
import type { SerializableDiagnosisResult } from '@wolfcola/devtools-core';

const AppLayer = EventStoreChromeLive;
let runtime = ManagedRuntime.make(AppLayer);

self.addEventListener('activate', () => {
  runtime = ManagedRuntime.make(AppLayer);
  runtime
    .runPromise(
      Effect.gen(function* () {
        const store = yield* EventStoreService;
        yield* store.rehydrate();
      }),
    )
    .catch(console.error);
});

function broadcastToPanel(event: unknown, diagnosis: SerializableDiagnosisResult): void {
  chrome.runtime.sendMessage({ type: 'PANEL_EVENT', payload: event, diagnosis }).catch(() => {
    // Panel not open — ignore
  });
}

function runDiagnosisEffect() {
  return Effect.gen(function* () {
    const store = yield* EventStoreService;
    const state = yield* store.getState();
    return runDiagnosis(state.events);
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'devtools') return;
  port.onMessage.addListener((message) => {
    runtime
      .runPromise(
        Effect.gen(function* () {
          const result = yield* handleMessage(message);
          if (
            (message.type === 'NETWORK_EVENT' || message.type === 'SDK_EVENT') &&
            result !== null
          ) {
            const diagnosis = yield* runDiagnosisEffect();
            broadcastToPanel(result, serializeDiagnosis(diagnosis));
          }
          return result;
        }),
      )
      .catch(console.error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  runtime
    .runPromise(
      Effect.gen(function* () {
        const result = yield* handleMessage(message);
        if ((message.type === 'NETWORK_EVENT' || message.type === 'SDK_EVENT') && result !== null) {
          const diagnosis = yield* runDiagnosisEffect();
          broadcastToPanel(result, serializeDiagnosis(diagnosis));
        }
        return result;
      }),
    )
    .then(sendResponse)
    .catch(console.error);
  return true;
});
```

- [ ] **Step 4: Update panel.ts imports**

In `packages/devtools-extension/src/panel/panel.ts`, change:
```ts
// Old:
import { redactFlowState } from '../export/redact.js';
import { renderFlowMarkdown } from '../export/markdown.js';
import { runDiagnosis } from '../background/diagnosis-engine.js';

// New:
import { redactFlowState, renderFlowMarkdown, runDiagnosis } from '@wolfcola/devtools-core';
```

- [ ] **Step 5: Update devtools.ts imports**

In `packages/devtools-extension/src/devtools/devtools.ts`, check for any imports from moved files. The `devtools.ts` file imports `isAuthRelated` inline — but actually looking at the source, `devtools.ts` calls `chrome.devtools.network.onRequestFinished` and sends raw HAR entries over the port. It does NOT import annotators directly. So no import changes needed for `devtools.ts`.

However, `devtools.ts` must stay in `devtools-extension` since it uses `chrome.devtools.panels` and `chrome.devtools.network`.

- [ ] **Step 6: Delete moved files from devtools-extension**

Delete these files (they now live in devtools-core):
```
packages/devtools-extension/src/background/diagnosis-engine.ts
packages/devtools-extension/src/background/diagnosis-engine.test.ts
packages/devtools-extension/src/background/event-store.service.ts
packages/devtools-extension/src/background/event-store.service.test.ts
packages/devtools-extension/src/background/message-handler.ts
packages/devtools-extension/src/background/message-handler.test.ts
packages/devtools-extension/src/background/serialize-diagnosis.ts
packages/devtools-extension/src/background/serialize-diagnosis.test.ts
packages/devtools-extension/src/devtools/cors-detector.ts
packages/devtools-extension/src/devtools/cors-detector.test.ts
packages/devtools-extension/src/devtools/dpop-detector.ts
packages/devtools-extension/src/devtools/dpop-detector.test.ts
packages/devtools-extension/src/devtools/par-detector.ts
packages/devtools-extension/src/devtools/par-detector.test.ts
packages/devtools-extension/src/devtools/oidc-annotator.ts
packages/devtools-extension/src/devtools/oidc-annotator.test.ts
packages/devtools-extension/src/devtools/oidc-discovery.ts
packages/devtools-extension/src/devtools/oidc-discovery.test.ts
packages/devtools-extension/src/devtools/oidc-flow-tracker.ts
packages/devtools-extension/src/devtools/oidc-flow-tracker.test.ts
packages/devtools-extension/src/devtools/oidc-integration.test.ts
packages/devtools-extension/src/devtools/network-observer.ts
packages/devtools-extension/src/devtools/network-observer.test.ts
packages/devtools-extension/src/export/markdown.ts
packages/devtools-extension/src/export/markdown.test.ts
packages/devtools-extension/src/export/redact.ts
packages/devtools-extension/src/export/redact.test.ts
packages/devtools-extension/src/shared/jwt-utils.ts
```

Keep `packages/devtools-extension/src/panel/jwt.ts` and its test (used by Elm-side JWT rendering, referenced in panel.ts comments — verify if actually imported anywhere first).

- [ ] **Step 7: Update devtools-extension tsconfig.lib.json**

Add project reference to devtools-core:

```json
"references": [
  { "path": "../devtools-types/tsconfig.lib.json" },
  { "path": "../devtools-core/tsconfig.lib.json" }
]
```

- [ ] **Step 8: Run devtools-core tests**

Run: `cd packages/devtools-core && pnpm test`
Expected: All tests pass

- [ ] **Step 9: Run devtools-extension tests**

Run: `cd packages/devtools-extension && pnpm test`
Expected: Remaining tests pass (content-script.test.ts, panel jwt.test.ts)

- [ ] **Step 10: Build devtools-extension**

Run: `cd packages/devtools-extension && pnpm build`
Expected: Build succeeds

- [ ] **Step 11: Run full workspace typecheck**

Run: `pnpm typecheck`
Expected: Clean build

- [ ] **Step 12: Run e2e tests**

Run: `cd e2e && pnpm test`
Expected: All e2e tests pass (extension loads, network capture works, panel renders)

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor: rewire devtools-extension to use devtools-core

Move annotators, diagnosis engine, event store, message handler, and
export logic to @wolfcola/devtools-core. Browser extension now imports
shared logic and provides chrome.storage-backed EventStore layer."
```

---

## Phase 2: Extract `devtools-ui`

### Task 6: Scaffold `devtools-ui` package and move Elm source

**Files:**
- Create: `packages/devtools-ui/package.json`
- Create: `packages/devtools-ui/elm.json`
- Create: `packages/devtools-ui/build.mjs`
- Create: `packages/devtools-ui/src/ports.ts`
- Move: Elm source files
- Move: CSS from panel.html
- Modify: `packages/devtools-extension/build.mjs`
- Modify: `packages/devtools-extension/src/panel/panel.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@wolfcola/devtools-ui",
  "version": "0.0.0",
  "private": true,
  "description": "Shared Elm UI for WolfCola DevTools — Timeline, Flow, and Learn views",
  "license": "MIT",
  "type": "module",
  "exports": {
    "./elm.js": "./dist/elm.js",
    "./panel.css": "./dist/panel.css",
    "./panel.html": "./dist/panel.html",
    "./ports": {
      "types": "./src/ports.d.ts",
      "import": "./src/ports.js",
      "default": "./src/ports.js"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "node build.mjs"
  },
  "devDependencies": {
    "elm-tooling": "^1.15.1",
    "terser": "^5.47.1"
  }
}
```

- [ ] **Step 2: Move elm.json**

Copy `packages/devtools-extension/elm.json` to `packages/devtools-ui/elm.json`.

Update `source-directories` to match the new layout:

```json
{
  "type": "application",
  "source-directories": ["src", "src/src"],
  "elm-version": "0.19.1",
  "dependencies": {
    "direct": {
      "NoRedInk/elm-json-decode-pipeline": "1.0.1",
      "elm/browser": "1.0.2",
      "elm/core": "1.0.5",
      "elm/html": "1.0.1",
      "elm/json": "1.1.4",
      "elm/svg": "1.0.1",
      "elm/time": "1.0.0"
    },
    "indirect": {
      "elm/url": "1.0.0",
      "elm/virtual-dom": "1.0.5"
    }
  },
  "test-dependencies": {
    "direct": {
      "elm-explorations/test": "2.2.1"
    },
    "indirect": {
      "elm/bytes": "1.0.8",
      "elm/random": "1.0.0"
    }
  }
}
```

- [ ] **Step 3: Move Elm source files**

```
packages/devtools-extension/src/panel/Main.elm    → packages/devtools-ui/src/Main.elm
packages/devtools-extension/src/panel/src/*.elm    → packages/devtools-ui/src/src/*.elm
```

All 13 Elm files:
```
Main.elm, Model.elm, View.elm, Update.elm, Types.elm,
Timeline.elm, FlowView.elm, LearnView.elm, Inspector.elm,
Graph.elm, Decode.elm, Helpers.elm, JsonTree.elm
```

- [ ] **Step 4: Extract CSS from panel.html to panel.css**

Extract everything between `<style>` and `</style>` in `packages/devtools-extension/src/panel/panel.html` into `packages/devtools-ui/src/panel.css`.

- [ ] **Step 5: Create simplified panel.html**

Create `packages/devtools-ui/src/panel.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="panel.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="elm.js"></script>
    <script src="panel.js" type="module"></script>
  </body>
</html>
```

- [ ] **Step 6: Create ports.ts — the TypeScript port interface**

```ts
// packages/devtools-ui/src/ports.ts

export interface ElmPorts {
  receiveEvent: { send: (event: unknown) => void };
  receiveDiagnosis: { send: (diagnosis: unknown) => void };
  receiveImportMeta: { send: (meta: unknown) => void };
  receiveImportError: { send: (error: unknown) => void };
  receiveSnapshots: { send: (snapshots: unknown[]) => void };
  exportJson: { subscribe: (cb: () => void) => void };
  exportMarkdown: { subscribe: (cb: () => void) => void };
  submitImportPaste: { subscribe: (cb: (text: string) => void) => void };
  clearFlow: { subscribe: (cb: () => void) => void };
  saveSnapshot: { subscribe: (cb: () => void) => void };
  requestSnapshots: { subscribe: (cb: () => void) => void };
  loadSnapshot: { subscribe: (cb: (id: string) => void) => void };
  deleteSnapshot: { subscribe: (cb: (id: string) => void) => void };
  copyToClipboard: { subscribe: (cb: (text: string) => void) => void };
}

export interface ElmApp {
  ports: ElmPorts;
}

export interface ElmModule {
  Main: {
    init: (opts: { node: HTMLElement | null; flags: null }) => ElmApp;
  };
}
```

- [ ] **Step 7: Create build.mjs**

```js
// packages/devtools-ui/build.mjs
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';

const cwd = import.meta.dirname;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd });
const npx = (args) => run('npx', args);

mkdirSync('dist', { recursive: true });

// Elm — compile and minify
npx(['elm', 'make', 'src/Main.elm', '--output=dist/elm.js', '--optimize']);

npx([
  'terser',
  'dist/elm.js',
  '--compress',
  'pure_funcs=["F2","F3","F4","F5","F6","F7","F8","F9",' +
    '"A2","A3","A4","A5","A6","A7","A8","A9"],' +
    'pure_getters,keep_fargs=false,unsafe_comps,unsafe',
  '--mangle',
  '--output',
  'dist/elm.js',
]);

// Copy CSS and HTML
cpSync('src/panel.css', 'dist/panel.css');
cpSync('src/panel.html', 'dist/panel.html');

console.log('devtools-ui build complete.');
```

- [ ] **Step 8: Install elm-tooling in devtools-ui**

Add a `postinstall` script to `packages/devtools-ui/package.json`:
```json
"postinstall": "elm-tooling install"
```

Run: `pnpm install`

- [ ] **Step 9: Build devtools-ui**

Run: `cd packages/devtools-ui && pnpm build`
Expected: `dist/elm.js`, `dist/panel.css`, `dist/panel.html` created

- [ ] **Step 10: Commit**

```bash
git add packages/devtools-ui/
git commit -m "feat(devtools-ui): scaffold package and move Elm source + CSS"
```

---

### Task 7: Rewire `devtools-extension` to consume `devtools-ui`

**Files:**
- Modify: `packages/devtools-extension/package.json`
- Modify: `packages/devtools-extension/build.mjs`
- Modify: `packages/devtools-extension/src/panel/panel.ts`
- Delete: `packages/devtools-extension/elm.json`
- Delete: `packages/devtools-extension/src/panel/Main.elm`
- Delete: `packages/devtools-extension/src/panel/src/`
- Modify: `packages/devtools-extension/src/panel/panel.html`

- [ ] **Step 1: Add devtools-ui dependency**

In `packages/devtools-extension/package.json`, add to `dependencies`:
```json
"@wolfcola/devtools-ui": "workspace:*"
```

Remove `elm-tooling` and `terser` from devDependencies (now in devtools-ui). Remove the `postinstall` script.

Run: `pnpm install`

- [ ] **Step 2: Update build.mjs — stop compiling Elm, copy from devtools-ui**

Replace `packages/devtools-extension/build.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const target = process.argv.includes('--target=firefox') ? 'firefox' : 'chrome';
const cwd = import.meta.dirname;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd });
const npx = (args) => run('npx', args);

console.log(`Building for ${target}...`);

mkdirSync('dist/panel', { recursive: true });
mkdirSync('dist/background', { recursive: true });
mkdirSync('dist/content', { recursive: true });

// TypeScript entry points via esbuild
const esbuildEntries = [
  {
    input: 'src/devtools/devtools.ts',
    output: 'dist/devtools.js',
    format: 'esm',
  },
  {
    input: 'src/panel/panel.ts',
    output: 'dist/panel/panel.js',
    format: 'esm',
  },
  {
    input: 'src/background/service-worker.ts',
    output: 'dist/background/service-worker.js',
    format: 'esm',
    footer: 'export {}',
  },
  {
    input: 'src/content/content-script.ts',
    output: 'dist/content/content-script.js',
    format: 'iife',
  },
  {
    input: 'src/content/relay.ts',
    output: 'dist/content/relay.js',
    format: 'iife',
  },
];

for (const entry of esbuildEntries) {
  const args = [
    'esbuild',
    entry.input,
    '--bundle',
    '--minify',
    `--outfile=${entry.output}`,
    `--format=${entry.format}`,
    '--platform=browser',
  ];
  if (entry.footer) args.push(`--footer:js=${entry.footer}`);
  npx(args);
}

// Copy Elm + CSS from devtools-ui dist
const require = createRequire(import.meta.url);
const uiPkg = require.resolve('@wolfcola/devtools-ui/package.json');
const uiDir = uiPkg.replace('/package.json', '');
cpSync(`${uiDir}/dist/elm.js`, 'dist/panel/elm.js');
cpSync(`${uiDir}/dist/panel.css`, 'dist/panel/panel.css');
cpSync(`${uiDir}/dist/panel.html`, 'dist/panel/panel.html');

// Manifest — swap background field per target
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
if (target === 'firefox') {
  manifest.background = { scripts: ['background/service-worker.js'], type: 'module' };
  manifest.browser_specific_settings = {
    gecko: {
      id: 'oidc-devtool@wolfcola',
      data_collection_permissions: { required: ['none'] },
    },
  };
}
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
cpSync('icons', 'dist/icons', { recursive: true });
cpSync('src/devtools/devtools.html', 'dist/devtools.html');

console.log('Build complete.');
```

- [ ] **Step 3: Update panel.ts — use ElmPorts type from devtools-ui**

In `packages/devtools-extension/src/panel/panel.ts`, replace the inline `declare const Elm` block with:

```ts
import type { ElmModule } from '@wolfcola/devtools-ui/ports';

declare const Elm: ElmModule;
```

The rest of panel.ts stays the same — it still wires Elm ports to chrome.runtime messaging.

- [ ] **Step 4: Delete moved Elm files from devtools-extension**

```
packages/devtools-extension/elm.json
packages/devtools-extension/src/panel/Main.elm
packages/devtools-extension/src/panel/src/  (entire directory)
```

- [ ] **Step 5: Update panel.html to use external CSS**

Replace `packages/devtools-extension/src/panel/panel.html` with a redirect to the devtools-ui version. Actually, since `build.mjs` now copies `panel.html` from devtools-ui, we can just delete the old panel.html.

Delete: `packages/devtools-extension/src/panel/panel.html`

- [ ] **Step 6: Build the full workspace**

Run: `pnpm build`
Expected: devtools-types builds → devtools-core builds → devtools-ui builds → devtools-extension builds

Note: You may need to ensure build order. Since devtools-extension depends on both devtools-core and devtools-ui, pnpm should handle the order via workspace deps. Verify by checking `pnpm -r run build` runs in the right order.

- [ ] **Step 7: Run devtools-extension tests**

Run: `cd packages/devtools-extension && pnpm test`
Expected: Remaining tests pass

- [ ] **Step 8: Run full workspace typecheck**

Run: `pnpm typecheck`
Expected: Clean

- [ ] **Step 9: Run e2e tests**

Run: `cd e2e && pnpm test`
Expected: All e2e tests pass — the browser extension works identically

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: rewire devtools-extension to consume devtools-ui

Browser extension now imports compiled Elm and CSS from
@wolfcola/devtools-ui instead of compiling Elm in-tree.
Elm source, elm.json, and panel CSS extracted to devtools-ui."
```

---

## Phase 3: VS Code Extension Scaffold

### Task 8: Scaffold `vscode-extension` package

**Files:**
- Create: `packages/vscode-extension/package.json`
- Create: `packages/vscode-extension/tsconfig.json`
- Create: `packages/vscode-extension/tsconfig.lib.json`
- Create: `packages/vscode-extension/tsconfig.spec.json`
- Create: `packages/vscode-extension/vite.config.ts`
- Create: `packages/vscode-extension/.vscodeignore`
- Create: `packages/vscode-extension/esbuild.mjs`
- Create: `packages/vscode-extension/src/extension.ts`

- [ ] **Step 1: Create package.json (VS Code extension manifest)**

```json
{
  "name": "oidc-devtools",
  "displayName": "OIDC DevTools",
  "description": "Live OIDC/OAuth2 debugging — network capture, SDK event correlation, and flow diagnosis",
  "version": "0.0.0",
  "publisher": "wolfcola",
  "license": "MIT",
  "private": true,
  "type": "module",
  "engines": {
    "vscode": "^1.100.0"
  },
  "categories": ["Debuggers", "Other"],
  "activationEvents": [
    "onCommand:oidc-devtools.startCapture",
    "onDebugResolve:oidc-devtools"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "oidc-devtools.startCapture",
        "title": "OIDC DevTools: Start Capture"
      },
      {
        "command": "oidc-devtools.stopCapture",
        "title": "OIDC DevTools: Stop Capture"
      },
      {
        "command": "oidc-devtools.clearEvents",
        "title": "OIDC DevTools: Clear Events"
      },
      {
        "command": "oidc-devtools.exportFlow",
        "title": "OIDC DevTools: Export Flow"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "oidc-devtools",
          "title": "OIDC DevTools",
          "icon": "$(shield)"
        }
      ]
    },
    "views": {
      "oidc-devtools": [
        {
          "id": "oidc-devtools.timeline",
          "name": "Timeline"
        }
      ]
    }
  },
  "scripts": {
    "build": "node esbuild.mjs",
    "watch": "node esbuild.mjs --watch",
    "lint": "eslint .",
    "test": "vitest run",
    "package": "vsce package"
  },
  "dependencies": {
    "@wolfcola/devtools-core": "workspace:*",
    "@wolfcola/devtools-types": "workspace:*",
    "effect": "catalog:effect"
  },
  "devDependencies": {
    "@types/vscode": "^1.100.0",
    "esbuild": "^0.28.0"
  }
}
```

- [ ] **Step 2: Create tsconfig files**

`packages/vscode-extension/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

`packages/vscode-extension/tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "nodenext",
    "module": "NodeNext",
    "target": "ES2022",
    "outDir": "./dist",
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "strict": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "lib": ["es2022"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts"],
  "references": [
    { "path": "../devtools-types/tsconfig.lib.json" },
    { "path": "../devtools-core/tsconfig.lib.json" }
  ]
}
```

`packages/vscode-extension/tsconfig.spec.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc/vitest",
    "types": [
      "vitest/globals",
      "vitest/importMeta",
      "vite/client",
      "node",
      "vitest"
    ],
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noImplicitOverride": true,
    "lib": ["es2022"]
  },
  "include": ["vite.config.ts", "src/**/*.test.ts", "src/**/*.spec.ts"],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create .vscodeignore**

```
.vscode/**
src/**
node_modules/**
tsconfig*.json
vite.config.ts
esbuild.mjs
**/*.test.ts
```

- [ ] **Step 5: Create esbuild.mjs**

```js
import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  minify: !watch,
};

if (watch) {
  const ctx = await (await import('esbuild')).context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(options);
  console.log('Build complete.');
}
```

- [ ] **Step 6: Create minimal extension.ts**

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const startCmd = vscode.commands.registerCommand('oidc-devtools.startCapture', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Starting capture...');
  });

  const stopCmd = vscode.commands.registerCommand('oidc-devtools.stopCapture', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Stopping capture...');
  });

  const clearCmd = vscode.commands.registerCommand('oidc-devtools.clearEvents', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Events cleared.');
  });

  const exportCmd = vscode.commands.registerCommand('oidc-devtools.exportFlow', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Exporting flow...');
  });

  context.subscriptions.push(startCmd, stopCmd, clearCmd, exportCmd);
}

export function deactivate(): void {
  // cleanup
}
```

- [ ] **Step 7: Install dependencies and build**

Run: `pnpm install && cd packages/vscode-extension && pnpm build`
Expected: `dist/extension.js` created

- [ ] **Step 8: Commit**

```bash
git add packages/vscode-extension/
git commit -m "feat(vscode): scaffold VS Code extension package with commands"
```

---

### Task 9: CDP client — network capture

**Files:**
- Create: `packages/vscode-extension/src/cdp/target-discovery.ts`
- Create: `packages/vscode-extension/src/cdp/cdp-client.ts`
- Create: `packages/vscode-extension/src/cdp/cdp-client.test.ts`

- [ ] **Step 1: Write failing test for CDP target discovery**

```ts
// packages/vscode-extension/src/cdp/cdp-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CdpClient } from './cdp-client.js';

describe('CdpClient', () => {
  it('constructs with websocket URL', () => {
    const client = new CdpClient('ws://localhost:9222/devtools/page/ABC');
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vscode-extension && pnpm test`
Expected: FAIL — `CdpClient` not found

- [ ] **Step 3: Implement target-discovery.ts**

```ts
// packages/vscode-extension/src/cdp/target-discovery.ts
import http from 'node:http';

export interface CdpTarget {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl: string;
}

export function discoverTargets(port: number): Promise<CdpTarget[]> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/json`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as CdpTarget[]);
        } catch {
          reject(new Error('Failed to parse CDP targets'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout connecting to CDP on port ${port}`));
    });
  });
}

export function findPageTarget(targets: CdpTarget[], url?: string): CdpTarget | undefined {
  const pages = targets.filter((t) => t.type === 'page');
  if (url) {
    return pages.find((t) => t.url.startsWith(url)) ?? pages[0];
  }
  return pages[0];
}
```

- [ ] **Step 4: Implement cdp-client.ts**

```ts
// packages/vscode-extension/src/cdp/cdp-client.ts
import { WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

interface CdpResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface CdpEvent {
  method: string;
  params: Record<string, unknown>;
}

type CdpMessage = CdpResponse | CdpEvent;

export class CdpClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private requestMap = new Map<string, {
    url: string;
    method: string;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    timestamp: number;
  }>();

  constructor(private wsUrl: string) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => {
        this.enableDomains().then(resolve).catch(reject);
      });
      this.ws.on('message', (data) => this.handleMessage(JSON.parse(data.toString())));
      this.ws.on('close', () => this.emit('disconnected'));
      this.ws.on('error', reject);
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.pending.clear();
    this.requestMap.clear();
  }

  private async enableDomains(): Promise<void> {
    await this.send('Network.enable', {});
    await this.send('Page.enable', {});
    await this.send('Runtime.enable', {});
  }

  async send(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('Not connected'));
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  private handleMessage(msg: CdpMessage): void {
    if ('id' in msg) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    switch (msg.method) {
      case 'Network.requestWillBeSent':
        this.onRequestWillBeSent(msg.params);
        break;
      case 'Network.responseReceived':
        this.onResponseReceived(msg.params);
        break;
      case 'Network.loadingFinished':
        this.onLoadingFinished(msg.params);
        break;
      case 'Runtime.bindingCalled':
        this.onBindingCalled(msg.params);
        break;
    }
  }

  private onRequestWillBeSent(params: Record<string, unknown>): void {
    const requestId = params.requestId as string;
    const request = params.request as { url: string; method: string; headers: Record<string, string>; postData?: string };
    this.requestMap.set(requestId, {
      url: request.url,
      method: request.method,
      requestHeaders: request.headers,
      requestBody: request.postData,
      timestamp: Date.now(),
    });
  }

  private onResponseReceived(params: Record<string, unknown>): void {
    const requestId = params.requestId as string;
    const response = params.response as { status: number; headers: Record<string, string> };
    const stored = this.requestMap.get(requestId);
    if (!stored) return;

    // Store response info alongside the request for when loading finishes
    this.requestMap.set(requestId, {
      ...stored,
      ...({ responseStatus: response.status, responseHeaders: response.headers } as Record<string, unknown>),
    } as typeof stored & { responseStatus: number; responseHeaders: Record<string, string> });
  }

  private async onLoadingFinished(params: Record<string, unknown>): Promise<void> {
    const requestId = params.requestId as string;
    const stored = this.requestMap.get(requestId) as (typeof this.requestMap extends Map<string, infer V> ? V : never) & {
      responseStatus?: number;
      responseHeaders?: Record<string, string>;
    } | undefined;
    if (!stored) return;

    // Fetch response body
    let responseBody: string | undefined;
    try {
      const result = await this.send('Network.getResponseBody', { requestId }) as { body: string };
      responseBody = result.body;
    } catch {
      // Some responses have no body
    }

    // Convert to HarEntry-like shape
    const harEntry: HarEntry = {
      request: {
        url: stored.url,
        method: stored.method,
        headers: this.toHarHeaders(stored.requestHeaders),
        ...(stored.requestBody ? { postData: { text: stored.requestBody } } : {}),
      },
      response: {
        status: stored.responseStatus ?? 0,
        headers: this.toHarHeaders(stored.responseHeaders ?? {}),
        content: { text: responseBody ?? '' },
      },
      time: Date.now() - stored.timestamp,
    };

    this.requestMap.delete(requestId);
    this.emit('harEntry', harEntry);
  }

  private onBindingCalled(params: Record<string, unknown>): void {
    if (params.name === '__wolfcolaBridge') {
      try {
        const payload = JSON.parse(params.payload as string);
        this.emit('sdkEvent', payload);
      } catch {
        // malformed SDK event — ignore
      }
    }
  }

  private toHarHeaders(headers: Record<string, string>): HarHeader[] {
    return Object.entries(headers).map(([name, value]) => ({ name, value }));
  }
}
```

- [ ] **Step 5: Add `ws` dependency**

In `packages/vscode-extension/package.json`, add to `dependencies`:
```json
"ws": "^8.18.0"
```
And to devDependencies:
```json
"@types/ws": "^8.18.0"
```

Run: `pnpm install`

- [ ] **Step 6: Run tests**

Run: `cd packages/vscode-extension && pnpm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/vscode-extension/
git commit -m "feat(vscode): add CDP client with network capture and target discovery"
```

---

### Task 10: SDK event injection via CDP

**Files:**
- Create: `packages/vscode-extension/src/cdp/sdk-injector.ts`
- Create: `packages/vscode-extension/src/cdp/sdk-injector.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/vscode-extension/src/cdp/sdk-injector.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getSdkInjectionScript, SDK_BINDING_NAME } from './sdk-injector.js';

describe('SDK Injector', () => {
  it('exports the binding name', () => {
    expect(SDK_BINDING_NAME).toBe('__wolfcolaBridge');
  });

  it('returns injection script as string', () => {
    const script = getSdkInjectionScript();
    expect(script).toContain('__pingDevtools');
    expect(script).toContain('__wolfcolaBridge');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vscode-extension && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement sdk-injector.ts**

```ts
// packages/vscode-extension/src/cdp/sdk-injector.ts
import type { CdpClient } from './cdp-client.js';

export const SDK_BINDING_NAME = '__wolfcolaBridge';

export function getSdkInjectionScript(): string {
  return `
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === '__pingDevtools') {
        ${SDK_BINDING_NAME}(JSON.stringify(e.data));
      }
    });
  `;
}

export async function injectSdkCapture(cdp: CdpClient): Promise<void> {
  // Register the binding so Runtime.bindingCalled fires when the script calls it
  await cdp.send('Runtime.addBinding', { name: SDK_BINDING_NAME });

  // Inject the capture script — persists across navigations
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: getSdkInjectionScript(),
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/vscode-extension && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/vscode-extension/src/cdp/sdk-injector.ts packages/vscode-extension/src/cdp/sdk-injector.test.ts
git commit -m "feat(vscode): add SDK event injection via CDP"
```

---

### Task 11: Timeline TreeView provider

**Files:**
- Create: `packages/vscode-extension/src/providers/timeline-item.ts`
- Create: `packages/vscode-extension/src/providers/timeline-tree.ts`
- Create: `packages/vscode-extension/src/providers/timeline-tree.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/vscode-extension/src/providers/timeline-tree.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({
  TreeItem: class {
    label: string;
    constructor(label: string) { this.label = label; }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
  },
  ThemeIcon: class {
    constructor(public id: string) {}
  },
}));

import { TimelineTreeProvider } from './timeline-tree.js';
import type { AuthEvent } from '@wolfcola/devtools-types';

const makeNetworkEvent = (overrides: Partial<AuthEvent> = {}): AuthEvent => ({
  id: 'e1',
  timestamp: Date.now(),
  type: 'network:response',
  source: 'network',
  flowId: null,
  causedBy: null,
  data: {
    _tag: 'network',
    url: 'https://auth.example.com/authorize',
    method: 'GET',
    status: 200,
    requestHeaders: {},
    responseHeaders: {},
    duration: 120,
  },
  flags: { isCors: false, isError: false, isAuthRelated: true },
  ...overrides,
});

describe('TimelineTreeProvider', () => {
  it('starts with no events', () => {
    const provider = new TimelineTreeProvider();
    const children = provider.getChildren();
    expect(children).toHaveLength(0);
  });

  it('adds events and refreshes', () => {
    const provider = new TimelineTreeProvider();
    provider.addEvent(makeNetworkEvent());
    const children = provider.getChildren();
    expect(children).toHaveLength(1);
  });

  it('clears events', () => {
    const provider = new TimelineTreeProvider();
    provider.addEvent(makeNetworkEvent());
    provider.clear();
    expect(provider.getChildren()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vscode-extension && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement timeline-item.ts**

```ts
// packages/vscode-extension/src/providers/timeline-item.ts
import * as vscode from 'vscode';
import type { AuthEvent } from '@wolfcola/devtools-types';

export class TimelineItem extends vscode.TreeItem {
  constructor(public readonly event: AuthEvent) {
    const label = TimelineItem.buildLabel(event);
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = TimelineItem.buildDescription(event);
    this.iconPath = TimelineItem.getIcon(event);
    this.tooltip = TimelineItem.buildTooltip(event);
    this.contextValue = event.data._tag;

    this.command = {
      command: 'oidc-devtools.selectEvent',
      title: 'Select Event',
      arguments: [event],
    };
  }

  private static buildLabel(event: AuthEvent): string {
    if (event.data._tag === 'network') {
      const path = new URL(event.data.url).pathname;
      return `${event.data.status} ${event.data.method} ${path}`;
    }
    if (event.data._tag === 'sdk') {
      return event.type.replace('sdk:', '');
    }
    return event.type;
  }

  private static buildDescription(event: AuthEvent): string {
    const parts: string[] = [];
    if (event.data._tag === 'network' && event.data.duration) {
      parts.push(`${event.data.duration}ms`);
    }
    if (event.flags.isCors) parts.push('CORS');
    if (event.oidcSemantics) parts.push(event.oidcSemantics.oidcPhase);
    return parts.join(' · ');
  }

  private static getIcon(event: AuthEvent): vscode.ThemeIcon {
    if (event.flags.isError) return new vscode.ThemeIcon('error');
    if (event.flags.isCors) return new vscode.ThemeIcon('warning');
    if (event.data._tag === 'sdk') return new vscode.ThemeIcon('symbol-event');
    return new vscode.ThemeIcon('circle-filled');
  }

  private static buildTooltip(event: AuthEvent): string {
    if (event.data._tag === 'network') {
      return `${event.data.method} ${event.data.url}\nStatus: ${event.data.status}\nDuration: ${event.data.duration}ms`;
    }
    return event.type;
  }
}
```

- [ ] **Step 4: Implement timeline-tree.ts**

```ts
// packages/vscode-extension/src/providers/timeline-tree.ts
import * as vscode from 'vscode';
import type { AuthEvent } from '@wolfcola/devtools-types';
import { TimelineItem } from './timeline-item.js';

export class TimelineTreeProvider implements vscode.TreeDataProvider<TimelineItem> {
  private events: AuthEvent[] = [];
  private _onDidChangeTreeData = new vscode.EventEmitter<TimelineItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: TimelineItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TimelineItem[] {
    return this.events.map((e) => new TimelineItem(e));
  }

  addEvent(event: AuthEvent): void {
    this.events.push(event);
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.events = [];
    this._onDidChangeTreeData.fire();
  }

  get eventCount(): number {
    return this.events.length;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `cd packages/vscode-extension && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/vscode-extension/src/providers/
git commit -m "feat(vscode): add Timeline TreeView provider"
```

---

### Task 12: Status bar and wiring

**Files:**
- Create: `packages/vscode-extension/src/status-bar.ts`
- Modify: `packages/vscode-extension/src/extension.ts`

- [ ] **Step 1: Implement status-bar.ts**

```ts
// packages/vscode-extension/src/status-bar.ts
import * as vscode from 'vscode';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export class StatusBar {
  private item: vscode.StatusBarItem;
  private state: ConnectionState = 'disconnected';
  private eventCount = 0;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'oidc-devtools.startCapture';
    this.update();
    this.item.show();
  }

  setState(state: ConnectionState): void {
    this.state = state;
    this.update();
  }

  setEventCount(count: number): void {
    this.eventCount = count;
    this.update();
  }

  private update(): void {
    switch (this.state) {
      case 'disconnected':
        this.item.text = '$(plug) OIDC DevTools: Disconnected';
        this.item.command = 'oidc-devtools.startCapture';
        break;
      case 'connecting':
        this.item.text = '$(sync~spin) OIDC DevTools: Connecting...';
        this.item.command = undefined;
        break;
      case 'connected':
        this.item.text = `$(plug) OIDC DevTools: Connected | ${this.eventCount} events`;
        this.item.command = 'oidc-devtools.stopCapture';
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
```

- [ ] **Step 2: Wire everything together in extension.ts**

```ts
// packages/vscode-extension/src/extension.ts
import * as vscode from 'vscode';
import { CdpClient } from './cdp/cdp-client.js';
import { discoverTargets, findPageTarget } from './cdp/target-discovery.js';
import { injectSdkCapture } from './cdp/sdk-injector.js';
import { TimelineTreeProvider } from './providers/timeline-tree.js';
import { StatusBar } from './status-bar.js';
import {
  buildNetworkEvent,
  handleMessage,
  runDiagnosis,
  serializeDiagnosis,
  EventStoreService,
  EventStoreInMemory,
} from '@wolfcola/devtools-core';
import type { HarEntry } from '@wolfcola/devtools-core';
import { Effect } from 'effect';

let cdpClient: CdpClient | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const timeline = new TimelineTreeProvider();
  const statusBar = new StatusBar();

  vscode.window.registerTreeDataProvider('oidc-devtools.timeline', timeline);

  const startCmd = vscode.commands.registerCommand('oidc-devtools.startCapture', async () => {
    const portInput = await vscode.window.showInputBox({
      prompt: 'Chrome debug port',
      value: '9222',
      validateInput: (v) => /^\d+$/.test(v) ? null : 'Must be a number',
    });
    if (!portInput) return;

    const port = parseInt(portInput, 10);
    statusBar.setState('connecting');

    try {
      const targets = await discoverTargets(port);
      const target = findPageTarget(targets);
      if (!target) {
        vscode.window.showErrorMessage('No page targets found. Is Chrome running with --remote-debugging-port?');
        statusBar.setState('disconnected');
        return;
      }

      cdpClient = new CdpClient(target.webSocketDebuggerUrl);
      await cdpClient.connect();
      await injectSdkCapture(cdpClient);

      statusBar.setState('connected');
      vscode.window.showInformationMessage(`Connected to: ${target.title}`);

      cdpClient.on('harEntry', (entry: HarEntry) => {
        const event = buildNetworkEvent(entry, null, null);
        if (!event.flags.isAuthRelated) return;
        timeline.addEvent(event);
        statusBar.setEventCount(timeline.eventCount);
      });

      cdpClient.on('sdkEvent', (payload: unknown) => {
        // SDK events arrive as the raw __pingDevtools payload
        const sdkPayload = (payload as { payload?: unknown }).payload;
        if (sdkPayload && typeof sdkPayload === 'object' && '_tag' in (sdkPayload as Record<string, unknown>)) {
          // Already an AuthEvent shape from devtools-bridge
          timeline.addEvent(sdkPayload as import('@wolfcola/devtools-types').AuthEvent);
          statusBar.setEventCount(timeline.eventCount);
        }
      });

      cdpClient.on('disconnected', () => {
        statusBar.setState('disconnected');
        cdpClient = null;
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      statusBar.setState('disconnected');
    }
  });

  const stopCmd = vscode.commands.registerCommand('oidc-devtools.stopCapture', () => {
    cdpClient?.disconnect();
    cdpClient = null;
    statusBar.setState('disconnected');
  });

  const clearCmd = vscode.commands.registerCommand('oidc-devtools.clearEvents', () => {
    timeline.clear();
    statusBar.setEventCount(0);
  });

  const exportCmd = vscode.commands.registerCommand('oidc-devtools.exportFlow', () => {
    vscode.window.showInformationMessage('Export: coming in Phase 5');
  });

  context.subscriptions.push(startCmd, stopCmd, clearCmd, exportCmd, statusBar);
}

export function deactivate(): void {
  cdpClient?.disconnect();
}
```

- [ ] **Step 3: Build and verify**

Run: `cd packages/vscode-extension && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Run tests**

Run: `cd packages/vscode-extension && pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/vscode-extension/src/
git commit -m "feat(vscode): wire CDP client, TreeView, and status bar into extension"
```

---

## Phase 4: Wire WebView to Shared Elm UI

### Task 13: Flow WebView panel

**Files:**
- Create: `packages/vscode-extension/src/webview/index.html`
- Create: `packages/vscode-extension/src/webview/webview-adapter.ts`
- Create: `packages/vscode-extension/src/panels/flow-webview.ts`

- [ ] **Step 1: Create WebView HTML shell**

```html
<!-- packages/vscode-extension/src/webview/index.html -->
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src {{cspSource}} 'unsafe-inline'; script-src 'nonce-{{nonce}}';"
    />
    <link rel="stylesheet" href="{{panelCssUri}}" />
    <style>
      /* Override devtools-ui colors with VS Code theme variables */
      :root {
        --base: var(--vscode-editor-background);
        --surface: var(--vscode-sideBar-background);
        --raised: var(--vscode-editorWidget-background);
        --hover: var(--vscode-list-hoverBackground);
        --sel: var(--vscode-list-activeSelectionBackground);
        --border: var(--vscode-panel-border);
        --text: var(--vscode-editor-foreground);
        --muted: var(--vscode-descriptionForeground);
        --dim: var(--vscode-disabledForeground);
        --blue: var(--vscode-textLink-foreground);
        --green: var(--vscode-testing-iconPassed);
        --red: var(--vscode-testing-iconFailed);
        --orange: var(--vscode-editorWarning-foreground);
        --yellow: var(--vscode-editorWarning-foreground);
        --purple: var(--vscode-symbolIcon-classForeground);
        --font-ui: var(--vscode-font-family);
        --font-mono: var(--vscode-editor-font-family);
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="{{nonce}}" src="{{elmJsUri}}"></script>
    <script nonce="{{nonce}}" src="{{adapterJsUri}}"></script>
  </body>
</html>
```

- [ ] **Step 2: Create webview-adapter.ts**

This runs inside the WebView (browser context) and bridges VS Code postMessage to Elm ports.

```ts
// packages/vscode-extension/src/webview/webview-adapter.ts

// @ts-expect-error — Elm is loaded via script tag
const Elm = (window as unknown as { Elm: import('@wolfcola/devtools-ui/ports').ElmModule }).Elm;

const vscode = acquireVsCodeApi();

const app = Elm.Main.init({ node: document.getElementById('app'), flags: null });

// VS Code → Elm: receive events from extension host
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'event':
      app.ports.receiveEvent.send(msg.payload);
      break;
    case 'diagnosis':
      app.ports.receiveDiagnosis.send(msg.payload);
      break;
    case 'importMeta':
      app.ports.receiveImportMeta.send(msg.payload);
      break;
    case 'importError':
      app.ports.receiveImportError.send(msg.payload);
      break;
    case 'snapshots':
      app.ports.receiveSnapshots.send(msg.payload);
      break;
  }
});

// Elm → VS Code: forward port subscriptions to extension host
app.ports.exportJson?.subscribe(() => {
  vscode.postMessage({ type: 'exportJson' });
});

app.ports.exportMarkdown?.subscribe(() => {
  vscode.postMessage({ type: 'exportMarkdown' });
});

app.ports.submitImportPaste?.subscribe((text: string) => {
  vscode.postMessage({ type: 'submitImportPaste', payload: text });
});

app.ports.clearFlow?.subscribe(() => {
  vscode.postMessage({ type: 'clearFlow' });
});

app.ports.copyToClipboard?.subscribe((text: string) => {
  vscode.postMessage({ type: 'copyToClipboard', payload: text });
});

// Snapshots not supported in VS Code v1 — no-op subscriptions
app.ports.saveSnapshot?.subscribe(() => {});
app.ports.requestSnapshots?.subscribe(() => {});
app.ports.loadSnapshot?.subscribe(() => {});
app.ports.deleteSnapshot?.subscribe(() => {});

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };
```

- [ ] **Step 3: Implement flow-webview.ts**

```ts
// packages/vscode-extension/src/panels/flow-webview.ts
import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthEvent } from '@wolfcola/devtools-types';
import type { SerializableDiagnosisResult } from '@wolfcola/devtools-core';

export class FlowWebviewPanel {
  private panel: vscode.WebviewPanel | null = null;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  reveal(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'oidc-devtools.flow',
      'OIDC Flow',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      },
    );

    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'copyToClipboard':
          vscode.env.clipboard.writeText(msg.payload);
          break;
        case 'clearFlow':
          // handled by extension.ts
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  sendEvent(event: AuthEvent): void {
    this.panel?.webview.postMessage({ type: 'event', payload: event });
  }

  sendDiagnosis(diagnosis: SerializableDiagnosisResult): void {
    this.panel?.webview.postMessage({ type: 'diagnosis', payload: diagnosis });
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const webviewDir = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');

    const elmJsUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, 'elm.js'));
    const panelCssUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, 'panel.css'));
    const adapterJsUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, 'adapter.js'));

    const templatePath = join(this.extensionUri.fsPath, 'dist', 'webview', 'index.html');
    let html = readFileSync(templatePath, 'utf8');

    html = html
      .replaceAll('{{nonce}}', nonce)
      .replaceAll('{{cspSource}}', webview.cspSource)
      .replaceAll('{{elmJsUri}}', elmJsUri.toString())
      .replaceAll('{{panelCssUri}}', panelCssUri.toString())
      .replaceAll('{{adapterJsUri}}', adapterJsUri.toString());

    return html;
  }
}

function getNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Update esbuild.mjs to bundle webview assets**

Add to `packages/vscode-extension/esbuild.mjs`:

```js
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const watch = process.argv.includes('--watch');
const require = createRequire(import.meta.url);

// Bundle extension host code
/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  minify: !watch,
};

// Bundle webview adapter
/** @type {import('esbuild').BuildOptions} */
const webviewOptions = {
  entryPoints: ['src/webview/webview-adapter.ts'],
  bundle: true,
  outfile: 'dist/webview/adapter.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: !watch,
};

// Copy devtools-ui assets to dist/webview/
mkdirSync('dist/webview', { recursive: true });
const uiPkg = require.resolve('@wolfcola/devtools-ui/package.json');
const uiDir = uiPkg.replace('/package.json', '');
cpSync(`${uiDir}/dist/elm.js`, 'dist/webview/elm.js');
cpSync(`${uiDir}/dist/panel.css`, 'dist/webview/panel.css');

// Copy webview HTML template
cpSync('src/webview/index.html', 'dist/webview/index.html');

if (watch) {
  const { context } = await import('esbuild');
  const ctx1 = await context(extensionOptions);
  const ctx2 = await context(webviewOptions);
  await Promise.all([ctx1.watch(), ctx2.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([build(extensionOptions), build(webviewOptions)]);
  console.log('Build complete.');
}
```

- [ ] **Step 5: Add devtools-ui dependency**

In `packages/vscode-extension/package.json`, add to `dependencies`:
```json
"@wolfcola/devtools-ui": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 6: Wire FlowWebviewPanel into extension.ts**

Add to `extension.ts` after the TreeView registration:

```ts
const flowPanel = new FlowWebviewPanel(context.extensionUri);

// Add selectEvent command
const selectCmd = vscode.commands.registerCommand('oidc-devtools.selectEvent', (event: AuthEvent) => {
  flowPanel.reveal();
  flowPanel.sendEvent(event);
});

context.subscriptions.push(selectCmd, { dispose: () => flowPanel.dispose() });
```

And update the `harEntry` handler to also send events to the webview:

```ts
cdpClient.on('harEntry', (entry: HarEntry) => {
  const event = buildNetworkEvent(entry, null, null);
  if (!event.flags.isAuthRelated) return;
  timeline.addEvent(event);
  statusBar.setEventCount(timeline.eventCount);
  flowPanel.sendEvent(event);
});
```

Import `FlowWebviewPanel` at the top and `AuthEvent` type.

- [ ] **Step 7: Build and verify**

Run: `pnpm build`
Expected: Full workspace builds, including vscode-extension with webview assets

- [ ] **Step 8: Commit**

```bash
git add packages/vscode-extension/
git commit -m "feat(vscode): add Flow WebView panel with Elm UI and VS Code theme integration"
```

---

## Phase 5: Launch Configuration & Polish

### Task 14: Chrome launcher and debug configuration provider

**Files:**
- Create: `packages/vscode-extension/src/launch/chrome-launcher.ts`
- Create: `packages/vscode-extension/src/launch/chrome-launcher.test.ts`
- Create: `packages/vscode-extension/src/launch/debug-config-provider.ts`
- Modify: `packages/vscode-extension/package.json` (contributes.debuggers)
- Modify: `packages/vscode-extension/src/extension.ts`

- [ ] **Step 1: Write failing test for Chrome launcher**

```ts
// packages/vscode-extension/src/launch/chrome-launcher.test.ts
import { describe, it, expect } from 'vitest';
import { buildChromeArgs } from './chrome-launcher.js';

describe('buildChromeArgs', () => {
  it('includes remote debugging port', () => {
    const args = buildChromeArgs({ port: 9222, url: 'http://localhost:3000' });
    expect(args).toContain('--remote-debugging-port=9222');
  });

  it('includes the URL', () => {
    const args = buildChromeArgs({ port: 9222, url: 'http://localhost:3000' });
    expect(args).toContain('http://localhost:3000');
  });

  it('uses a unique user data dir', () => {
    const args = buildChromeArgs({ port: 9222, url: 'http://localhost:3000' });
    expect(args.some((a) => a.startsWith('--user-data-dir='))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vscode-extension && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement chrome-launcher.ts**

```ts
// packages/vscode-extension/src/launch/chrome-launcher.ts
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface LaunchOptions {
  port: number;
  url: string;
  chromePath?: string;
}

const CHROME_PATHS: Record<string, string[]> = {
  linux: [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
};

export function buildChromeArgs(options: LaunchOptions): string[] {
  const userDataDir = mkdtempSync(join(tmpdir(), 'oidc-devtools-'));
  return [
    `--remote-debugging-port=${options.port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    options.url,
  ];
}

export function findChromePath(): string | undefined {
  const platform = process.platform as 'linux' | 'darwin' | 'win32';
  const candidates = CHROME_PATHS[platform] ?? [];
  // For simplicity, return first candidate — a more robust implementation
  // would check if the file exists
  return candidates[0];
}

export function launchChrome(options: LaunchOptions): ChildProcess {
  const chromePath = options.chromePath ?? findChromePath();
  if (!chromePath) {
    throw new Error('Chrome not found. Set chromePath in launch configuration.');
  }
  const args = buildChromeArgs(options);
  return spawn(chromePath, args, { detached: true, stdio: 'ignore' });
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/vscode-extension && pnpm test`
Expected: PASS

- [ ] **Step 5: Implement debug-config-provider.ts**

```ts
// packages/vscode-extension/src/launch/debug-config-provider.ts
import * as vscode from 'vscode';

export class OidcDebugConfigProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    // Fill defaults
    if (!config.type) config.type = 'oidc-devtools';
    if (!config.request) config.request = 'launch';
    if (!config.name) config.name = 'Debug OIDC Flow';
    if (!config.port) config.port = 9222;
    if (!config.url) config.url = 'http://localhost:3000';

    return config;
  }
}
```

- [ ] **Step 6: Add debuggers contribution to package.json**

Add to `contributes` in `packages/vscode-extension/package.json`:

```json
"debuggers": [
  {
    "type": "oidc-devtools",
    "label": "OIDC DevTools",
    "configurationAttributes": {
      "launch": {
        "required": ["url"],
        "properties": {
          "url": {
            "type": "string",
            "description": "URL to open in Chrome",
            "default": "http://localhost:3000"
          },
          "port": {
            "type": "number",
            "description": "Chrome remote debugging port",
            "default": 9222
          },
          "chromePath": {
            "type": "string",
            "description": "Path to Chrome executable"
          }
        }
      },
      "attach": {
        "properties": {
          "port": {
            "type": "number",
            "description": "Chrome remote debugging port",
            "default": 9222
          }
        }
      }
    },
    "configurationSnippets": [
      {
        "label": "OIDC DevTools: Launch",
        "description": "Launch Chrome and capture OIDC flows",
        "body": {
          "type": "oidc-devtools",
          "request": "launch",
          "name": "Debug OIDC Flow",
          "url": "http://localhost:3000",
          "port": 9222
        }
      }
    ]
  }
]
```

- [ ] **Step 7: Register debug config provider in extension.ts**

Add to `activate()`:

```ts
import { OidcDebugConfigProvider } from './launch/debug-config-provider.js';

// In activate():
const debugProvider = vscode.debug.registerDebugConfigurationProvider(
  'oidc-devtools',
  new OidcDebugConfigProvider(),
);
context.subscriptions.push(debugProvider);
```

- [ ] **Step 8: Build and verify**

Run: `pnpm build`
Expected: Full workspace builds

- [ ] **Step 9: Run all tests**

Run: `pnpm test`
Expected: All tests pass across all packages

- [ ] **Step 10: Commit**

```bash
git add packages/vscode-extension/
git commit -m "feat(vscode): add Chrome launcher and debug configuration provider"
```

---

### Task 15: Export commands and final polish

**Files:**
- Modify: `packages/vscode-extension/src/extension.ts`

- [ ] **Step 1: Implement export command**

Replace the placeholder export command in `extension.ts`:

```ts
import { redactFlowState, renderFlowMarkdown, runDiagnosis } from '@wolfcola/devtools-core';
import type { FlowState } from '@wolfcola/devtools-types';

// In activate(), replace the exportCmd:
const exportCmd = vscode.commands.registerCommand('oidc-devtools.exportFlow', async () => {
  // Build a FlowState from current timeline events
  const events = timeline.getEvents(); // need to expose this from TimelineTreeProvider
  if (events.length === 0) {
    vscode.window.showWarningMessage('No events captured yet.');
    return;
  }

  const format = await vscode.window.showQuickPick(['JSON', 'Markdown'], {
    placeHolder: 'Export format',
  });
  if (!format) return;

  const flowState: FlowState = {
    flowId: null,
    capturedAt: new Date().toISOString(),
    events,
    summary: { nodeCount: 0, errorCount: 0, corsFlags: [], duration: 0, sdkConnected: false },
    lastSdkEventId: null,
  };

  const redacted = redactFlowState(flowState);

  if (format === 'JSON') {
    const envelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      redacted: true,
      flow: redacted,
    };
    const doc = await vscode.workspace.openTextDocument({
      content: JSON.stringify(envelope, null, 2),
      language: 'json',
    });
    await vscode.window.showTextDocument(doc);
  } else {
    const diagnosis = runDiagnosis(redacted.events);
    const md = renderFlowMarkdown(redacted, diagnosis);
    const doc = await vscode.workspace.openTextDocument({
      content: md,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }
});
```

- [ ] **Step 2: Add getEvents() to TimelineTreeProvider**

In `packages/vscode-extension/src/providers/timeline-tree.ts`, add:

```ts
getEvents(): AuthEvent[] {
  return [...this.events];
}
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: Full workspace builds

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 5: Run e2e tests (browser extension still works)**

Run: `cd e2e && pnpm test`
Expected: All e2e tests pass — browser extension is unaffected

- [ ] **Step 6: Commit**

```bash
git add packages/vscode-extension/
git commit -m "feat(vscode): add export commands and finalize extension"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `pnpm build` — all packages build
- [ ] `pnpm test` — all unit tests pass across all packages
- [ ] `pnpm typecheck` — clean type checking
- [ ] `cd e2e && pnpm test` — browser extension e2e tests pass
- [ ] Browser extension loads in Chrome DevTools and captures events
- [ ] VS Code extension activates, connects to Chrome via CDP, captures events in TreeView
- [ ] Clicking a TreeView item opens the Flow WebView with Elm UI
- [ ] Status bar shows connection state and event count
- [ ] Export commands produce JSON and Markdown output
