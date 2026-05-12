// @ts-check

/** @type {import("syncpack").RcFile} */
const config = {
  sortFirst: [
    'name',
    'version',
    'private',
    'description',
    'license',
    'type',
    'exports',
    'main',
    'types',
    'bin',
    'files',
    'scripts',
    'dependencies',
    'devDependencies',
    'peerDependencies',
  ],
  versionGroups: [
    // ─── Ignore catalog source definitions ─────────────────────────────
    // pnpm-workspace.yaml defines the actual versions — these are the
    // source of truth for catalogs and should not be pinned.
    {
      label: 'Catalog source definitions are ignored',
      packages: ['pnpm-workspace.yaml'],
      isIgnored: true,
    },
    // ─── Ignore peer dependencies ──────────────────────────────────────
    // Peer deps use semver ranges set by the consumer, not catalogs.
    {
      label: 'Peer dependencies are ignored',
      dependencyTypes: ['peer'],
      isIgnored: true,
    },
    // ─── Catalog enforcement: effect ecosystem ─────────────────────────
    {
      label: 'Effect packages must use catalog:effect',
      dependencies: [
        'effect',
        '@effect/cli',
        '@effect/platform',
        '@effect/platform-node',
        '@effect/vitest',
      ],
      pinVersion: 'catalog:effect',
    },
    // ─── Catalog enforcement: vitest ───────────────────────────────────
    {
      label: 'Vitest must use catalog:vitest',
      dependencies: ['vitest'],
      pinVersion: 'catalog:vitest',
    },
    // ─── Catalog enforcement: vite ─────────────────────────────────────
    {
      label: 'Vite must use catalog:vite',
      dependencies: ['vite'],
      pinVersion: 'catalog:vite',
    },
    // ─── Internal workspace deps ───────────────────────────────────────
    {
      label: 'Internal @wolfcola/* packages must use workspace:*',
      dependencies: ['@wolfcola/*'],
      pinVersion: 'workspace:*',
    },
    // ─── Banned packages ───────────────────────────────────────────────
    {
      label: '@effect/schema is deprecated — use effect/Schema',
      dependencies: ['@effect/schema'],
      isBanned: true,
    },
  ],
};

export default config;
