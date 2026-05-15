import { execFileSync, spawn } from 'node:child_process';

const BINARY_NAME = 'wolfcola-devtools';

export function findBinary(): string | null {
  try {
    const result = execFileSync('which', [BINARY_NAME]);
    return result.toString().trim() || null;
  } catch {
    return null;
  }
}

export function launchDebugger(binaryPath: string, port?: number): void {
  const args = port ? ['--port', String(port)] : [];
  const child = spawn(binaryPath, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export async function ensureRunning(port: number): Promise<boolean> {
  const binary = findBinary();
  if (!binary) return false;

  launchDebugger(binary, port);

  const delays = [50, 100, 200, 400, 800, 1000];
  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      const connected = await new Promise<boolean>((resolve) => {
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
      });
      if (connected) return true;
    } catch {
      continue;
    }
  }
  return false;
}
