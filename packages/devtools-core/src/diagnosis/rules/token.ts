import type { AuthEvent } from '@wolfcola/devtools-types';
import type { IssueCandidate } from './types.js';

export function collectTokenIssues(events: readonly AuthEvent[]): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];

  const sdkNodeEvents = events.filter((e) => e.type === 'sdk:node-change');

  // Missing interactionToken on non-first sdk:node-change
  if (sdkNodeEvents.length > 1) {
    for (const event of sdkNodeEvents.slice(1)) {
      if (event.data._tag !== 'sdk') continue;
      if (!event.data.interactionToken) {
        candidates.push({
          dedupKey: `token:missing-interaction-token:${event.id}`,
          eventId: event.id,
          issue: {
            id: 'token:missing-interaction-token',
            severity: 'warning',
            category: 'token',
            title: 'Missing interaction token',
            description: 'interactionToken was absent on a node transition that required it.',
            steps: [
              'Check SDK initialization — do not cache or reuse stale tokens across flows.',
              'Ensure each flow starts fresh rather than resuming an expired interaction.',
            ],
          },
        });
      }
    }
  }

  // Session error codes
  for (const event of events) {
    if (event.data._tag !== 'sdk') continue;
    const errorCode = event.data.error?.code ?? '';
    if (errorCode.includes('SESSION_NOT_FOUND') || errorCode.includes('INVALID_SESSION')) {
      candidates.push({
        dedupKey: `token:session-not-found`,
        eventId: event.id,
        issue: {
          id: 'token:session-not-found',
          severity: 'error',
          category: 'token',
          title: 'Session not found',
          description: 'The session referenced by this flow no longer exists on the server.',
          steps: [
            'Session may have expired — reinitialize the SDK.',
            'Avoid persisting flowId or interactionId across page reloads without validation.',
          ],
          relevantData: { 'error-code': errorCode },
        },
      });
    }
  }

  return candidates;
}
