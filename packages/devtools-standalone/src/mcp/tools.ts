import { Tool, Toolkit } from '@effect/ai';
import { Effect, Schema } from 'effect';
import {
  redactFlowState,
  renderFlowMarkdown,
  runDiagnosis,
  serializeDiagnosis,
} from '@wolfcola/devtools-core';
import type { ExtendedFlowState } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';
import { SessionManager } from '../session-manager.js';

// ── Tool Definitions ────────────────────────────────────────────────────────

export const ListSessions = Tool.make('list-sessions', {
  description: 'List all connected/disconnected OIDC debugging sessions',
  success: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      status: Schema.Literal('connected', 'disconnected'),
      connectedAt: Schema.String,
      clearOnReconnect: Schema.Boolean,
    }),
  ),
});

export const GetEvents = Tool.make('get-events', {
  description:
    'Get all events for a debugging session, with optional filters by type or time range',
  parameters: {
    sessionId: Schema.String,
    type: Schema.optional(Schema.String),
    from: Schema.optional(Schema.Number),
    to: Schema.optional(Schema.Number),
  },
  success: Schema.Unknown,
});

export const GetFlowSummary = Tool.make('get-flow-summary', {
  description: 'Get the flow summary for a session (node count, error count, CORS flags, duration)',
  parameters: { sessionId: Schema.String },
  success: Schema.Unknown,
});

export const GetDiagnosis = Tool.make('get-diagnosis', {
  description: 'Get the latest diagnosis results for a session',
  parameters: { sessionId: Schema.String },
  success: Schema.Unknown,
});

export const GetEventDetail = Tool.make('get-event-detail', {
  description: 'Get full detail for a specific event by ID (headers, body, OIDC semantics)',
  parameters: { sessionId: Schema.String, eventId: Schema.String },
  success: Schema.Unknown,
});

export const SearchEvents = Tool.make('search-events', {
  description: 'Search events by URL pattern, error status, or OIDC phase',
  parameters: {
    sessionId: Schema.String,
    urlPattern: Schema.optional(Schema.String),
    errorOnly: Schema.optional(Schema.Boolean),
    oidcPhase: Schema.optional(Schema.String),
  },
  success: Schema.Unknown,
});

export const ClearFlow = Tool.make('clear-flow', {
  description: 'Clear all events in a session',
  parameters: { sessionId: Schema.String },
  success: Schema.Struct({ cleared: Schema.Boolean }),
});

export const ExportJson = Tool.make('export-json', {
  description: "Export a session's flow state as redacted JSON",
  parameters: { sessionId: Schema.String },
  success: Schema.NullOr(Schema.String),
});

export const ExportMarkdown = Tool.make('export-markdown', {
  description: "Export a session's flow state as redacted Markdown",
  parameters: { sessionId: Schema.String },
  success: Schema.NullOr(Schema.String),
});

export const SetClearOnReconnect = Tool.make('set-clear-on-reconnect', {
  description: 'Toggle the "Clear on reconnect" setting for a session',
  parameters: { sessionId: Schema.String, value: Schema.Boolean },
  success: Schema.Struct({ updated: Schema.Boolean }),
});

// ── Toolkit ─────────────────────────────────────────────────────────────────

export const WolfcolaToolkit = Toolkit.make(
  ListSessions,
  GetEvents,
  GetFlowSummary,
  GetDiagnosis,
  GetEventDetail,
  SearchEvents,
  ClearFlow,
  ExportJson,
  ExportMarkdown,
  SetClearOnReconnect,
);

// ── Handlers ────────────────────────────────────────────────────────────────

function getState(sessionId: string) {
  return Effect.gen(function* () {
    const mgr = yield* SessionManager;
    const result = yield* mgr.handleMessage(sessionId, { type: 'GET_STATE' });
    return result as ExtendedFlowState | null;
  });
}

export const WolfcolaToolkitLive = WolfcolaToolkit.toLayer({
  'list-sessions': () =>
    Effect.gen(function* () {
      const mgr = yield* SessionManager;
      const sessions = yield* mgr.list();
      return sessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        connectedAt: s.connectedAt,
        clearOnReconnect: s.clearOnReconnect,
      }));
    }),

  'get-events': ({ sessionId, type, from, to }) =>
    Effect.gen(function* () {
      const state = yield* getState(sessionId);
      if (!state) return [];
      let events = state.events;
      if (type) events = events.filter((e) => e.type === type);
      if (from !== undefined) events = events.filter((e) => e.timestamp >= from);
      if (to !== undefined) events = events.filter((e) => e.timestamp <= to);
      return events;
    }),

  'get-flow-summary': ({ sessionId }) =>
    Effect.gen(function* () {
      const state = yield* getState(sessionId);
      if (!state) return null;
      return state.summary;
    }),

  'get-diagnosis': ({ sessionId }) =>
    Effect.gen(function* () {
      const state = yield* getState(sessionId);
      if (!state) return null;
      const diagnosis = runDiagnosis(state.events);
      return serializeDiagnosis(diagnosis);
    }),

  'get-event-detail': ({ sessionId, eventId }) =>
    Effect.gen(function* () {
      const state = yield* getState(sessionId);
      if (!state) return null;
      return state.events.find((e) => e.id === eventId) ?? null;
    }),

  'search-events': ({ sessionId, urlPattern, errorOnly, oidcPhase }) =>
    Effect.gen(function* () {
      const state = yield* getState(sessionId);
      if (!state) return [];
      return state.events.filter((e: AuthEvent) => {
        if (errorOnly && !e.flags.isError) return false;
        if (urlPattern && e.data._tag === 'network') {
          if (urlPattern.length > 200) {
            if (!e.data.url.includes(urlPattern)) return false;
          } else {
            try {
              if (!new RegExp(urlPattern).test(e.data.url)) return false;
            } catch {
              if (!e.data.url.includes(urlPattern)) return false;
            }
          }
        }
        if (oidcPhase && e.oidcSemantics?.oidcPhase !== oidcPhase) return false;
        return true;
      });
    }),

  'clear-flow': ({ sessionId }) =>
    Effect.gen(function* () {
      const mgr = yield* SessionManager;
      yield* mgr.handleMessage(sessionId, { type: 'CLEAR' });
      return { cleared: true };
    }),

  'export-json': ({ sessionId }) =>
    Effect.gen(function* () {
      const state = yield* getState(sessionId);
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      return JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), redacted: true, flow: redacted },
        null,
        2,
      );
    }),

  'export-markdown': ({ sessionId }) =>
    Effect.gen(function* () {
      const state = yield* getState(sessionId);
      if (!state) return null;
      const redacted = redactFlowState(state as never);
      const diagnosis = runDiagnosis((redacted as { events: never[] }).events);
      return renderFlowMarkdown(redacted as never, diagnosis);
    }),

  'set-clear-on-reconnect': ({ sessionId, value }) =>
    Effect.gen(function* () {
      const mgr = yield* SessionManager;
      yield* mgr.setClearOnReconnect(sessionId, value);
      return { updated: true };
    }),
});
