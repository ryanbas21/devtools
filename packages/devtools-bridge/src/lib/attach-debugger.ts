import { StandaloneClient } from './standalone-client.js';
import { installFetchInterceptor, uninstallFetchInterceptor } from './fetch-interceptor.js';
import { ensureRunning } from './auto-launch.js';
import type { BridgeHandle } from './emit.js';

export interface AttachDebuggerOptions {
  name: string;
  port?: number;
  pid?: number;
  framework?: string;
  network?: boolean;
  autoLaunch?: boolean;
}

export interface DebuggerHandle extends BridgeHandle {
  connected: boolean;
}

export async function attachDebugger(opts: AttachDebuggerOptions): Promise<DebuggerHandle> {
  const port = opts.port ?? 19417;
  const client = new StandaloneClient({
    name: opts.name,
    port,
    pid: opts.pid,
    framework: opts.framework,
  });

  await client.connect();

  if (!client.isConnected() && opts.autoLaunch !== false) {
    const launched = await ensureRunning(port);
    if (launched) {
      await client.connect();
    } else {
      console.warn(`[wolfcola] Could not auto-launch debugger on port ${port}`);
    }
  }

  if (!client.isConnected()) {
    console.warn(`[wolfcola] Debugger not connected — events will not be captured`);
  }

  if (opts.network !== false && client.isConnected()) {
    installFetchInterceptor((entry) => {
      client.sendNetworkEvent(entry);
    });
  }

  return {
    connected: client.isConnected(),
    detach: () => {
      uninstallFetchInterceptor();
      client.close();
    },
  };
}
