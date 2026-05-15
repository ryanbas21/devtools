import type { AuthEvent } from '@wolfcola/devtools-types';
import type { IssueCandidate } from './types.js';

export function collectParIssues(events: readonly AuthEvent[]): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];

  for (const event of events) {
    const sem = event.oidcSemantics;
    if (!sem) continue;

    // PAR response missing request_uri
    if (
      sem.oidcPhase === 'par' &&
      !sem.par?.requestUri &&
      event.data._tag === 'network' &&
      event.data.status < 400
    ) {
      candidates.push({
        dedupKey: `par:missing-request-uri:${event.id}`,
        eventId: event.id,
        issue: {
          id: 'par:missing-request-uri',
          severity: 'error',
          category: 'par',
          title: 'PAR response missing request_uri',
          description: 'The PAR endpoint returned a successful response but without a request_uri.',
          steps: [
            'Check the PAR endpoint configuration.',
            'The response must include request_uri and expires_in.',
          ],
        },
      });
    }

    // Authorize with both request_uri AND inline params
    if (sem.oidcPhase === 'authorize' && sem.par?.requestUri && event.data._tag === 'network') {
      const url = event.data.url;
      const hasInlineParams = url.includes('redirect_uri=') || url.includes('scope=');
      if (hasInlineParams) {
        candidates.push({
          dedupKey: `par:inline-params-with-request-uri:${event.id}`,
          eventId: event.id,
          issue: {
            id: 'par:inline-params-with-request-uri',
            severity: 'warning',
            category: 'par',
            title: 'Inline params with request_uri',
            description:
              'The authorization request includes both request_uri and inline parameters. Per RFC 9126, only request_uri and client_id should be present.',
            steps: [
              'Remove inline parameters (scope, redirect_uri, etc.) when using request_uri.',
              'Only include request_uri and client_id in the authorization URL.',
            ],
          },
        });
      }
    }
  }

  return candidates;
}
