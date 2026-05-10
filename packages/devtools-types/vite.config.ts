import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
  },
}));
