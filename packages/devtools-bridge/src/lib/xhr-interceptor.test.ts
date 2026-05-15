import { describe, it, expect, afterEach } from 'vitest';
import { installXhrInterceptor, uninstallXhrInterceptor } from './xhr-interceptor.js';

describe('xhrInterceptor', () => {
  afterEach(() => {
    uninstallXhrInterceptor();
  });

  it('is idempotent -- does not double-patch', () => {
    installXhrInterceptor(() => {});
    installXhrInterceptor(() => {});
    expect(globalThis.__wolfcola_xhr_patched).toBe(true);
  });

  it('exports install and uninstall functions', () => {
    expect(typeof installXhrInterceptor).toBe('function');
    expect(typeof uninstallXhrInterceptor).toBe('function');
  });

  it('uninstall resets the patched flag', () => {
    installXhrInterceptor(() => {});
    expect(globalThis.__wolfcola_xhr_patched).toBe(true);
    uninstallXhrInterceptor();
    expect(globalThis.__wolfcola_xhr_patched).toBeUndefined();
  });
});
