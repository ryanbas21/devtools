import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachDaVinciBridge } from './davinci-bridge.js';
import { attachJourneyBridge } from './journey-bridge.js';
import { attachOidcBridge } from './oidc-bridge.js';
import { DEVTOOLS_EVENT_NAME } from './emit.js';
import type { AuthEvent } from '@wolfcola/devtools-types';

// ---------------------------------------------------------------------------
// Mock client factories
// ---------------------------------------------------------------------------

function makeDaVinciClient(initialNode: Record<string, unknown>) {
  let listener: (() => void) | null = null;
  let node = initialNode;
  return {
    subscribe: vi.fn((cb: () => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    getNode: vi.fn(() => node),
    trigger: (newNode: Record<string, unknown>) => {
      node = newNode;
      listener?.();
    },
  };
}

type JourneyState = {
  journeyReducer: {
    mutations: Record<
      string,
      { status: string; endpointName?: string; data?: unknown; error?: unknown }
    >;
  };
};

function makeJourneyClient(initialState: JourneyState) {
  let listener: (() => void) | null = null;
  let state = initialState;
  return {
    subscribe: vi.fn((cb: () => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    getState: vi.fn(() => state),
    trigger: (newState: JourneyState) => {
      state = newState;
      listener?.();
    },
  };
}

type OidcState = {
  oidc: {
    mutations: Record<
      string,
      { status: string; endpointName?: string; data?: unknown; error?: unknown }
    >;
  };
};

function makeOidcClient(initialState: OidcState) {
  let listener: (() => void) | null = null;
  let state = initialState;
  return {
    subscribe: vi.fn((cb: () => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    getState: vi.fn(() => state),
    trigger: (newState: OidcState) => {
      state = newState;
      listener?.();
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captureDevtoolsEvents(): { events: CustomEvent<AuthEvent>[]; stop: () => void } {
  const events: CustomEvent<AuthEvent>[] = [];
  const handler = (e: Event) => events.push(e as CustomEvent<AuthEvent>);
  window.addEventListener(DEVTOOLS_EVENT_NAME, handler);
  return { events, stop: () => window.removeEventListener(DEVTOOLS_EVENT_NAME, handler) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multi-bridge coexistence', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>)['__PING_DEVTOOLS_EXTENSION__'] = true;
  });

  afterEach(async () => {
    delete (window as unknown as Record<string, unknown>)['__PING_DEVTOOLS_EXTENSION__'];
    await new Promise((r) => setTimeout(r, 10));
  });

  it('all three bridges emit events independently on the same event bus', () => {
    const davinciClient = makeDaVinciClient({ status: 'start' });
    const journeyClient = makeJourneyClient({ journeyReducer: { mutations: {} } });
    const oidcClient = makeOidcClient({ oidc: { mutations: {} } });
    const { events, stop } = captureDevtoolsEvents();

    const h1 = attachDaVinciBridge(davinciClient);
    const h2 = attachJourneyBridge(journeyClient);
    const h3 = attachOidcBridge(oidcClient);

    davinciClient.trigger({ status: 'continue' });
    journeyClient.trigger({
      journeyReducer: {
        mutations: {
          'j-1': { status: 'fulfilled', data: { authId: 'abc' } },
        },
      },
    });
    oidcClient.trigger({
      oidc: {
        mutations: {
          'o-1': { status: 'fulfilled', endpointName: 'exchange' },
        },
      },
    });

    h1.detach();
    h2.detach();
    h3.detach();
    stop();

    const types = events.map((e) => e.detail.type);
    expect(types).toContain('sdk:node-change');
    expect(types).toContain('sdk:journey-step');
    expect(types).toContain('sdk:oidc-state');
    expect(events).toHaveLength(3);
  });

  it('detaching one bridge does not affect the others', () => {
    const davinciClient = makeDaVinciClient({ status: 'start' });
    const journeyClient = makeJourneyClient({ journeyReducer: { mutations: {} } });
    const { events, stop } = captureDevtoolsEvents();

    const h1 = attachDaVinciBridge(davinciClient);
    const h2 = attachJourneyBridge(journeyClient);

    // Detach DaVinci bridge
    h1.detach();

    // DaVinci events should stop
    davinciClient.trigger({ status: 'continue' });

    // Journey events should still work
    journeyClient.trigger({
      journeyReducer: {
        mutations: {
          'j-1': { status: 'fulfilled', data: { authId: 'abc' } },
        },
      },
    });

    h2.detach();
    stop();

    expect(events).toHaveLength(1);
    expect(events[0].detail.type).toBe('sdk:journey-step');
  });

  it('each bridge emits its own sdk:config independently', () => {
    const davinciClient = makeDaVinciClient({ status: 'start' });
    const journeyClient = makeJourneyClient({ journeyReducer: { mutations: {} } });
    const oidcClient = makeOidcClient({ oidc: { mutations: {} } });
    const { events, stop } = captureDevtoolsEvents();

    const h1 = attachDaVinciBridge(davinciClient, { clientId: 'davinci-app' });
    const h2 = attachJourneyBridge(journeyClient, { realm: '/alpha' });
    const h3 = attachOidcBridge(oidcClient, { clientId: 'oidc-app' });

    davinciClient.trigger({ status: 'continue' });
    journeyClient.trigger({
      journeyReducer: {
        mutations: {
          'j-1': { status: 'fulfilled', data: { authId: 'abc' } },
        },
      },
    });
    oidcClient.trigger({
      oidc: {
        mutations: {
          'o-1': { status: 'fulfilled', endpointName: 'exchange' },
        },
      },
    });

    h1.detach();
    h2.detach();
    h3.detach();
    stop();

    const configEvents = events.filter((e) => e.detail.type === 'sdk:config');
    expect(configEvents).toHaveLength(3);

    const configs = configEvents.map(
      (e) => (e.detail.data as { _tag: string; config: Record<string, unknown> }).config,
    );
    expect(configs).toContainEqual({ clientId: 'davinci-app' });
    expect(configs).toContainEqual({ realm: '/alpha' });
    expect(configs).toContainEqual({ clientId: 'oidc-app' });
  });
});
