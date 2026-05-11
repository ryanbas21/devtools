import { describe, it, expect } from 'vitest';
import { buildChromeArgs } from './chrome-launcher.js';

describe('buildChromeArgs', () => {
  it('includes remote debugging port', () => {
    const args = buildChromeArgs({ port: 9222, url: 'http://localhost:3000' });
    expect(args).toContain('--remote-debugging-port=9222');
  });

  it('includes the URL', () => {
    const args = buildChromeArgs({ port: 9222, url: 'http://localhost:3000' });
    expect(args).toContain('http://localhost:3000');
  });

  it('uses a unique user data dir', () => {
    const args = buildChromeArgs({ port: 9222, url: 'http://localhost:3000' });
    expect(args.some((a) => a.startsWith('--user-data-dir='))).toBe(true);
  });
});
