import { Effect } from 'effect';
import {
  redactFlowState,
  renderFlowMarkdown,
  runDiagnosis,
  serializeDiagnosis,
} from '@wolfcola/devtools-core';
import type { SessionManagerShape } from '../session-manager.js';
import type { ExtendedFlowState } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';

export function createMcpTools(mgr: SessionManagerShape) {
  async function getState(sessionId: string): Promise<ExtendedFlowState | null> {
    const result = await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'GET_STATE' }));
    return result as ExtendedFlowState | null;
  }

  return {
    'list-sessions': async () => {
      const sessions = await Effect.runPromise(mgr.list());
      return sessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        connectedAt: s.connectedAt,
        clearOnReconnect: s.clearOnReconnect,
      }));
    },

    'get-events': async (
      sessionId: string,
      filters?: { type?: string; from?: number; to?: number },
    ) => {
      const state = await getState(sessionId);
      if (!state) return [];
      let events = state.events;
      if (filters?.type) events = events.filter((e) => e.type === filters.type);
      if (filters?.from) events = events.filter((e) => e.timestamp >= filters.from!);
      if (filters?.to) events = events.filter((e) => e.timestamp <= filters.to!);
      return events;
    },

    'get-flow-summary': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      return state.summary;
    },

    'get-diagnosis': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      const diagnosis = runDiagnosis(state.events);
      return serializeDiagnosis(diagnosis);
    },

    'get-event-detail': async (sessionId: string, eventId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      return state.events.find((e) => e.id === eventId) ?? null;
    },

    'search-events': async (
      sessionId: string,
      query: { urlPattern?: string; errorOnly?: boolean; oidcPhase?: string },
    ) => {
      const state = await getState(sessionId);
      if (!state) return [];
      return state.events.filter((e: AuthEvent) => {
        if (query.errorOnly && !e.flags.isError) return false;
        if (query.urlPattern && e.data._tag === 'network') {
          try {
            if (!new RegExp(query.urlPattern).test(e.data.url)) return false;
          } catch {
            if (!e.data.url.includes(query.urlPattern)) return false;
          }
        }
        if (query.oidcPhase && e.oidcSemantics?.oidcPhase !== query.oidcPhase) return false;
        return true;
      });
    },

    'clear-flow': async (sessionId: string) => {
      await Effect.runPromise(mgr.handleMessage(sessionId, { type: 'CLEAR' }));
    },

    'switch-session': async () => {
      return { switched: true };
    },

    'export-json': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      return JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), redacted: true, flow: redacted },
        null,
        2,
      );
    },

    'export-markdown': async (sessionId: string) => {
      const state = await getState(sessionId);
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      const diagnosis = runDiagnosis((redacted as { events: never[] }).events);
      return renderFlowMarkdown(redacted as never, diagnosis);
    },

    'set-clear-on-reconnect': async (sessionId: string, value: boolean) => {
      await Effect.runPromise(mgr.setClearOnReconnect(sessionId, value));
    },
  };
}
