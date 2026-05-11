import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';

const cwd = import.meta.dirname;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd });
const npx = (args) => run('npx', args);

mkdirSync('dist', { recursive: true });

// Elm — compile and minify
npx(['elm', 'make', 'src/Main.elm', '--output=dist/elm.js', '--optimize']);

npx([
  'terser',
  'dist/elm.js',
  '--compress',
  'pure_funcs=["F2","F3","F4","F5","F6","F7","F8","F9",' +
    '"A2","A3","A4","A5","A6","A7","A8","A9"],' +
    'pure_getters,keep_fargs=false,unsafe_comps,unsafe',
  '--mangle',
  '--output',
  'dist/elm.js',
]);

// Copy CSS and HTML
cpSync('src/panel.css', 'dist/panel.css');
cpSync('src/panel.html', 'dist/panel.html');

console.log('devtools-ui build complete.');
