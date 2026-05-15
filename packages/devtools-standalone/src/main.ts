import { app, BrowserWindow, ipcMain } from 'electron';
import { Effect, Layer } from 'effect';
import path from 'node:path';
import { SessionManager, SessionManagerLive } from './session-manager.js';
import { WsServer, WsServerLive } from './ws-server.js';
import { createIpcHandlers } from './ipc-bridge.js';

const DEFAULT_PORT = 19417;

function getPort(): number {
  const portArg = process.argv.find((a) => a.startsWith('--port'));
  if (portArg) {
    const idx = process.argv.indexOf(portArg);
    const val = portArg.includes('=') ? portArg.split('=')[1] : process.argv[idx + 1];
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return DEFAULT_PORT;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'WolfCola DevTools',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(import.meta.dirname, '..', 'assets', 'panel.html'));
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

    yield* Effect.fork(server.start(port));

    console.log(`[WolfCola DevTools] WebSocket server listening on port ${port}`);
  });

  await Effect.runPromise(Effect.provide(program, AppLayer));

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
