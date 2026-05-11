import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const target = process.argv.includes('--target=firefox') ? 'firefox' : 'chrome';
const cwd = import.meta.dirname;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd });
const npx = (args) => run('npx', args);

console.log(`Building for ${target}...`);

mkdirSync('dist/panel', { recursive: true });
mkdirSync('dist/background', { recursive: true });
mkdirSync('dist/content', { recursive: true });

// TypeScript entry points via esbuild
const esbuildEntries = [
  {
    input: 'src/devtools/devtools.ts',
    output: 'dist/devtools.js',
    format: 'esm',
  },
  {
    input: 'src/panel/panel.ts',
    output: 'dist/panel/panel.js',
    format: 'esm',
  },
  {
    input: 'src/background/service-worker.ts',
    output: 'dist/background/service-worker.js',
    format: 'esm',
    footer: 'export {}',
  },
  {
    input: 'src/content/content-script.ts',
    output: 'dist/content/content-script.js',
    format: 'iife',
  },
  {
    input: 'src/content/relay.ts',
    output: 'dist/content/relay.js',
    format: 'iife',
  },
];

for (const entry of esbuildEntries) {
  const args = [
    'esbuild',
    entry.input,
    '--bundle',
    '--minify',
    `--outfile=${entry.output}`,
    `--format=${entry.format}`,
    '--platform=browser',
  ];
  if (entry.footer) args.push(`--footer:js=${entry.footer}`);
  npx(args);
}

// Elm — compile and minify
npx(['elm', 'make', 'src/panel/Main.elm', '--output=dist/panel/elm.js', '--optimize']);

npx([
  'terser',
  'dist/panel/elm.js',
  '--compress',
  'pure_funcs=["F2","F3","F4","F5","F6","F7","F8","F9",' +
    '"A2","A3","A4","A5","A6","A7","A8","A9"],' +
    'pure_getters,keep_fargs=false,unsafe_comps,unsafe',
  '--mangle',
  '--output',
  'dist/panel/elm.js',
]);

// Manifest — swap background field per target
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
if (target === 'firefox') {
  manifest.background = { scripts: ['background/service-worker.js'], type: 'module' };
  manifest.browser_specific_settings = {
    gecko: {
      id: 'oidc-devtool@wolfcola',
      data_collection_permissions: { required: ['none'] },
    },
  };
}
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
cpSync('icons', 'dist/icons', { recursive: true });
cpSync('src/devtools/devtools.html', 'dist/devtools.html');
cpSync('src/panel/panel.html', 'dist/panel/panel.html');

console.log('Build complete.');
