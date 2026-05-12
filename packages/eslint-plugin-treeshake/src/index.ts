import { noTreeshakeHazard } from './lib/no-treeshake-hazard.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugin: any = {
  meta: {
    name: '@wolfcola/eslint-plugin-treeshake',
    version: '0.0.0',
  },
  rules: {
    'no-treeshake-hazard': noTreeshakeHazard,
  },
  configs: {} as Record<string, unknown>,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recommended: any = {
  plugins: { wolfcola: plugin },
  rules: {
    'wolfcola/no-treeshake-hazard': 'warn',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strict: any = {
  plugins: { wolfcola: plugin },
  rules: {
    'wolfcola/no-treeshake-hazard': ['error', { bundleCheck: true }],
  },
};

plugin.configs = { recommended, strict };

export default plugin;
export { noTreeshakeHazard };
