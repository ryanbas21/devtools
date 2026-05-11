import * as vscode from 'vscode';

export class OidcDebugConfigProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (!config.type) config.type = 'oidc-devtools';
    if (!config.request) config.request = 'launch';
    if (!config.name) config.name = 'Debug OIDC Flow';
    if (!config.port) config.port = 9222;
    if (!config.url) config.url = 'http://localhost:3000';
    return config;
  }
}
