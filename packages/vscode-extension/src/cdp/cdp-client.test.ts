import { describe, it, expect } from 'vitest';
import { CdpClient } from './cdp-client.js';

describe('CdpClient', () => {
  it('constructs with websocket URL', () => {
    const client = new CdpClient('ws://localhost:9222/devtools/page/ABC');
    expect(client).toBeDefined();
  });
});
