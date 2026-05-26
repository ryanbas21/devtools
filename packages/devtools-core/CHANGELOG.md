# @wolfcola/devtools-core

## 1.2.0

### Minor Changes

- [#57](https://github.com/ryanbas21/devtools/pull/57) [`4b2b276`](https://github.com/ryanbas21/devtools/commit/4b2b27643c4533e79732c9cc69ca25c9ff581efd) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Add standalone Electron debugger with MCP integration

  New `attachDebugger()` API in devtools-bridge connects apps to the standalone
  debugger via WebSocket. Includes auto-launch, fetch/XHR/Node HTTP interceptors,
  and reconnection with session management. The standalone app runs as an Electron
  desktop app or headless MCP server (`--mcp` flag) with 10 tools for session
  inspection, event querying, diagnosis, and export.

### Patch Changes

- [#61](https://github.com/ryanbas21/devtools/pull/61) [`bc42519`](https://github.com/ryanbas21/devtools/commit/bc42519de6075ec9f60d1b3091ef0603b9ead74a) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Fix PAR inline-params rule falsely flagging client_id alongside request_uri

  The `par:inline-params-with-request-uri` diagnosis rule incorrectly treated `client_id` as a prohibited inline parameter. Per RFC 9126, `client_id` is required alongside `request_uri` in the authorization request after a PAR. Only truly prohibited params (`redirect_uri`, `scope`, etc.) now trigger the warning.

- Updated dependencies []:
  - @wolfcola/devtools-types@1.2.0

## 1.1.1

### Patch Changes

- Updated dependencies []:
  - @wolfcola/devtools-types@1.1.1

## 1.1.0

### Patch Changes

- Updated dependencies []:
  - @wolfcola/devtools-types@1.1.0

## 1.0.0

### Patch Changes

- Updated dependencies [[`07a98e3`](https://github.com/ryanbas21/devtools/commit/07a98e37a75a735cceff87f5efbef11f55395543)]:
  - @wolfcola/devtools-types@1.0.0
