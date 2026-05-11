import { describe, it, expect } from 'vitest';
import { getSdkInjectionScript, SDK_BINDING_NAME } from './sdk-injector.js';

describe('SDK Injector', () => {
  it('exports the binding name', () => {
    expect(SDK_BINDING_NAME).toBe('__wolfcolaBridge');
  });

  it('returns injection script as string', () => {
    const script = getSdkInjectionScript();
    expect(script).toContain('__pingDevtools');
    expect(script).toContain('__wolfcolaBridge');
  });
});
