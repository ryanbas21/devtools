// packages/devtools-ui/src/ports.ts

export interface ElmPorts {
  receiveEvent: { send: (event: unknown) => void };
  receiveDiagnosis: { send: (diagnosis: unknown) => void };
  receiveImportMeta: { send: (meta: unknown) => void };
  receiveImportError: { send: (error: unknown) => void };
  receiveSnapshots: { send: (snapshots: unknown[]) => void };
  exportJson: { subscribe: (cb: () => void) => void };
  exportMarkdown: { subscribe: (cb: () => void) => void };
  submitImportPaste: { subscribe: (cb: (text: string) => void) => void };
  clearFlow: { subscribe: (cb: () => void) => void };
  saveSnapshot: { subscribe: (cb: () => void) => void };
  requestSnapshots: { subscribe: (cb: () => void) => void };
  loadSnapshot: { subscribe: (cb: (id: string) => void) => void };
  deleteSnapshot: { subscribe: (cb: (id: string) => void) => void };
  copyToClipboard: { subscribe: (cb: (text: string) => void) => void };
}

export interface ElmApp {
  ports: ElmPorts;
}

export interface ElmModule {
  Main: {
    init: (opts: { node: HTMLElement | null; flags: null }) => ElmApp;
  };
}
