// Barrel exports — populated as modules are moved in
export { annotateOidc } from './annotators/oidc-annotator.js';
export { detectCorsFlags } from './annotators/cors-detector.js';
export { detectDpop } from './annotators/dpop-detector.js';
export { detectPar } from './annotators/par-detector.js';
export {
  parseWellKnownResponse,
  isWellKnownUrl,
  matchesDiscoveredEndpoint,
} from './annotators/oidc-discovery.js';
export type { OidcConfig } from './annotators/oidc-discovery.js';
export {
  trackOidcEvent,
  makeEmptyOidcFlowState,
} from './annotators/oidc-flow-tracker.js';
export type { OidcFlowState, OidcFlow } from './annotators/oidc-flow-tracker.js';
export {
  isAuthRelated,
  buildNetworkEvent,
} from './annotators/network-observer.js';
export type { HarEntry, HarHeader } from './annotators/network-observer.js';
export {
  JWT_PATTERN,
  decodeJwtPayload,
  extractJwt,
  findExpiredJwtsInHeaders,
} from './annotators/jwt-utils.js';
export {
  runDiagnosis,
  runFlowRules,
  runEventRules,
} from './diagnosis/diagnosis-engine.js';
export type {
  Severity,
  DiagnosisCategory,
  FlowIssue,
  EventIssue,
  DiagnosisResult,
} from './diagnosis/diagnosis-engine.js';
export { serializeDiagnosis } from './diagnosis/serialize-diagnosis.js';
export type { SerializableDiagnosisResult } from './diagnosis/serialize-diagnosis.js';
export { renderFlowMarkdown } from './export/markdown.js';
export { redactFlowState } from './export/redact.js';
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
