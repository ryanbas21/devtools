import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { HarEntry, HarHeader } from '@wolfcola/devtools-core';

interface PendingRequest {
  url: string;
  method: string;
  headers: HarHeader[];
  postData?: { text: string };
  startTime: number;
  responseStatus?: number;
  responseHeaders?: HarHeader[];
}

interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message: string };
}

interface CdpEvents {
  harEntry: [entry: HarEntry];
  sdkEvent: [name: string, payload: unknown];
  connected: [];
  disconnected: [];
  error: [err: Error];
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface CdpClient {
  on<K extends keyof CdpEvents>(event: K, listener: (...args: CdpEvents[K]) => void): this;
  emit<K extends keyof CdpEvents>(event: K, ...args: CdpEvents[K]): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class CdpClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pendingCalls = new Map<number, (result: unknown, error?: string) => void>();
  private pendingRequests = new Map<string, PendingRequest>();

  constructor(private readonly wsUrl: string) {
    super();
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;

      ws.once('open', () => {
        this.emit('connected');
        this.enableDomains()
          .then(() => resolve())
          .catch(reject);
      });

      ws.once('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      ws.on('close', () => {
        this.emit('disconnected');
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as CdpMessage;
          this.handleMessage(msg);
        } catch {
          // ignore unparseable messages
        }
      });
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    // Reject any pending RPC calls so their promises don't leak
    for (const [id, cb] of this.pendingCalls) {
      cb(undefined, 'Disconnected');
      this.pendingCalls.delete(id);
    }
    this.pendingRequests.clear();
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const id = this.nextId++;
      this.pendingCalls.set(id, (result, error) => {
        if (error !== undefined) {
          reject(new Error(error));
        } else {
          resolve(result);
        }
      });
      this.ws.send(JSON.stringify({ id, method, params: params ?? {} }));
    });
  }

  private async enableDomains(): Promise<void> {
    await this.send('Network.enable');
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  private handleMessage(msg: CdpMessage): void {
    if (msg.id !== undefined) {
      const cb = this.pendingCalls.get(msg.id);
      if (cb) {
        this.pendingCalls.delete(msg.id);
        if (msg.error) {
          cb(undefined, msg.error.message);
        } else {
          cb(msg.result);
        }
      }
      return;
    }

    if (!msg.method || !msg.params) return;

    switch (msg.method) {
      case 'Network.requestWillBeSent':
        this.onRequestWillBeSent(msg.params);
        break;
      case 'Network.responseReceived':
        this.onResponseReceived(msg.params);
        break;
      case 'Network.loadingFinished':
        this.onLoadingFinished(msg.params);
        break;
      case 'Network.loadingFailed':
        this.onLoadingFailed(msg.params);
        break;
      case 'Runtime.bindingCalled':
        this.onBindingCalled(msg.params);
        break;
    }
  }

  private onRequestWillBeSent(params: Record<string, unknown>): void {
    const requestId = params['requestId'] as string;
    const request = params['request'] as Record<string, unknown>;
    const timestamp = params['timestamp'] as number;

    const rawHeaders = (request['headers'] as Record<string, string>) ?? {};
    const headers: HarHeader[] = Object.entries(rawHeaders).map(([name, value]) => ({
      name,
      value,
    }));

    const postDataEntry = request['postData'];
    const postData =
      typeof postDataEntry === 'string' && postDataEntry.length > 0
        ? { text: postDataEntry }
        : undefined;

    this.pendingRequests.set(requestId, {
      url: (request['url'] as string) ?? '',
      method: (request['method'] as string) ?? 'GET',
      headers,
      postData,
      startTime: timestamp,
    });
  }

  private onResponseReceived(params: Record<string, unknown>): void {
    const requestId = params['requestId'] as string;
    const response = params['response'] as Record<string, unknown>;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    const rawHeaders = (response['headers'] as Record<string, string>) ?? {};
    const responseHeaders: HarHeader[] = Object.entries(rawHeaders).map(([name, value]) => ({
      name,
      value,
    }));

    pending.responseStatus = (response['status'] as number) ?? 0;
    pending.responseHeaders = responseHeaders;
  }

  private onLoadingFinished(params: Record<string, unknown>): void {
    const requestId = params['requestId'] as string;
    const timestamp = params['timestamp'] as number;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.send('Network.getResponseBody', { requestId })
      .then((result) => {
        const body = result as Record<string, unknown>;
        const bodyText = (body['body'] as string) ?? '';
        this.assembleHarEntry(requestId, pending, timestamp, bodyText);
      })
      .catch(() => {
        this.assembleHarEntry(requestId, pending, timestamp, '');
      });
  }

  private onLoadingFailed(params: Record<string, unknown>): void {
    const requestId = params['requestId'] as string;
    const timestamp = params['timestamp'] as number;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.assembleHarEntry(requestId, pending, timestamp, '');
  }

  private assembleHarEntry(
    requestId: string,
    pending: PendingRequest,
    endTimestamp: number,
    bodyText: string,
  ): void {
    this.pendingRequests.delete(requestId);

    const entry: HarEntry = {
      request: {
        url: pending.url,
        method: pending.method,
        headers: pending.headers,
        ...(pending.postData ? { postData: pending.postData } : {}),
      },
      response: {
        status: pending.responseStatus ?? 0,
        headers: pending.responseHeaders ?? [],
        content: { text: bodyText },
      },
      time: Math.round((endTimestamp - pending.startTime) * 1000),
    };

    this.emit('harEntry', entry);
  }

  private onBindingCalled(params: Record<string, unknown>): void {
    const name = params['name'] as string;
    const payloadStr = params['payload'] as string;

    let payload: unknown = payloadStr;
    try {
      payload = JSON.parse(payloadStr) as unknown;
    } catch {
      // leave as raw string
    }

    this.emit('sdkEvent', name, payload);
  }
}
