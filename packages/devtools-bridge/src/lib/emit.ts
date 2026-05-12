import type { AuthEvent } from '@wolfcola/devtools-types';

export const DEVTOOLS_EVENT_NAME = 'pingDevtools';

export interface DevtoolsOptions {
  consoleLog?: boolean;
}

export interface BridgeHandle {
  detach: () => void;
}

declare global {
  interface Window {
    __PING_DEVTOOLS_STATE__?: AuthEvent[];
  }
}

const MAX_STATE_ENTRIES = 500;

export function emitAuthEvent(event: AuthEvent, options?: DevtoolsOptions): void {
  if (typeof window === 'undefined') return;

  if (!window.__PING_DEVTOOLS_STATE__) {
    window.__PING_DEVTOOLS_STATE__ = [];
  }
  window.__PING_DEVTOOLS_STATE__.push(event);
  if (window.__PING_DEVTOOLS_STATE__.length > MAX_STATE_ENTRIES) {
    window.__PING_DEVTOOLS_STATE__.splice(
      0,
      window.__PING_DEVTOOLS_STATE__.length - MAX_STATE_ENTRIES,
    );
  }

  if (options?.consoleLog) {
    console.log('[ping-devtools]', event.type, event);
  }

  window.dispatchEvent(new CustomEvent(DEVTOOLS_EVENT_NAME, { detail: event }));
}

export function emitConfigEvent(config: object, options?: DevtoolsOptions): void {
  emitAuthEvent(
    {
      id: crypto.randomUUID(),
      timestamp: performance.now(),
      type: 'sdk:config',
      source: 'sdk',
      flowId: null,
      causedBy: null,
      data: { _tag: 'sdk-config', config },
      flags: { isCors: false, isError: false, isAuthRelated: true },
    },
    options,
  );
}
