import * as vscode from 'vscode';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export class StatusBar {
  private item: vscode.StatusBarItem;
  private state: ConnectionState = 'disconnected';
  private eventCount = 0;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'oidc-devtools.startCapture';
    this.update();
    this.item.show();
  }

  setState(state: ConnectionState): void {
    this.state = state;
    this.update();
  }

  setEventCount(count: number): void {
    this.eventCount = count;
    this.update();
  }

  private update(): void {
    switch (this.state) {
      case 'disconnected':
        this.item.text = '$(plug) OIDC DevTools: Disconnected';
        this.item.command = 'oidc-devtools.startCapture';
        break;
      case 'connecting':
        this.item.text = '$(sync~spin) OIDC DevTools: Connecting...';
        this.item.command = undefined;
        break;
      case 'connected':
        this.item.text = `$(plug) OIDC DevTools: Connected | ${this.eventCount} events`;
        this.item.command = 'oidc-devtools.stopCapture';
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
