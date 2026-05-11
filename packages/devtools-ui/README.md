# @wolfcola/devtools-ui

Shared Elm UI for WolfCola DevTools. Compiles to a single JavaScript bundle consumed by both the browser extension and VS Code extension.

## Views

- **Timeline** — chronological event list with type badges, status codes, methods, URLs, and inline tags
- **Flow** — grouped network requests with collapsible sections for headers, body, and response
- **Learn** — SVG-based flow diagrams with interactive navigation

## Build

```bash
pnpm build
```

Outputs to `dist/`:
- `elm.js` — compiled and minified Elm application
- `panel.css` — all panel styles
- `panel.html` — HTML shell referencing the above

## Exports

```ts
// TypeScript port interface for wiring Elm to any host environment
import type { ElmPorts, ElmApp, ElmModule } from '@wolfcola/devtools-ui/ports';
```

### Elm ports

**Inbound (host → Elm):**
- `receiveEvent` — push an AuthEvent to the timeline
- `receiveDiagnosis` — push diagnosis results
- `receiveImportMeta` — metadata for imported flows
- `receiveImportError` — import error messages
- `receiveSnapshots` — list of saved snapshots

**Outbound (Elm → host):**
- `exportJson` — user requested JSON export
- `exportMarkdown` — user requested Markdown export
- `submitImportPaste` — user pasted flow JSON
- `clearFlow` — user cleared the flow
- `copyToClipboard` — text to copy
- `saveSnapshot` / `loadSnapshot` / `deleteSnapshot` / `requestSnapshots` — snapshot management

## How it's consumed

The host environment (browser extension or VS Code WebView) loads `elm.js` via a `<script>` tag, initializes the Elm app, and wires the ports to its own messaging system:

- **Browser extension** → `chrome.runtime.sendMessage` / `onMessage`
- **VS Code WebView** → `postMessage` / `onDidReceiveMessage`

## Tech stack

- Elm 0.19.1
- terser for minification
- elm-tooling for Elm binary management

## License

MIT
