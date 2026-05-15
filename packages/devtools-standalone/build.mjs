import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const npx = (args) => execFileSync('npx', args, { stdio: 'inherit', cwd: __dirname });

mkdirSync('dist/src', { recursive: true });
mkdirSync('assets', { recursive: true });

npx([
  'esbuild',
  'src/main.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--outfile=dist/src/main.js',
  '--external:electron',
  '--packages=external',
]);

npx([
  'esbuild',
  'src/preload.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--outfile=dist/src/preload.js',
  '--external:electron',
  '--packages=external',
]);

npx([
  'esbuild',
  'src/renderer.ts',
  '--bundle',
  '--platform=browser',
  '--format=iife',
  '--outfile=assets/renderer.js',
]);

const uiDist = resolve(__dirname, '..', 'devtools-ui', 'dist');
cpSync(`${uiDist}/elm.js`, 'assets/elm.js');
cpSync(`${uiDist}/panel.css`, 'assets/panel.css');

console.log('[build] Standalone debugger built successfully.');
