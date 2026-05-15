import type { AuthEvent } from '@wolfcola/devtools-types';
import type { IssueCandidate } from './types.js';

export function collectCorsIssues(events: readonly AuthEvent[]): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];

  for (const event of events) {
    if (event.data._tag !== 'network') continue;
    const { data } = event;
    const origin = data.requestHeaders['origin'] ?? '';
    const allowOrigin = data.responseHeaders['access-control-allow-origin'] ?? '';
    const allowCredentials = data.responseHeaders['access-control-allow-credentials'] ?? '';
    const hasOriginHeader = 'origin' in data.requestHeaders;

    if (data.status === 0 && event.flags.isCors) {
      candidates.push({
        dedupKey: `cors:status-zero:${origin}`,
        eventId: event.id,
        issue: {
          id: 'cors:status-zero',
          severity: 'error',
          category: 'cors',
          title: 'Network failure (status 0)',
          description:
            'The request never reached the server. This is almost always a CORS preflight rejection.',
          steps: [
            `Your auth server must include this origin in allowed origins: ${origin || '(unknown)'}`,
            'Check the OPTIONS preflight request in the Network tab.',
            'If using credentials, wildcard (*) is not allowed as the allowed origin.',
          ],
          relevantData: origin ? { origin } : undefined,
        },
      });
    }

    if (hasOriginHeader && !allowOrigin && data.status !== 0 && event.flags.isCors) {
      candidates.push({
        dedupKey: `cors:missing-allow-origin:${origin}`,
        eventId: event.id,
        issue: {
          id: 'cors:missing-allow-origin',
          severity: 'error',
          category: 'cors',
          title: 'Missing CORS header',
          description: 'The server response is missing Access-Control-Allow-Origin.',
          steps: [
            `Add ${origin} to allowed origins on your auth server.`,
            'Verify the request origin matches what is configured in your AS CORS settings.',
          ],
          relevantData: { 'missing-header': 'access-control-allow-origin', origin },
        },
      });
    }

    if (allowOrigin === '*' && allowCredentials === 'true') {
      candidates.push({
        dedupKey: `cors:wildcard-with-credentials:${data.url}`,
        eventId: event.id,
        issue: {
          id: 'cors:wildcard-with-credentials',
          severity: 'error',
          category: 'cors',
          title: 'Wildcard CORS with credentials',
          description:
            'access-control-allow-origin: * cannot be used together with access-control-allow-credentials: true.',
          steps: [
            `Replace wildcard with an explicit origin: ${origin || '(your app origin)'}`,
            'Configure your auth server to reflect the specific requesting origin.',
          ],
          relevantData: {
            'access-control-allow-origin': '*',
            'access-control-allow-credentials': 'true',
          },
        },
      });
    }

    if (
      hasOriginHeader &&
      allowCredentials === 'false' &&
      data.requestHeaders['cookie'] !== undefined
    ) {
      candidates.push({
        dedupKey: `cors:credentials-not-allowed:${origin}`,
        eventId: event.id,
        issue: {
          id: 'cors:credentials-not-allowed',
          severity: 'warning',
          category: 'cors',
          title: 'Credentials not allowed by server',
          description:
            'The server set access-control-allow-credentials: false but cookies were sent.',
          steps: [
            'Enable credentials on the auth server CORS config.',
            'Or remove the cookie from the request.',
          ],
        },
      });
    }
  }

  return candidates;
}
