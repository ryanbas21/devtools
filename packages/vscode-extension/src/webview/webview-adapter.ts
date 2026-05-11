// @ts-expect-error — Elm is loaded via script tag
const Elm = (
  window as unknown as {
    Elm: {
      Main: {
        init: (opts: { node: HTMLElement | null; flags: null }) => {
          ports: Record<
            string,
            {
              send?: (v: unknown) => void;
              subscribe?: (cb: (...args: unknown[]) => void) => void;
            }
          >;
        };
      };
    };
  }
).Elm;

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

const app = Elm.Main.init({ node: document.getElementById('app'), flags: null });

// VS Code → Elm
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'event':
      app.ports.receiveEvent?.send?.(msg.payload);
      break;
    case 'diagnosis':
      app.ports.receiveDiagnosis?.send?.(msg.payload);
      break;
    case 'importMeta':
      app.ports.receiveImportMeta?.send?.(msg.payload);
      break;
    case 'importError':
      app.ports.receiveImportError?.send?.(msg.payload);
      break;
    case 'snapshots':
      app.ports.receiveSnapshots?.send?.(msg.payload);
      break;
  }
});

// Elm → VS Code
app.ports.exportJson?.subscribe?.(() => {
  vscode.postMessage({ type: 'exportJson' });
});

app.ports.exportMarkdown?.subscribe?.(() => {
  vscode.postMessage({ type: 'exportMarkdown' });
});

app.ports.submitImportPaste?.subscribe?.((text: unknown) => {
  vscode.postMessage({ type: 'submitImportPaste', payload: text });
});

app.ports.clearFlow?.subscribe?.(() => {
  vscode.postMessage({ type: 'clearFlow' });
});

app.ports.copyToClipboard?.subscribe?.((text: unknown) => {
  vscode.postMessage({ type: 'copyToClipboard', payload: text });
});

// Snapshots — no-op in VS Code v1
app.ports.saveSnapshot?.subscribe?.(() => {});
app.ports.requestSnapshots?.subscribe?.(() => {});
app.ports.loadSnapshot?.subscribe?.(() => {});
app.ports.deleteSnapshot?.subscribe?.(() => {});
