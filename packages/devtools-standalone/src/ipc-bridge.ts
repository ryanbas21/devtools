import { Effect } from 'effect';
import type { SessionManagerShape } from './session-manager.js';
import { exportAsJson, exportAsMarkdown } from '@wolfcola/devtools-core';

export const IPC_CHANNELS = {
  EVENT: 'wolfcola:event',
  DIAGNOSIS: 'wolfcola:diagnosis',
  SESSIONS: 'wolfcola:sessions',
  SWITCH_SESSION: 'wolfcola:switch-session',
  CLEAR_FLOW: 'wolfcola:clear-flow',
  EXPORT_JSON: 'wolfcola:export-json',
  EXPORT_MARKDOWN: 'wolfcola:export-markdown',
  SET_CLEAR_ON_RECONNECT: 'wolfcola:set-clear-on-reconnect',
} as const;

export function createIpcHandlers(mgr: SessionManagerShape) {
  return {
    [IPC_CHANNELS.SESSIONS]: () => Effect.runPromise(mgr.list()),

    [IPC_CHANNELS.SWITCH_SESSION]: (sessionId: string) =>
      Effect.runPromise(mgr.getSession(sessionId)),

    [IPC_CHANNELS.CLEAR_FLOW]: (sessionId: string) =>
      Effect.runPromise(mgr.clearSession(sessionId)),

    [IPC_CHANNELS.EXPORT_JSON]: async (sessionId: string) => {
      const state = await Effect.runPromise(mgr.getState(sessionId));
      if (!state) return null;
      return exportAsJson(state);
    },

    [IPC_CHANNELS.EXPORT_MARKDOWN]: async (sessionId: string) => {
      const state = await Effect.runPromise(mgr.getState(sessionId));
      if (!state) return null;
      return exportAsMarkdown(state);
    },

    [IPC_CHANNELS.SET_CLEAR_ON_RECONNECT]: (sessionId: string, value: boolean) =>
      Effect.runPromise(mgr.setClearOnReconnect(sessionId, value)),
  };
}
