import type { ElmModule } from '@wolfcola/devtools-ui/ports';

declare const Elm: ElmModule;
declare const wolfcola: {
  onEvent: (cb: (event: unknown) => void) => void;
  onDiagnosis: (cb: (diagnosis: unknown) => void) => void;
  onSessionsChanged: (cb: (sessions: unknown[]) => void) => void;
  getSessions: () => Promise<unknown[]>;
  switchSession: (id: string) => Promise<void>;
  clearFlow: (id: string) => Promise<void>;
  exportJson: (id: string) => Promise<string | null>;
  exportMarkdown: (id: string) => Promise<string | null>;
  setClearOnReconnect: (id: string, value: boolean) => Promise<void>;
};

const app = Elm.Main.init({ node: document.getElementById('app'), flags: null });

wolfcola.onEvent((event) => {
  app.ports.receiveEvent.send(event);
});

wolfcola.onDiagnosis((diagnosis) => {
  app.ports.receiveDiagnosis.send(diagnosis);
});

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

let activeSessionId: string | null = null;

wolfcola.getSessions().then((sessions) => {
  if (sessions.length > 0) {
    activeSessionId = (sessions[0] as { id: string }).id;
  }
});

wolfcola.onSessionsChanged((sessions) => {
  if (!activeSessionId && sessions.length > 0) {
    activeSessionId = (sessions[0] as { id: string }).id;
  }
});

app.ports.exportJson?.subscribe(async () => {
  if (!activeSessionId) return;
  const json = await wolfcola.exportJson(activeSessionId);
  if (json) copyToClipboard(json);
});

app.ports.exportMarkdown?.subscribe(async () => {
  if (!activeSessionId) return;
  const md = await wolfcola.exportMarkdown(activeSessionId);
  if (md) copyToClipboard(md);
});

app.ports.clearFlow?.subscribe(() => {
  if (activeSessionId) wolfcola.clearFlow(activeSessionId);
});

app.ports.copyToClipboard?.subscribe((text: string) => {
  copyToClipboard(text);
});
