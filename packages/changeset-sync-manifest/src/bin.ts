#!/usr/bin/env node
import { resolve } from 'node:path';
import { syncManifestVersion } from './sync.js';

const dir = process.argv[2];

if (!dir) {
  console.error('Usage: sync-manifest <dir>');
  process.exit(1);
}

try {
  syncManifestVersion(resolve(dir));
  console.log(`Synced manifest.json version in ${dir}`);
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
}
