import type { AuthEvent } from '@wolfcola/devtools-types';
import { decodeJwtPayload, findExpiredJwtsInHeaders } from '../annotators/jwt-utils.js';
import { collectCorsIssues } from './rules/cors.js';
import { collectTokenIssues } from './rules/token.js';
import { collectFlowConfigIssues } from './rules/flow-config.js';
import { collectOidcIssues } from './rules/oidc.js';
import { collectOidcFlowIssues } from './rules/oidc-flow.js';
import { collectDpopIssues } from './rules/dpop.js';
import { collectParIssues } from './rules/par.js';
import type { FlowRule, IssueCandidate, FlowIssue, EventIssue, Severity } from './rules/types.js';

// Re-export types so existing consumers don't break
export type {
  Severity,
  DiagnosisCategory,
  FlowIssue,
  EventIssue,
  IssueCandidate,
  FlowRule,
} from './rules/types.js';

export interface DiagnosisResult {
  issues: FlowIssue[];
  annotatedEvents: Map<string, EventIssue[]>;
  flowHealth: 'healthy' | 'warning' | 'error';
}

// ─── Rule registry ───────────────────────────────────────────────────────────

const flowRules: FlowRule[] = [
  collectCorsIssues,
  collectTokenIssues,
  collectFlowConfigIssues,
  collectOidcIssues,
  collectOidcFlowIssues,
  collectDpopIssues,
  collectParIssues,
];

// ─── Deduplication helper ────────────────────────────────────────────────────

function mergeByDedupKey(candidates: IssueCandidate[]): FlowIssue[] {
  const merged = new Map<string, FlowIssue>();
  for (const { dedupKey, eventId, issue } of candidates) {
    const existing = merged.get(dedupKey);
    if (existing) {
      merged.set(dedupKey, {
        ...existing,
        relatedEventIds: [...existing.relatedEventIds, eventId],
      });
    } else {
      merged.set(dedupKey, { ...issue, relatedEventIds: [eventId] });
    }
  }
  return [...merged.values()];
}

// ─── Public API ──────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function runFlowRules(events: readonly AuthEvent[]): FlowIssue[] {
  const candidates = flowRules.flatMap((rule) => rule(events));

  return mergeByDedupKey(candidates).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

export function runEventRules(event: AuthEvent, allEvents: readonly AuthEvent[]): EventIssue[] {
  const issues: EventIssue[] = [];

  if (event.data._tag === 'network') {
    const { data } = event;

    if (data.status === 0 && event.flags.isCors) {
      const origin = data.requestHeaders['origin'] ?? '';
      issues.push({
        severity: 'error',
        title: 'Network failure (status 0)',
        description:
          'The request never reached the server. This is almost always a CORS preflight rejection.',
        steps: [
          `Your AS must include this origin in allowed origins: ${origin || '(unknown)'}`,
          'If using credentials, wildcard (*) is not allowed.',
          'Check the OPTIONS preflight in the Network tab.',
        ],
        relevantData: {
          'access-control-allow-origin':
            data.responseHeaders['access-control-allow-origin'] ?? '(not present)',
          'access-control-allow-credentials':
            data.responseHeaders['access-control-allow-credentials'] ?? '(not present)',
        },
      });
    }

    // Expired JWT in request headers
    const expiredJwts = findExpiredJwtsInHeaders(data.requestHeaders);
    for (const token of expiredJwts) {
      const payload = decodeJwtPayload(token);
      const exp = payload && typeof payload['exp'] === 'number' ? payload['exp'] : null;
      issues.push({
        severity: 'error',
        title: 'Token expired',
        description: 'A JWT in the request headers has an expired exp claim.',
        steps: ['Restart the flow to obtain a fresh token.', 'Check your SDK token refresh logic.'],
        relevantData: exp ? { exp: new Date(exp * 1000).toISOString() } : undefined,
      });
    }

    const hasOriginHeader = 'origin' in data.requestHeaders;
    const allowOrigin = data.responseHeaders['access-control-allow-origin'] ?? '';
    if (hasOriginHeader && !allowOrigin && data.status !== 0 && event.flags.isCors) {
      issues.push({
        severity: 'error',
        title: 'Missing CORS header',
        description: 'The server response is missing Access-Control-Allow-Origin.',
        steps: [`Add ${data.requestHeaders['origin']} to allowed origins on your auth server.`],
        relevantData: { 'missing-header': 'access-control-allow-origin' },
      });
    }
  }

  if (event.data._tag === 'sdk') {
    const { data } = event;
    if (data.nodeStatus === 'error' || data.nodeStatus === 'failure') {
      const nodeName = data.nodeName ?? '';
      issues.push({
        severity: 'error',
        title: nodeName ? `Node error: ${nodeName}` : 'Node error',
        description: `Node returned status "${data.nodeStatus}".`,
        steps: [
          'Check DaVinci connector configuration.',
          'Review the error code in the SDK State tab.',
        ],
        relevantData: data.error
          ? { code: data.error.code, message: data.error.message }
          : undefined,
      });
    }
  }

  // Suppress unused-parameter warning — allEvents available for future cross-event per-event rules
  void allEvents;

  return issues;
}

export function runDiagnosis(events: readonly AuthEvent[]): DiagnosisResult {
  const issues = runFlowRules(events);

  const annotatedEvents = new Map<string, EventIssue[]>();
  for (const event of events) {
    const eventIssues = runEventRules(event, events);
    if (eventIssues.length > 0) {
      annotatedEvents.set(event.id, eventIssues);
    }
  }

  const flowHealth = issues.some((i) => i.severity === 'error')
    ? 'error'
    : issues.some((i) => i.severity === 'warning')
      ? 'warning'
      : 'healthy';

  return { issues, annotatedEvents, flowHealth };
}
