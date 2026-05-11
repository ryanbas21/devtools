import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  TreeItem: class {
    label: string;
    constructor(label: string) {
      this.label = label;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
  },
  ThemeIcon: class {
    constructor(public id: string) {}
  },
}));

import { TimelineTreeProvider } from './timeline-tree.js';
import type { AuthEvent } from '@wolfcola/devtools-types';

const makeNetworkEvent = (overrides: Partial<AuthEvent> = {}): AuthEvent => ({
  id: 'e1',
  timestamp: Date.now(),
  type: 'network:response',
  source: 'network',
  flowId: null,
  causedBy: null,
  data: {
    _tag: 'network',
    url: 'https://auth.example.com/authorize',
    method: 'GET',
    status: 200,
    requestHeaders: {},
    responseHeaders: {},
    duration: 120,
  },
  flags: { isCors: false, isError: false, isAuthRelated: true },
  ...overrides,
});

describe('TimelineTreeProvider', () => {
  it('starts with no events', () => {
    const provider = new TimelineTreeProvider();
    expect(provider.getChildren()).toHaveLength(0);
  });

  it('adds events and returns tree items', () => {
    const provider = new TimelineTreeProvider();
    provider.addEvent(makeNetworkEvent());
    const children = provider.getChildren();
    expect(children).toHaveLength(1);
  });

  it('clears events', () => {
    const provider = new TimelineTreeProvider();
    provider.addEvent(makeNetworkEvent());
    provider.clear();
    expect(provider.getChildren()).toHaveLength(0);
  });

  it('tracks event count', () => {
    const provider = new TimelineTreeProvider();
    provider.addEvent(makeNetworkEvent());
    provider.addEvent(makeNetworkEvent({ id: 'e2' }));
    expect(provider.eventCount).toBe(2);
  });

  it('returns copy of events via getEvents', () => {
    const provider = new TimelineTreeProvider();
    const event = makeNetworkEvent();
    provider.addEvent(event);
    const events = provider.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBe(event);
    // Verify it's a copy
    events.pop();
    expect(provider.getEvents()).toHaveLength(1);
  });
});
