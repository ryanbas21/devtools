import type { AuthEvent } from '@wolfcola/devtools-types';
import type { IssueCandidate } from './types.js';

export function collectFlowConfigIssues(events: readonly AuthEvent[]): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];

  for (const event of events) {
    if (event.data._tag !== 'sdk') continue;
    const { data } = event;
    const { nodeStatus } = data;
    const errorCode = data.error?.code ?? '';

    if (nodeStatus === 'error' || nodeStatus === 'failure') {
      const nodeName = data.nodeName ?? '';
      candidates.push({
        dedupKey: `flow:node-error:${event.id}`,
        eventId: event.id,
        issue: {
          id: 'flow:node-error',
          severity: 'error',
          category: 'flow-config',
          title: nodeName ? `Node error: ${nodeName}` : 'Node error',
          description: `A DaVinci node returned status "${nodeStatus}".`,
          steps: [
            'Check connector configuration in DaVinci admin.',
            'Review the error code in the SDK State tab.',
          ],
          relevantData: nodeName ? { node: nodeName, status: nodeStatus } : { status: nodeStatus },
        },
      });
    }

    if (errorCode === 'CONNECTOR_ERROR') {
      const httpStatus = data.error?.internalHttpStatus;
      candidates.push({
        dedupKey: `flow:connector-error:${event.id}`,
        eventId: event.id,
        issue: {
          id: 'flow:connector-error',
          severity: 'error',
          category: 'flow-config',
          title: httpStatus ? `Connector error (HTTP ${httpStatus})` : 'Connector error',
          description: 'A DaVinci connector returned an HTTP error from its upstream endpoint.',
          steps: [
            'Verify connector credentials and endpoint URL in DaVinci admin.',
            'Check the upstream service is reachable from your DaVinci environment.',
          ],
          relevantData: httpStatus ? { 'internal-http-status': String(httpStatus) } : undefined,
        },
      });
    }

    if (errorCode === 'NOT_FOUND') {
      candidates.push({
        dedupKey: `flow:policy-not-found`,
        eventId: event.id,
        issue: {
          id: 'flow:policy-not-found',
          severity: 'error',
          category: 'flow-config',
          title: 'Flow policy not found',
          description: 'The policy ID used to start this flow does not exist in the environment.',
          steps: [
            'Verify the policy ID (acr_values or flowId) matches your DaVinci environment.',
            'Check that the policy is published and assigned to the correct application.',
          ],
        },
      });
    }
  }

  return candidates;
}
