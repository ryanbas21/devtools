import type { AuthEvent } from '@wolfcola/devtools-types';
import { decodeJwtPayload } from '../../annotators/jwt-utils.js';
import type { IssueCandidate } from './types.js';

export function collectDpopIssues(events: readonly AuthEvent[]): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];

  for (const event of events) {
    const sem = event.oidcSemantics;
    if (!sem?.dpop) continue;

    if (event.data._tag !== 'network') continue;
    const { data } = event;

    // Check DPoP proof structure
    if (sem.dpop.proofJwt) {
      const payload = decodeJwtPayload(sem.dpop.proofJwt);
      if (payload) {
        const requiredClaims = ['htm', 'htu', 'iat', 'jti'];
        const missing = requiredClaims.filter((c) => !(c in payload));
        if (missing.length > 0) {
          candidates.push({
            dedupKey: `dpop:invalid-structure:${event.id}`,
            eventId: event.id,
            issue: {
              id: 'dpop:invalid-structure',
              severity: 'error',
              category: 'dpop',
              title: 'DPoP proof missing required claims',
              description: `The DPoP proof JWT is missing: ${missing.join(', ')}.`,
              steps: [
                'Include all required claims: htm, htu, iat, jti.',
                'Add ath when using DPoP with resource requests.',
              ],
              relevantData: { 'missing-claims': missing.join(', ') },
            },
          });
        }

        // htm mismatch
        if (typeof payload['htm'] === 'string' && payload['htm'] !== data.method) {
          candidates.push({
            dedupKey: `dpop:method-mismatch:${event.id}`,
            eventId: event.id,
            issue: {
              id: 'dpop:method-mismatch',
              severity: 'error',
              category: 'dpop',
              title: 'DPoP method mismatch',
              description: `DPoP proof htm="${payload['htm']}" does not match actual method "${data.method}".`,
              steps: ['The htm claim must match the HTTP method of the request.'],
              relevantData: { htm: payload['htm'] as string, method: data.method },
            },
          });
        }

        // htu mismatch
        if (typeof payload['htu'] === 'string') {
          const htu = payload['htu'] as string;
          const urlNoQuery = data.url.split('?')[0];
          if (htu !== urlNoQuery && htu !== data.url) {
            candidates.push({
              dedupKey: `dpop:uri-mismatch:${event.id}`,
              eventId: event.id,
              issue: {
                id: 'dpop:uri-mismatch',
                severity: 'error',
                category: 'dpop',
                title: 'DPoP URI mismatch',
                description: 'The DPoP proof htu does not match the request URL.',
                steps: [
                  'The htu claim must match the URL of the request (without query/fragment).',
                ],
                relevantData: { htu, url: urlNoQuery },
              },
            });
          }
        }
      }
    }

    // DPoP nonce required error
    if (sem.dpop.nonce && data.status === 400) {
      const body = data.responseBody as Record<string, unknown> | null;
      if (body && body['error'] === 'use_dpop_nonce') {
        candidates.push({
          dedupKey: `dpop:nonce-required:${event.id}`,
          eventId: event.id,
          issue: {
            id: 'dpop:nonce-required',
            severity: 'info',
            category: 'dpop',
            title: 'DPoP nonce required',
            description:
              'The server requires a DPoP nonce. The client should retry with the provided nonce.',
            steps: [
              'Include the DPoP-Nonce header value in the next DPoP proof.',
              'This is expected behavior for server nonce enforcement.',
            ],
            relevantData: { nonce: sem.dpop.nonce },
          },
        });
      }
    }
  }

  // Check for token requests to DPoP servers missing DPoP header
  const dpopServers = new Set<string>();
  for (const event of events) {
    if (event.oidcSemantics?.dpop?.tokenType?.toLowerCase() === 'dpop') {
      if (event.data._tag === 'network') {
        try {
          dpopServers.add(new URL(event.data.url).origin);
        } catch {
          // ignore invalid URLs
        }
      }
    }
  }
  for (const event of events) {
    if (event.data._tag !== 'network') continue;
    if (event.oidcSemantics?.oidcPhase !== 'token') continue;
    if (event.data.requestHeaders['dpop']) continue;
    try {
      const origin = new URL(event.data.url).origin;
      if (dpopServers.has(origin)) {
        candidates.push({
          dedupKey: `dpop:missing-proof:${event.id}`,
          eventId: event.id,
          issue: {
            id: 'dpop:missing-proof',
            severity: 'warning',
            category: 'dpop',
            title: 'Missing DPoP proof',
            description:
              'This token endpoint previously issued DPoP tokens but this request lacks a DPoP header.',
            steps: ['Include a DPoP proof JWT in the DPoP header.'],
          },
        });
      }
    } catch {
      // ignore
    }
  }

  return candidates;
}
