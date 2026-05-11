import * as vscode from 'vscode';
import type { AuthEvent } from '@wolfcola/devtools-types';
import { TimelineItem } from './timeline-item.js';

export class TimelineTreeProvider implements vscode.TreeDataProvider<TimelineItem> {
  private events: AuthEvent[] = [];
  private _onDidChangeTreeData = new vscode.EventEmitter<TimelineItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: TimelineItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TimelineItem[] {
    return this.events.map((e) => new TimelineItem(e));
  }

  addEvent(event: AuthEvent): void {
    this.events.push(event);
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.events = [];
    this._onDidChangeTreeData.fire();
  }

  getEvents(): AuthEvent[] {
    return [...this.events];
  }

  get eventCount(): number {
    return this.events.length;
  }
}
