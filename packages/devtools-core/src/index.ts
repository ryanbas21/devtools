// ─── Annotators (consumer-facing) ────────────────────────────────────────────
export { isAuthRelated } from './annotators/network-observer.js';
export type { HarEntry, HarHeader } from './annotators/network-observer.js';
export type { OidcConfig } from './annotators/oidc-discovery.js';

// ─── Diagnosis ───────────────────────────────────────────────────────────────
export { runDiagnosis, runFlowRules, runEventRules } from './diagnosis/diagnosis-engine.js';
export type {
  Severity,
  DiagnosisCategory,
  FlowIssue,
  EventIssue,
  DiagnosisResult,
} from './diagnosis/diagnosis-engine.js';
export { serializeDiagnosis } from './diagnosis/serialize-diagnosis.js';
export type { SerializableDiagnosisResult } from './diagnosis/serialize-diagnosis.js';

// ─── Export ──────────────────────────────────────────────────────────────────
export { renderFlowMarkdown } from './export/markdown.js';
export { redactFlowState } from './export/redact.js';
export { exportAsJson, exportAsMarkdown } from './export/export-transforms.js';

// ─── Storage & Message Handling ──────────────────────────────────────────────
export {
  EventStoreService,
  EventStoreInMemory,
  makeEmptyFlowState,
  updateSummary,
} from './event-store/event-store.service.js';
export type {
  ExtendedFlowState,
  EventStoreServiceShape,
} from './event-store/event-store.service.js';
export { handleMessage } from './message-handler/message-handler.js';
export type { IncomingMessage } from './message-handler/message-handler.js';
