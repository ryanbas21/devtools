import { defineConfig } from 'vite';
import adapter from 'elm-pages/adapter/netlify.js';

export default {
  vite: defineConfig({
    base: '/devtools/',
  }),
  adapter,
  headTagsTemplate(context) {
    return `
<link rel="stylesheet" href="/devtools/style.css" />
<meta name="generator" content="elm-pages v${context.cliVersion}" />
`;
  },
  preloadTagForFile(file) {
    return !file.endsWith('.css');
  },
};
