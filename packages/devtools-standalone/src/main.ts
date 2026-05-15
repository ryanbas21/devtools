import { app, BrowserWindow, ipcMain } from 'electron';
import { Effect, Layer } from 'effect';
import path from 'node:path';
import { SessionManager, SessionManagerLive } from './session-manager.js';
import { WsServer, WsServerLive } from './ws-server.js';
import { IPC_CHANNELS, createIpcHandlers } from './ipc-bridge.js';

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

function createWindow(): BrowserWindow {
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
  return win;
}

async function main() {
  await app.whenReady();

  const port = getPort();
  createWindow();

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

    // server.start returns Effect<never, ..., Scope> — fork it scoped so
    // the server runs for the lifetime of the program
    yield* server
      .start(port, (event, diagnosis) => {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC_CHANNELS.EVENT, event);
          win.webContents.send(IPC_CHANNELS.DIAGNOSIS, diagnosis);
        }
      })
      .pipe(Effect.scoped, Effect.forkDaemon);
  });

  await Effect.runPromise(Effect.provide(program, AppLayer));

  console.log(`[WolfCola DevTools] WebSocket server listening on port ${port}`);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

main().catch(console.error);
