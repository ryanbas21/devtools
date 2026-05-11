import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const startCmd = vscode.commands.registerCommand('oidc-devtools.startCapture', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Starting capture...');
  });

  const stopCmd = vscode.commands.registerCommand('oidc-devtools.stopCapture', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Stopping capture...');
  });

  const clearCmd = vscode.commands.registerCommand('oidc-devtools.clearEvents', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Events cleared.');
  });

  const exportCmd = vscode.commands.registerCommand('oidc-devtools.exportFlow', () => {
    vscode.window.showInformationMessage('OIDC DevTools: Exporting flow...');
  });

  context.subscriptions.push(startCmd, stopCmd, clearCmd, exportCmd);
}

export function deactivate(): void {
  // cleanup
}
