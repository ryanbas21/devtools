import { describe, it, expect } from 'vitest';
import { Schema } from 'effect';
import {
  HandshakeMessage,
  SdkEventMessage,
  NetworkEventMessage,
  ClearMessage,
  ConnectedMessage,
  IncomingMessage,
} from './protocol.js';

describe('Protocol Schemas', () => {
  describe('HandshakeMessage', () => {
    it('decodes a valid handshake', () => {
      const input = { type: 'HANDSHAKE', name: 'my-app', pid: 12345, framework: 'next' };
      const result = Schema.decodeUnknownSync(HandshakeMessage)(input);
      expect(result.type).toBe('HANDSHAKE');
      expect(result.name).toBe('my-app');
      expect(result.pid).toBe(12345);
      expect(result.framework).toBe('next');
    });

    it('decodes handshake without optional fields', () => {
      const input = { type: 'HANDSHAKE', name: 'my-app' };
      const result = Schema.decodeUnknownSync(HandshakeMessage)(input);
      expect(result.name).toBe('my-app');
      expect(result.pid).toBeUndefined();
      expect(result.framework).toBeUndefined();
    });

    it('rejects handshake missing name', () => {
      const input = { type: 'HANDSHAKE' };
      expect(() => Schema.decodeUnknownSync(HandshakeMessage)(input)).toThrow();
    });
  });

  describe('SdkEventMessage', () => {
    it('decodes a valid SDK event message', () => {
      const input = { type: 'SDK_EVENT', payload: { id: 'e1', timestamp: 100 } };
      const result = Schema.decodeUnknownSync(SdkEventMessage)(input);
      expect(result.type).toBe('SDK_EVENT');
      expect(result.payload).toEqual({ id: 'e1', timestamp: 100 });
    });
  });

  describe('NetworkEventMessage', () => {
    it('decodes a valid network event message', () => {
      const input = {
        type: 'NETWORK_EVENT',
        payload: {
          request: { url: '/token', method: 'POST', headers: [] },
          response: { status: 200, headers: [] },
          time: 50,
        },
      };
      const result = Schema.decodeUnknownSync(NetworkEventMessage)(input);
      expect(result.type).toBe('NETWORK_EVENT');
    });
  });

  describe('ClearMessage', () => {
    it('decodes a clear message', () => {
      const input = { type: 'CLEAR' };
      const result = Schema.decodeUnknownSync(ClearMessage)(input);
      expect(result.type).toBe('CLEAR');
    });
  });

  describe('ConnectedMessage', () => {
    it('encodes a connected response', () => {
      const msg = { type: 'CONNECTED' as const, sessionId: 'sess-1' };
      const result = Schema.encodeSync(ConnectedMessage)(msg);
      expect(result).toEqual({ type: 'CONNECTED', sessionId: 'sess-1' });
    });
  });

  describe('IncomingMessage (union)', () => {
    it('decodes handshake via union', () => {
      const input = { type: 'HANDSHAKE', name: 'app' };
      const result = Schema.decodeUnknownSync(IncomingMessage)(input);
      expect(result.type).toBe('HANDSHAKE');
    });

    it('decodes SDK_EVENT via union', () => {
      const input = { type: 'SDK_EVENT', payload: {} };
      const result = Schema.decodeUnknownSync(IncomingMessage)(input);
      expect(result.type).toBe('SDK_EVENT');
    });

    it('decodes NETWORK_EVENT via union', () => {
      const input = {
        type: 'NETWORK_EVENT',
        payload: {
          request: { url: '/x', method: 'GET', headers: [] },
          response: { status: 200, headers: [] },
          time: 0,
        },
      };
      const result = Schema.decodeUnknownSync(IncomingMessage)(input);
      expect(result.type).toBe('NETWORK_EVENT');
    });

    it('decodes CLEAR via union', () => {
      const result = Schema.decodeUnknownSync(IncomingMessage)({ type: 'CLEAR' });
      expect(result.type).toBe('CLEAR');
    });

    it('rejects unknown message types', () => {
      expect(() => Schema.decodeUnknownSync(IncomingMessage)({ type: 'UNKNOWN' })).toThrow();
    });
  });
});
