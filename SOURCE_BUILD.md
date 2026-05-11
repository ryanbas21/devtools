# Building from source

## Prerequisites

- Node.js 24
- pnpm (see `packageManager` in `package.json` for exact version)

## Steps

```bash
pnpm install --frozen-lockfile
pnpm build                          # builds all workspace packages
# The Firefox extension is now at packages/devtools-extension/dist/

# To explicitly build the Firefox variant:
cd packages/devtools-extension
node build.mjs --target=firefox
```

The built extension is in `packages/devtools-extension/dist/`.

## What the build does

1. Bundles TypeScript entry points with esbuild (minified)
2. Compiles the Elm panel UI and minifies with terser
3. Generates the Firefox manifest (swaps `service_worker` to `scripts`, adds `browser_specific_settings`)
4. Copies static assets (icons, HTML)
