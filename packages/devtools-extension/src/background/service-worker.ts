import { ManagedRuntime, Effect } from 'effect';
import { EventStoreChromeLive } from './event-store-chrome.js';
import {
  EventStoreService,
  handleMessage,
  runDiagnosis,
  serializeDiagnosis,
} from '@wolfcola/devtools-core';
import type { SerializableDiagnosisResult } from '@wolfcola/devtools-core';

const AppLayer = EventStoreChromeLive;
const runtime = ManagedRuntime.make(AppLayer);

// Rehydrate on every SW start-up (module evaluation runs each time
// Chrome wakes the service worker, unlike `activate` which fires once).
runtime
  .runPromise(
    Effect.gen(function* () {
      const store = yield* EventStoreService;
      yield* store.rehydrate();
    }),
  )
  .catch(console.error);

function broadcastToPanel(event: unknown, diagnosis: SerializableDiagnosisResult): void {
  chrome.runtime.sendMessage({ type: 'PANEL_EVENT', payload: event, diagnosis }).catch(() => {
    // Panel not open — ignore
  });
}

function runDiagnosisEffect() {
  return Effect.gen(function* () {
    const store = yield* EventStoreService;
    const state = yield* store.getState();
    return runDiagnosis(state.events);
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'devtools') return;
  port.onMessage.addListener((message) => {
    runtime
      .runPromise(
        Effect.gen(function* () {
          const result = yield* handleMessage(message);
          if (
            (message.type === 'NETWORK_EVENT' || message.type === 'SDK_EVENT') &&
            result !== null
          ) {
            const diagnosis = yield* runDiagnosisEffect();
            broadcastToPanel(result, serializeDiagnosis(diagnosis));
          }
          return result;
        }),
      )
      .catch(console.error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  runtime
    .runPromise(
      Effect.gen(function* () {
        const result = yield* handleMessage(message);
        if ((message.type === 'NETWORK_EVENT' || message.type === 'SDK_EVENT') && result !== null) {
          const diagnosis = yield* runDiagnosisEffect();
          broadcastToPanel(result, serializeDiagnosis(diagnosis));
        }
        return result;
      }),
    )
    .then(sendResponse)
    .catch((err) => {
      console.error(err);
      sendResponse(null);
    });
  return true; // keep channel open for async response
});
