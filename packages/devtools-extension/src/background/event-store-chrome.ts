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
            const stored = result['ping:auth-flow'];
            if (
              stored &&
              typeof stored === 'object' &&
              Array.isArray((stored as Record<string, unknown>).events)
            ) {
              // Ensure required fields exist (handles schema evolution across versions)
              const state = stored as Record<string, unknown>;
              const hydrated: ExtendedFlowState = {
                ...makeEmptyFlowState(),
                ...(state as unknown as ExtendedFlowState),
              };
              return Ref.set(stateRef, hydrated);
            }
            return Effect.void;
          }),
        ),
      setOidcConfig: (config: OidcConfig) =>
        Ref.update(stateRef, (s) => ({ ...s, oidcConfig: config })),
    })),
  ),
);
