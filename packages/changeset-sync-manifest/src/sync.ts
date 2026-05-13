import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const syncManifestVersion = (dir: string): void => {
  const pkgPath = join(dir, 'package.json');
  const manifestPath = join(dir, 'manifest.json');

  let pkgRaw: string;
  try {
    pkgRaw = readFileSync(pkgPath, 'utf8');
  } catch {
    throw new Error(`Cannot read package.json at ${pkgPath}`);
  }

  let manifestRaw: string;
  try {
    manifestRaw = readFileSync(manifestPath, 'utf8');
  } catch {
    throw new Error(`Cannot read manifest.json at ${manifestPath}`);
  }

  const pkg = JSON.parse(pkgRaw) as { version?: string };
  if (!pkg.version) {
    throw new Error(`No version field in ${pkgPath}`);
  }

  const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
  manifest.version = pkg.version;

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
};
