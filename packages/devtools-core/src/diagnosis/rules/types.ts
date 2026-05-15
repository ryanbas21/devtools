import type { AuthEvent } from '@wolfcola/devtools-types';

export type Severity = 'error' | 'warning' | 'info';

export type DiagnosisCategory =
  | 'cors'
  | 'token'
  | 'flow-config'
  | 'oidc'
  | 'dpop'
  | 'par'
  | 'oidc-flow';

export interface FlowIssue {
  id: string;
  severity: Severity;
  category: DiagnosisCategory;
  title: string;
  description: string;
  steps: string[];
  relatedEventIds: string[];
  relevantData?: Record<string, string>;
}

export interface EventIssue {
  severity: Severity;
  title: string;
  description: string;
  steps: string[];
  relevantData?: Record<string, string>;
}

export type IssueCandidate = {
  dedupKey: string;
  eventId: string;
  issue: Omit<FlowIssue, 'relatedEventIds'>;
};

export type FlowRule = (events: readonly AuthEvent[]) => IssueCandidate[];
