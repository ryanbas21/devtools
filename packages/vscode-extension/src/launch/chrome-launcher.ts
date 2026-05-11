import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface LaunchOptions {
  port: number;
  url: string;
  chromePath?: string;
}

const CHROME_PATHS: Record<string, string[]> = {
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
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
  for (const candidate of candidates) {
    try {
      // For absolute paths, check if the file exists via which/where
      // For bare names, check if they're on PATH
      execFileSync(platform === 'win32' ? 'where' : 'which', [candidate], {
        stdio: 'ignore',
      });
      return candidate;
    } catch {
      // Not found, try next candidate
    }
  }
  return undefined;
}

export function launchChrome(options: LaunchOptions): ChildProcess {
  const chromePath = options.chromePath ?? findChromePath();
  if (!chromePath) {
    throw new Error('Chrome not found. Set chromePath in launch configuration.');
  }
  const args = buildChromeArgs(options);
  return spawn(chromePath, args, { detached: true, stdio: 'ignore' });
}
