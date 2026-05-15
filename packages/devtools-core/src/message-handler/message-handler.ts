import { Effect, Schema, Either } from 'effect';
import { buildNetworkEvent } from '../annotators/network-observer.js';
import { EventStoreService } from '../event-store/event-store.service.js';
import { AuthEventSchema } from '@wolfcola/devtools-types';
import type { AuthEvent, OidcSemantics } from '@wolfcola/devtools-types';
import type { HarEntry } from '../annotators/network-observer.js';
import { annotateOidc } from '../annotators/oidc-annotator.js';
import { detectDpop } from '../annotators/dpop-detector.js';
import { detectPar } from '../annotators/par-detector.js';
import { parseWellKnownResponse, isWellKnownUrl } from '../annotators/oidc-discovery.js';

export type IncomingMessage =
  | { type: 'NETWORK_EVENT'; payload: HarEntry }
  | { type: 'SDK_EVENT'; payload: unknown }
  | { type: 'CLEAR' }
  | { type: 'GET_STATE' };

export function handleMessage(message: IncomingMessage) {
  return Effect.gen(function* () {
    const store = yield* EventStoreService;

    switch (message.type) {
      case 'NETWORK_EVENT': {
        const state = yield* store.getState();
        const event = buildNetworkEvent(message.payload, state.flowId, state.oidcConfig);
        if (!event.flags.isAuthRelated) return null;

        // Run OIDC annotation pipeline on network events
        const enriched = enrichWithOidcSemantics(event, state.oidcConfig);

        // Update discovered OIDC config if this is a well-known response
        if (
          enriched.data._tag === 'network' &&
          isWellKnownUrl(enriched.data.url) &&
          enriched.data.responseBody
        ) {
          const config = parseWellKnownResponse(enriched.data.responseBody);
          if (config) {
            yield* store.setOidcConfig(config);
          }
        }

        // Determine causedBy: use SDK link if available, else use OIDC phase linking
        const causedBy = state.lastSdkEventId ?? state.lastOidcEventId ?? null;
        const eventWithCause = { ...enriched, causedBy };

        yield* store.append(eventWithCause);
        yield* store.persist();
        return eventWithCause;
      }
      case 'SDK_EVENT': {
        const result = Schema.decodeUnknownEither(AuthEventSchema)(message.payload);
        if (Either.isLeft(result)) {
          console.warn('[Ping DevTools] Malformed SDK event:', result.left.message);
          return null;
        }
        yield* store.append(result.right);
        yield* store.persist();
        return result.right;
      }
      case 'CLEAR': {
        yield* store.clear();
        return null;
      }
      case 'GET_STATE': {
        return yield* store.getState();
      }
    }
  });
}

type OidcEnricher = (
  semantics: OidcSemantics,
  data: AuthEvent['data'] & { _tag: 'network' },
  config: import('../annotators/oidc-discovery.js').OidcConfig | null,
) => OidcSemantics;

const enrichWithDpop: OidcEnricher = (semantics, data) => {
  const dpop = detectDpop(data);
  return dpop ? ({ ...semantics, dpop } as OidcSemantics) : semantics;
};

const enrichWithPar: OidcEnricher = (semantics, data, config) => {
  const par = detectPar(data, config);
  return par ? ({ ...semantics, par: { ...semantics.par, ...par } } as OidcSemantics) : semantics;
};

const enrichers: OidcEnricher[] = [enrichWithDpop, enrichWithPar];

function enrichWithOidcSemantics(
  event: AuthEvent,
  oidcConfig: import('../annotators/oidc-discovery.js').OidcConfig | null,
): AuthEvent {
  if (event.data._tag !== 'network') return event;

  const base = annotateOidc(event.data, oidcConfig);
  if (!base) return event;

  const semantics = enrichers.reduce<OidcSemantics>(
    (sem, enrich) => enrich(sem, event.data as AuthEvent['data'] & { _tag: 'network' }, oidcConfig),
    base,
  );

  return { ...event, oidcSemantics: semantics } as AuthEvent;
}
