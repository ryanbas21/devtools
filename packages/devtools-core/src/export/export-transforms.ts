import type { FlowState } from '@wolfcola/devtools-types';
import { redactFlowState } from './redact.js';
import { renderFlowMarkdown } from './markdown.js';
import { runDiagnosis } from '../diagnosis/diagnosis-engine.js';

export function exportAsJson(flow: FlowState): string {
  const redacted = redactFlowState(flow);
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), redacted: true, flow: redacted },
    null,
    2,
  );
}

export function exportAsMarkdown(flow: FlowState): string {
  const redacted = redactFlowState(flow);
  const diagnosis = runDiagnosis(redacted.events);
  return renderFlowMarkdown(redacted, diagnosis);
}
