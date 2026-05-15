import { describe, it, expect, vi } from 'vitest';
import { IPC_CHANNELS, createIpcHandlers } from './ipc-bridge.js';

describe('IPC_CHANNELS', () => {
  it('defines all expected channel names', () => {
    expect(IPC_CHANNELS.EVENT).toBe('wolfcola:event');
    expect(IPC_CHANNELS.DIAGNOSIS).toBe('wolfcola:diagnosis');
    expect(IPC_CHANNELS.SESSIONS).toBe('wolfcola:sessions');
    expect(IPC_CHANNELS.SWITCH_SESSION).toBe('wolfcola:switch-session');
    expect(IPC_CHANNELS.CLEAR_FLOW).toBe('wolfcola:clear-flow');
    expect(IPC_CHANNELS.EXPORT_JSON).toBe('wolfcola:export-json');
    expect(IPC_CHANNELS.EXPORT_MARKDOWN).toBe('wolfcola:export-markdown');
    expect(IPC_CHANNELS.SET_CLEAR_ON_RECONNECT).toBe('wolfcola:set-clear-on-reconnect');
  });
});

describe('createIpcHandlers', () => {
  it('returns handler functions for all channels', () => {
    const mockSessionManager = {
      list: vi.fn(),
      handleMessage: vi.fn(),
      setClearOnReconnect: vi.fn(),
      getSession: vi.fn(),
    };
    const handlers = createIpcHandlers(mockSessionManager as never);
    expect(handlers[IPC_CHANNELS.SESSIONS]).toBeDefined();
    expect(handlers[IPC_CHANNELS.CLEAR_FLOW]).toBeDefined();
    expect(handlers[IPC_CHANNELS.EXPORT_JSON]).toBeDefined();
    expect(handlers[IPC_CHANNELS.EXPORT_MARKDOWN]).toBeDefined();
    expect(handlers[IPC_CHANNELS.SET_CLEAR_ON_RECONNECT]).toBeDefined();
  });
});
