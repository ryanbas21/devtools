import type { AuthEvent } from '@wolfcola/devtools-types';
import type { IssueCandidate } from './types.js';

export function collectOidcIssues(events: readonly AuthEvent[]): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];

  for (const event of events) {
    if (event.data._tag !== 'dom') continue;
    const url = event.data.url ?? '';

    if (url.includes('error=state_mismatch')) {
      candidates.push({
        dedupKey: `oidc:state-mismatch`,
        eventId: event.id,
        issue: {
          id: 'oidc:state-mismatch',
          severity: 'error',
          category: 'oidc',
          title: 'State mismatch',
          description:
            'The OAuth state parameter in the callback does not match the one sent in the authorization request.',
          steps: [
            'Do not share auth state across tabs.',
            'Check your PKCE/state implementation for race conditions.',
            'Ensure the state is stored and compared correctly on the callback.',
          ],
        },
      });
    }

    if (url.includes('error=invalid_request') && url.includes('code_challenge')) {
      candidates.push({
        dedupKey: `oidc:pkce-missing`,
        eventId: event.id,
        issue: {
          id: 'oidc:pkce-missing',
          severity: 'error',
          category: 'oidc',
          title: 'PKCE challenge missing',
          description: 'The authorization request was missing the required PKCE code_challenge.',
          steps: [
            'Ensure the SDK is configured with PKCE enabled.',
            'Verify the client application requires PKCE in your AS client configuration.',
          ],
        },
      });
    }

    if (url.includes('error=invalid_request') && url.includes('redirect_uri')) {
      candidates.push({
        dedupKey: `oidc:redirect-uri-mismatch`,
        eventId: event.id,
        issue: {
          id: 'oidc:redirect-uri-mismatch',
          severity: 'error',
          category: 'oidc',
          title: 'Redirect URI mismatch',
          description:
            'The redirect URI in the request does not match any URI registered in the AS client.',
          steps: [
            'Register the exact redirect URI used by your app in the AS client configuration.',
            'Ensure no trailing slashes or protocol mismatches.',
          ],
        },
      });
    }
  }

  return candidates;
}
