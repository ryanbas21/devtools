import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthEvent } from '@wolfcola/devtools-types';

export class FlowWebviewPanel {
  private panel: vscode.WebviewPanel | null = null;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  reveal(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'oidc-devtools.flow',
      'OIDC Flow',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      },
    );

    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'copyToClipboard':
          vscode.env.clipboard.writeText(msg.payload);
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  sendEvent(event: AuthEvent): void {
    this.panel?.webview.postMessage({ type: 'event', payload: event });
  }

  sendDiagnosis(diagnosis: unknown): void {
    this.panel?.webview.postMessage({
      type: 'diagnosis',
      payload: diagnosis,
    });
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const webviewDir = vscode.Uri.joinPath(
      this.extensionUri,
      'dist',
      'webview',
    );

    const elmJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDir, 'elm.js'),
    );
    const panelCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDir, 'panel.css'),
    );
    const adapterJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDir, 'adapter.js'),
    );

    const templatePath = join(
      this.extensionUri.fsPath,
      'dist',
      'webview',
      'index.html',
    );
    let html = readFileSync(templatePath, 'utf8');

    html = html
      .replaceAll('{{nonce}}', nonce)
      .replaceAll('{{cspSource}}', webview.cspSource)
      .replaceAll('{{elmJsUri}}', elmJsUri.toString())
      .replaceAll('{{panelCssUri}}', panelCssUri.toString())
      .replaceAll('{{adapterJsUri}}', adapterJsUri.toString());

    return html;
  }
}

function getNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
