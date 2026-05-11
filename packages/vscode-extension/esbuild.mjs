import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const watch = process.argv.includes('--watch');
const require = createRequire(import.meta.url);

/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  minify: !watch,
};

/** @type {import('esbuild').BuildOptions} */
const webviewOptions = {
  entryPoints: ['src/webview/webview-adapter.ts'],
  bundle: true,
  outfile: 'dist/webview/adapter.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: !watch,
};

// Copy devtools-ui assets
mkdirSync('dist/webview', { recursive: true });
const uiPkg = require.resolve('@wolfcola/devtools-ui/package.json');
const uiDir = uiPkg.replace('/package.json', '');
cpSync(`${uiDir}/dist/elm.js`, 'dist/webview/elm.js');
cpSync(`${uiDir}/dist/panel.css`, 'dist/webview/panel.css');

// Copy WebView HTML template
cpSync('src/webview/index.html', 'dist/webview/index.html');

if (watch) {
  const { context } = await import('esbuild');
  const ctx1 = await context(extensionOptions);
  const ctx2 = await context(webviewOptions);
  await Promise.all([ctx1.watch(), ctx2.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([build(extensionOptions), build(webviewOptions)]);
  console.log('Build complete.');
}
