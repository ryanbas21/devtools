import * as vscode from 'vscode';
import { OidcDebugConfigProvider } from './launch/debug-config-provider.js';
import { CdpClient } from './cdp/cdp-client.js';
import { discoverTargets, findPageTarget } from './cdp/target-discovery.js';
import { injectSdkCapture } from './cdp/sdk-injector.js';
import { TimelineTreeProvider } from './providers/timeline-tree.js';
import { StatusBar } from './status-bar.js';
import { FlowWebviewPanel } from './panels/flow-webview.js';
import {
  buildNetworkEvent,
  redactFlowState,
  renderFlowMarkdown,
  runDiagnosis,
} from '@wolfcola/devtools-core';
import type { HarEntry } from '@wolfcola/devtools-core';
import type { AuthEvent } from '@wolfcola/devtools-types';
import type { FlowState } from '@wolfcola/devtools-types';

let cdpClient: CdpClient | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const timeline = new TimelineTreeProvider();
  const statusBar = new StatusBar();

  vscode.window.registerTreeDataProvider('oidc-devtools.timeline', timeline);

  const flowPanel = new FlowWebviewPanel(context.extensionUri);

  const startCmd = vscode.commands.registerCommand('oidc-devtools.startCapture', async () => {
    const portInput = await vscode.window.showInputBox({
      prompt: 'Chrome debug port',
      value: '9222',
      validateInput: (v) => (/^\d+$/.test(v) ? null : 'Must be a number'),
    });
    if (!portInput) return;

    const port = parseInt(portInput, 10);
    statusBar.setState('connecting');

    try {
      const targets = await discoverTargets(port);
      const target = findPageTarget(targets);
      if (!target) {
        vscode.window.showErrorMessage(
          'No page targets found. Is Chrome running with --remote-debugging-port?',
        );
        statusBar.setState('disconnected');
        return;
      }

      cdpClient = new CdpClient(target.webSocketDebuggerUrl);
      await cdpClient.connect();
      await injectSdkCapture(cdpClient);

      statusBar.setState('connected');
      vscode.window.showInformationMessage(`Connected to: ${target.title}`);

      cdpClient.on('harEntry', (entry: HarEntry) => {
        const event = buildNetworkEvent(entry, null, null);
        if (!event.flags.isAuthRelated) return;
        timeline.addEvent(event);
        flowPanel.sendEvent(event);
        statusBar.setEventCount(timeline.eventCount);
      });

      cdpClient.on('sdkEvent', (_name: string, payload: unknown) => {
        const sdkPayload = (payload as { payload?: unknown }).payload;
        if (sdkPayload && typeof sdkPayload === 'object') {
          timeline.addEvent(sdkPayload as AuthEvent);
          statusBar.setEventCount(timeline.eventCount);
        }
      });

      cdpClient.on('disconnected', () => {
        statusBar.setState('disconnected');
        cdpClient = null;
      });
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to connect: ${err instanceof Error ? err.message : String(err)}`,
      );
      statusBar.setState('disconnected');
    }
  });

  const stopCmd = vscode.commands.registerCommand('oidc-devtools.stopCapture', () => {
    cdpClient?.disconnect();
    cdpClient = null;
    statusBar.setState('disconnected');
  });

  const clearCmd = vscode.commands.registerCommand('oidc-devtools.clearEvents', () => {
    timeline.clear();
    statusBar.setEventCount(0);
  });

  const exportCmd = vscode.commands.registerCommand('oidc-devtools.exportFlow', async () => {
    const events = timeline.getEvents();
    if (events.length === 0) {
      vscode.window.showWarningMessage('No events captured yet.');
      return;
    }

    const format = await vscode.window.showQuickPick(['JSON', 'Markdown'], {
      placeHolder: 'Export format',
    });
    if (!format) return;

    const flowState: FlowState = {
      flowId: null,
      capturedAt: new Date().toISOString(),
      events,
      summary: { nodeCount: 0, errorCount: 0, corsFlags: [], duration: 0, sdkConnected: false },
      lastSdkEventId: null,
    };

    const redacted = redactFlowState(flowState);

    if (format === 'JSON') {
      const envelope = {
        version: 1,
        exportedAt: new Date().toISOString(),
        redacted: true,
        flow: redacted,
      };
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(envelope, null, 2),
        language: 'json',
      });
      await vscode.window.showTextDocument(doc);
    } else {
      const diagnosis = runDiagnosis(redacted.events);
      const md = renderFlowMarkdown(redacted, diagnosis);
      const doc = await vscode.workspace.openTextDocument({
        content: md,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  const selectCmd = vscode.commands.registerCommand(
    'oidc-devtools.selectEvent',
    (event: AuthEvent) => {
      flowPanel.reveal();
      flowPanel.sendEvent(event);
    },
  );

  const debugProvider = vscode.debug.registerDebugConfigurationProvider(
    'oidc-devtools',
    new OidcDebugConfigProvider(),
  );

  context.subscriptions.push(
    startCmd,
    stopCmd,
    clearCmd,
    exportCmd,
    selectCmd,
    statusBar,
    { dispose: () => flowPanel.dispose() },
    debugProvider,
  );
}

export function deactivate(): void {
  cdpClient?.disconnect();
}
