---
'@wolfcola/devtools-bridge': minor
'@wolfcola/devtools-core': minor
---

Add standalone Electron debugger with MCP integration

New `attachDebugger()` API in devtools-bridge connects apps to the standalone
debugger via WebSocket. Includes auto-launch, fetch/XHR/Node HTTP interceptors,
and reconnection with session management. The standalone app runs as an Electron
desktop app or headless MCP server (`--mcp` flag) with 10 tools for session
inspection, event querying, diagnosis, and export.
