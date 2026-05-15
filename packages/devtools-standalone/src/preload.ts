import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc-bridge.js';

contextBridge.exposeInMainWorld('wolfcola', {
  onEvent: (callback: (event: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.EVENT, (_e, event) => callback(event));
  },
  onDiagnosis: (callback: (diagnosis: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.DIAGNOSIS, (_e, diagnosis) => callback(diagnosis));
  },
  onSessionsChanged: (callback: (sessions: unknown[]) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SESSIONS, (_e, sessions) => callback(sessions));
  },
  getSessions: () => ipcRenderer.invoke(IPC_CHANNELS.SESSIONS),
  switchSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_SESSION, sessionId),
  clearFlow: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_FLOW, sessionId),
  exportJson: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_JSON, sessionId),
  exportMarkdown: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_MARKDOWN, sessionId),
  setClearOnReconnect: (sessionId: string, value: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_CLEAR_ON_RECONNECT, sessionId, value),
});
