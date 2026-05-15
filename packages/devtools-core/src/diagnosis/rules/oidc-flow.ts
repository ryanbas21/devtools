import type { AuthEvent } from '@wolfcola/devtools-types';
import type { IssueCandidate } from './types.js';

export function collectOidcFlowIssues(events: readonly AuthEvent[]): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];
  const semanticEvents = events.filter((e) => e.oidcSemantics);

  const authorizeEvents = semanticEvents.filter((e) => e.oidcSemantics?.oidcPhase === 'authorize');
  const tokenEvents = semanticEvents.filter((e) => e.oidcSemantics?.oidcPhase === 'token');

  // Flow-level checks: only warn if NO authorize event in the flow has PKCE
  const anyAuthorizeHasPkce = authorizeEvents.some((e) => e.oidcSemantics?.pkce);
  const anyAuthorizeHasPar = authorizeEvents.some((e) => e.oidcSemantics?.par);

  if (authorizeEvents.length > 0 && !anyAuthorizeHasPkce && !anyAuthorizeHasPar) {
    // Pick the most specific authorize event (has clientId, or first one)
    const representative =
      authorizeEvents.find((e) => e.oidcSemantics?.clientId) ?? authorizeEvents[0];
    candidates.push({
      dedupKey: `oidc:missing-pkce`,
      eventId: representative.id,
      issue: {
        id: 'oidc:missing-pkce',
        severity: 'warning',
        category: 'oidc-flow',
        title: 'Authorization request without PKCE',
        description:
          'The authorization request does not include a PKCE code_challenge. PKCE is recommended for all OAuth clients.',
        steps: [
          'Add code_challenge and code_challenge_method to the authorization request.',
          'Use S256 as the code_challenge_method.',
        ],
      },
    });
  }

  // Per-event checks that only apply to the "real" authorize request (one with clientId or query params)
  for (const event of authorizeEvents) {
    const sem = event.oidcSemantics!;
    if (event.data._tag !== 'network') continue;
    const url = event.data.url;

    // Skip events that don't look like real authorize requests
    // (no clientId detected and no query params with scope/response_type)
    if (!sem.clientId && !url.includes('response_type=')) continue;

    // Nonce missing with openid scope
    if (url.includes('scope=') && url.includes('openid') && !sem.nonce) {
      candidates.push({
        dedupKey: `oidc:nonce-missing`,
        eventId: event.id,
        issue: {
          id: 'oidc:nonce-missing',
          severity: 'warning',
          category: 'oidc-flow',
          title: 'Missing nonce for OpenID Connect',
          description:
            'The authorization request includes the openid scope but no nonce parameter.',
          steps: [
            'Include a unique nonce value in the authorization request.',
            'Verify the nonce in the returned id_token to prevent replay attacks.',
          ],
        },
      });
    }

    // Implicit flow detection
    if (url.includes('response_type=token') || url.includes('response_type=id_token')) {
      candidates.push({
        dedupKey: `oidc:implicit-flow`,
        eventId: event.id,
        issue: {
          id: 'oidc:implicit-flow',
          severity: 'warning',
          category: 'oidc-flow',
          title: 'Implicit flow detected',
          description:
            'The response_type includes "token" or "id_token", indicating the implicit flow. This is discouraged in favor of the authorization code flow with PKCE.',
          steps: [
            'Switch to response_type=code with PKCE.',
            'The implicit flow exposes tokens in the URL fragment.',
          ],
        },
      });
    }
  }

  for (const event of tokenEvents) {
    const sem = event.oidcSemantics!;

    // Token request without code_verifier when authorize used PKCE
    if (sem.grantType === 'authorization_code' && !sem.pkce?.hasVerifier) {
      if (anyAuthorizeHasPkce) {
        candidates.push({
          dedupKey: `oidc:missing-pkce-verifier`,
          eventId: event.id,
          issue: {
            id: 'oidc:missing-pkce-verifier',
            severity: 'error',
            category: 'oidc-flow',
            title: 'Missing PKCE code_verifier',
            description:
              'The token request is missing code_verifier but the authorization request included code_challenge.',
            steps: [
              'Include the code_verifier in the token request body.',
              'The code_verifier must match the code_challenge sent in the authorization request.',
            ],
          },
        });
      }
    }
  }

  // Detect same auth code used multiple times
  const codeUsage = new Map<string, string[]>();
  for (const event of tokenEvents) {
    if (
      event.data._tag === 'network' &&
      typeof event.data.requestBody === 'object' &&
      event.data.requestBody !== null
    ) {
      const body = event.data.requestBody as Record<string, unknown>;
      const code = body['code'];
      if (typeof code === 'string') {
        const existing = codeUsage.get(code) ?? [];
        codeUsage.set(code, [...existing, event.id]);
      }
    }
  }
  for (const [code, eventIds] of codeUsage) {
    if (eventIds.length > 1) {
      candidates.push({
        dedupKey: `oidc:expired-code:${code}`,
        eventId: eventIds[1],
        issue: {
          id: 'oidc:expired-code',
          severity: 'error',
          category: 'oidc-flow',
          title: 'Authorization code reused',
          description:
            'The same authorization code was used in multiple token requests. Authorization codes are single-use.',
          steps: [
            'Ensure the auth code is only used once.',
            'Restart the flow to obtain a new authorization code.',
          ],
          relevantData: { code: code.slice(0, 16) + '...' },
        },
      });
    }
  }

  return candidates;
}
