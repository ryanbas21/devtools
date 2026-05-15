import { Tool, Toolkit } from '@effect/ai';
import { Effect, Schema } from 'effect';
import { redactFlowState, runDiagnosis, serializeDiagnosis } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';
import { SessionManager } from '../session-manager.js';
import { exportAsJson, exportAsMarkdown } from '../export-helpers.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function matchesUrlPattern(url: string, pattern: string): boolean {
  if (pattern.length > 200) return url.includes(pattern);
  try {
    return new RegExp(pattern).test(url);
  } catch {
    return url.includes(pattern);
  }
}

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

// toLayer accepts an Effect that produces handlers. By yielding SessionManager
// here, we close over `mgr` — the individual handlers have R = never.
export const WolfcolaToolkitLive = WolfcolaToolkit.toLayer(
  Effect.gen(function* () {
    const mgr = yield* SessionManager;

    return {
      'list-sessions': () =>
        mgr.list().pipe(
          Effect.map((sessions) =>
            sessions.map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
              connectedAt: s.connectedAt,
              clearOnReconnect: s.clearOnReconnect,
            })),
          ),
        ),

      'get-events': ({ sessionId, type, from, to }) =>
        mgr.getState(sessionId).pipe(
          Effect.map((state) => {
            if (!state) return [];
            const redacted = redactFlowState(state);
            let events = redacted.events;
            if (type) events = events.filter((e) => e.type === type);
            if (from !== undefined) events = events.filter((e) => e.timestamp >= from);
            if (to !== undefined) events = events.filter((e) => e.timestamp <= to);
            return events;
          }),
        ),

      'get-flow-summary': ({ sessionId }) =>
        mgr.getState(sessionId).pipe(Effect.map((state) => (state ? state.summary : null))),

      'get-diagnosis': ({ sessionId }) =>
        mgr.getState(sessionId).pipe(
          Effect.map((state) => {
            if (!state) return null;
            return serializeDiagnosis(runDiagnosis(state.events));
          }),
        ),

      'get-event-detail': ({ sessionId, eventId }) =>
        mgr.getState(sessionId).pipe(
          Effect.map((state) => {
            if (!state) return null;
            const redacted = redactFlowState(state);
            return redacted.events.find((e) => e.id === eventId) ?? null;
          }),
        ),

      'search-events': ({ sessionId, urlPattern, errorOnly, oidcPhase }) =>
        mgr.getState(sessionId).pipe(
          Effect.map((state) => {
            if (!state) return [];
            const redacted = redactFlowState(state);
            return redacted.events.filter((e: AuthEvent) => {
              if (errorOnly && !e.flags.isError) return false;
              if (
                urlPattern &&
                e.data._tag === 'network' &&
                !matchesUrlPattern(e.data.url, urlPattern)
              )
                return false;
              if (oidcPhase && e.oidcSemantics?.oidcPhase !== oidcPhase) return false;
              return true;
            });
          }),
        ),

      'clear-flow': ({ sessionId }) =>
        mgr.clearSession(sessionId).pipe(Effect.map(() => ({ cleared: true }))),

      'export-json': ({ sessionId }) =>
        mgr.getState(sessionId).pipe(Effect.map((state) => (state ? exportAsJson(state) : null))),

      'export-markdown': ({ sessionId }) =>
        mgr
          .getState(sessionId)
          .pipe(Effect.map((state) => (state ? exportAsMarkdown(state) : null))),

      'set-clear-on-reconnect': ({ sessionId, value }) =>
        mgr.setClearOnReconnect(sessionId, value).pipe(Effect.map(() => ({ updated: true }))),
    };
  }),
);
