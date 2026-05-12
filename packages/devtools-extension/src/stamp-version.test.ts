import { describe, it, expect } from 'vitest';
import { stampVersion } from './stamp-version.js';

describe('stampVersion', () => {
  it('appends build number 0 for local dev', () => {
    const result = stampVersion('0.1.0', 0, false);
    expect(result).toEqual({ version: '0.1.0.0' });
  });

  it('appends build number and snapshot version_name', () => {
    const result = stampVersion('0.1.0', 23, true);
    expect(result).toEqual({
      version: '0.1.0.23',
      version_name: '0.1.0-snapshot.23',
    });
  });

  it('appends build number and release version_name', () => {
    const result = stampVersion('0.2.0', 24, false);
    expect(result).toEqual({
      version: '0.2.0.24',
      version_name: '0.2.0',
    });
  });

  it('handles max valid build number (65535)', () => {
    const result = stampVersion('1.0.0', 65535, false);
    expect(result).toEqual({
      version: '1.0.0.65535',
      version_name: '1.0.0',
    });
  });

  it('throws when build number exceeds 65535', () => {
    expect(() => stampVersion('1.0.0', 65536, false)).toThrow(
      'BUILD_NUMBER 65536 exceeds Chrome max of 65535',
    );
  });

  it('throws for negative build number', () => {
    expect(() => stampVersion('1.0.0', -1, false)).toThrow('BUILD_NUMBER -1 must be >= 0');
  });

  it('does not set version_name when build number is 0', () => {
    const result = stampVersion('0.1.0', 0, false);
    expect(result).not.toHaveProperty('version_name');
  });

  it('does not set version_name when build number is 0 even with snapshot flag', () => {
    const result = stampVersion('0.1.0', 0, true);
    expect(result).not.toHaveProperty('version_name');
  });
});
