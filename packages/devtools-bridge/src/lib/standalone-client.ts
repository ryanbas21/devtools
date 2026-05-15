import type { HarEntry } from '@wolfcola/devtools-core';

declare global {
  var __wolfcola_ws: WebSocket | undefined;
}

export interface StandaloneClientOptions {
  name: string;
  port?: number;
  pid?: number;
  framework?: string;
}

export class StandaloneClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly handshake: { type: 'HANDSHAKE'; name: string; pid?: number; framework?: string };

  constructor(private readonly opts: StandaloneClientOptions) {
    this.url = `ws://localhost:${opts.port ?? 19417}`;
    this.handshake = {
      type: 'HANDSHAKE',
      name: opts.name,
      pid: opts.pid,
      framework: opts.framework,
    };
  }

  async connect(): Promise<void> {
    if (globalThis.__wolfcola_ws?.readyState === WebSocket.OPEN) {
      this.ws = globalThis.__wolfcola_ws;
      return;
    }

    try {
      const ws = new WebSocket(this.url);
      await new Promise<void>((resolve) => {
        ws.onopen = () => {
          this.ws = ws;
          globalThis.__wolfcola_ws = ws;
          this.send(this.handshake);
          resolve();
        };
        ws.onerror = () => {
          this.ws = null;
          resolve();
        };
      });
    } catch {
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN ||
      globalThis.__wolfcola_ws?.readyState === WebSocket.OPEN
    );
  }

  sendSdkEvent(payload: unknown): void {
    this.send({ type: 'SDK_EVENT', payload });
  }

  sendNetworkEvent(payload: HarEntry): void {
    this.send({ type: 'NETWORK_EVENT', payload });
  }

  sendClear(): void {
    this.send({ type: 'CLEAR' });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    globalThis.__wolfcola_ws = undefined;
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
