import { Effect, Layer, Ref, pipe } from 'effect';
import { EventStoreService, makeEmptyFlowState, updateSummary } from '@wolfcola/devtools-core';
import type { ExtendedFlowState } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';
import type { OidcConfig } from '@wolfcola/devtools-core';

export const EventStoreChromeLive = Layer.effect(
  EventStoreService,
  pipe(
    Ref.make<ExtendedFlowState>(makeEmptyFlowState()),
    Effect.map((stateRef) => ({
      append: (event: AuthEvent) => Ref.update(stateRef, (s) => updateSummary(s, event)),
      getState: () => Ref.get(stateRef),
      clear: () => Ref.set(stateRef, makeEmptyFlowState()),
      persist: () =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) =>
            Effect.tryPromise(() => chrome.storage.local.set({ 'ping:auth-flow': state })),
          ),
          Effect.orDie,
        ),
      rehydrate: () =>
        pipe(
          Effect.tryPromise(() => chrome.storage.local.get('ping:auth-flow')),
          Effect.orDie,
          Effect.flatMap((result) => {
            const stored = result['ping:auth-flow'] as ExtendedFlowState | undefined;
            return stored ? Ref.set(stateRef, stored) : Effect.void;
          }),
        ),
      setOidcConfig: (config: OidcConfig) =>
        Ref.update(stateRef, (s) => ({ ...s, oidcConfig: config })),
      setLastOidcEventId: (id: string) =>
        Ref.update(stateRef, (s) => ({ ...s, lastOidcEventId: id })),
    })),
  ),
);
