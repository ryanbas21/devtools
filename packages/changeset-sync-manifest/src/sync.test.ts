import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncManifestVersion } from './sync.js';

describe('syncManifestVersion', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sync-manifest-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('copies version from package.json to manifest.json', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '2.0.0' }));
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({ manifest_version: 3, version: '0.1.0' }),
    );

    syncManifestVersion(dir);

    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.version).toBe('2.0.0');
  });

  it('preserves other manifest fields', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({ manifest_version: 3, name: 'My Extension', version: '0.1.0' }),
    );

    syncManifestVersion(dir);

    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('My Extension');
    expect(manifest.version).toBe('1.0.0');
  });

  it('writes with 2-space indent and trailing newline', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: '0.1.0' }));

    syncManifestVersion(dir);

    const raw = readFileSync(join(dir, 'manifest.json'), 'utf8');
    expect(raw).toContain('  "version"');
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('throws if package.json is missing', () => {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: '0.1.0' }));

    expect(() => syncManifestVersion(dir)).toThrow('package.json');
  });

  it('throws if manifest.json is missing', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }));

    expect(() => syncManifestVersion(dir)).toThrow('manifest.json');
  });

  it('throws if package.json has no version field', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: '0.1.0' }));

    expect(() => syncManifestVersion(dir)).toThrow('version');
  });
});
