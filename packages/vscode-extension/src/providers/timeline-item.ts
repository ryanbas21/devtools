import * as vscode from 'vscode';
import type { AuthEvent } from '@wolfcola/devtools-types';

export class TimelineItem extends vscode.TreeItem {
  constructor(public readonly event: AuthEvent) {
    const label = TimelineItem.buildLabel(event);
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = TimelineItem.buildDescription(event);
    this.iconPath = TimelineItem.getIcon(event);
    this.tooltip = TimelineItem.buildTooltip(event);
    this.contextValue = event.data._tag;

    this.command = {
      command: 'oidc-devtools.selectEvent',
      title: 'Select Event',
      arguments: [event],
    };
  }

  private static buildLabel(event: AuthEvent): string {
    if (event.data._tag === 'network') {
      try {
        const path = new URL(event.data.url).pathname;
        return `${event.data.status} ${event.data.method} ${path}`;
      } catch {
        return `${event.data.status} ${event.data.method} ${event.data.url}`;
      }
    }
    if (event.data._tag === 'sdk') {
      return event.type.replace('sdk:', '');
    }
    return event.type;
  }

  private static buildDescription(event: AuthEvent): string {
    const parts: string[] = [];
    if (event.data._tag === 'network' && event.data.duration) {
      parts.push(`${event.data.duration}ms`);
    }
    if (event.flags.isCors) parts.push('CORS');
    if (event.oidcSemantics) parts.push(event.oidcSemantics.oidcPhase);
    return parts.join(' · ');
  }

  private static getIcon(event: AuthEvent): vscode.ThemeIcon {
    if (event.flags.isError) return new vscode.ThemeIcon('error');
    if (event.flags.isCors) return new vscode.ThemeIcon('warning');
    if (event.data._tag === 'sdk') return new vscode.ThemeIcon('symbol-event');
    return new vscode.ThemeIcon('circle-filled');
  }

  private static buildTooltip(event: AuthEvent): string {
    if (event.data._tag === 'network') {
      return `${event.data.method} ${event.data.url}\nStatus: ${event.data.status}\nDuration: ${event.data.duration}ms`;
    }
    return event.type;
  }
}
