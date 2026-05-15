import { Effect } from 'effect';
import { redactFlowState, renderFlowMarkdown, runDiagnosis } from '@wolfcola/devtools-core';
import type { SessionManagerShape } from './session-manager.js';

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

    [IPC_CHANNELS.CLEAR_FLOW]: (sessionId: string) =>
      Effect.runPromise(mgr.handleMessage(sessionId, { type: 'CLEAR' })),

    [IPC_CHANNELS.EXPORT_JSON]: async (sessionId: string) => {
      const state = await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'GET_STATE' }));
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      return JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), redacted: true, flow: redacted },
        null,
        2,
      );
    },

    [IPC_CHANNELS.EXPORT_MARKDOWN]: async (sessionId: string) => {
      const state = await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'GET_STATE' }));
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      const diagnosis = runDiagnosis((redacted as { events: never[] }).events);
      return renderFlowMarkdown(redacted as never, diagnosis);
    },

    [IPC_CHANNELS.SET_CLEAR_ON_RECONNECT]: (sessionId: string, value: boolean) =>
      Effect.runPromise(mgr.setClearOnReconnect(sessionId, value)),
  };
}
