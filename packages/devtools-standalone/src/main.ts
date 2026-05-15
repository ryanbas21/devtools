import { Effect, Fiber, Layer } from 'effect';
import path from 'node:path';
import { SessionManager, SessionManagerLive } from './session-manager.js';
import { WsServer, WsServerLive } from './ws-server.js';
import { IPC_CHANNELS, createIpcHandlers } from './ipc-bridge.js';

let cleanupServer: (() => Promise<void>) | null = null;

const DEFAULT_PORT = 19417;

function getPort(): number {
  const portArg = process.argv.find((a) => a === '--port' || a.startsWith('--port='));
  if (portArg) {
    const idx = process.argv.indexOf(portArg);
    const val = portArg.includes('=') ? portArg.split('=')[1] : process.argv[idx + 1];
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
    console.warn(`[WolfCola DevTools] Invalid port value "${val}", using default ${DEFAULT_PORT}`);
  }
  return DEFAULT_PORT;
}

// ── MCP Mode (headless, stdio) ──────────────────────────────────────────────

async function runMcp() {
  const { McpServerLive } = await import('./mcp/server.js');
  await Layer.launch(McpServerLive).pipe(Effect.runPromise);
}

// ── GUI Mode (Electron + WebSocket server) ──────────────────────────────────

async function runGui() {
  const { app, BrowserWindow, ipcMain } = await import('electron');
  await app.whenReady();

  const port = getPort();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'WolfCola DevTools',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', '..', 'assets', 'panel.html'));

  const AppLayer = Layer.provide(WsServerLive, SessionManagerLive).pipe(
    Layer.merge(SessionManagerLive),
  );

  const program = Effect.gen(function* () {
    const mgr = yield* SessionManager;
    const server = yield* WsServer;

    const handlers = createIpcHandlers(mgr);
    for (const [channel, handler] of Object.entries(handlers)) {
      ipcMain.handle(channel, (_event, ...args) =>
        (handler as (...a: unknown[]) => unknown)(...args),
      );
    }

    console.log(`[WolfCola DevTools] Starting WebSocket server on port ${port}...`);

    const fiber = yield* server
      .start(port, (event, diagnosis) => {
        for (const w of BrowserWindow.getAllWindows()) {
          w.webContents.send(IPC_CHANNELS.EVENT, event);
          w.webContents.send(IPC_CHANNELS.DIAGNOSIS, diagnosis);
        }
      })
      .pipe(Effect.scoped, Effect.forkDaemon);
    cleanupServer = () => Effect.runPromise(Fiber.interrupt(fiber).pipe(Effect.asVoid));
  });

  app.on('will-quit', (event) => {
    if (cleanupServer) {
      event.preventDefault();
      const fn = cleanupServer;
      cleanupServer = null;
      fn().finally(() => app.quit());
    }
  });

  await Effect.runPromise(Effect.provide(program, AppLayer));

  console.log(`[WolfCola DevTools] WebSocket server listening on port ${port}`);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'WolfCola DevTools',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      newWin.loadFile(path.join(__dirname, '..', '..', 'assets', 'panel.html'));
    }
  });
}

// ── Entry Point ─────────────────────────────────────────────────────────────

const isMcpMode = process.argv.includes('--mcp');

if (isMcpMode) {
  runMcp().catch(console.error);
} else {
  runGui().catch(console.error);
}
