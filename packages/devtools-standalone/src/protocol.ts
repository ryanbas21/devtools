import { Schema } from 'effect';

export const HandshakeMessage = Schema.Struct({
  type: Schema.Literal('HANDSHAKE'),
  name: Schema.String,
  pid: Schema.optional(Schema.Number),
  framework: Schema.optional(Schema.String),
});
export type HandshakeMessage = typeof HandshakeMessage.Type;

export const SdkEventMessage = Schema.Struct({
  type: Schema.Literal('SDK_EVENT'),
  payload: Schema.Unknown,
});
export type SdkEventMessage = typeof SdkEventMessage.Type;

export const NetworkEventMessage = Schema.Struct({
  type: Schema.Literal('NETWORK_EVENT'),
  payload: Schema.Struct({
    request: Schema.Struct({
      url: Schema.String,
      method: Schema.String,
      headers: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
      postData: Schema.optional(Schema.Struct({ text: Schema.String })),
    }),
    response: Schema.Struct({
      status: Schema.Number,
      headers: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
      content: Schema.optional(Schema.Struct({ text: Schema.String })),
    }),
    time: Schema.Number,
  }),
});
export type NetworkEventMessage = typeof NetworkEventMessage.Type;

export const ClearMessage = Schema.Struct({
  type: Schema.Literal('CLEAR'),
});
export type ClearMessage = typeof ClearMessage.Type;

export const ConnectedMessage = Schema.Struct({
  type: Schema.Literal('CONNECTED'),
  sessionId: Schema.String,
});
export type ConnectedMessage = typeof ConnectedMessage.Type;

export const ConfigMessage = Schema.Struct({
  type: Schema.Literal('CONFIG'),
  payload: Schema.Unknown,
});
export type ConfigMessage = typeof ConfigMessage.Type;

export const IncomingMessage = Schema.Union(
  HandshakeMessage,
  SdkEventMessage,
  NetworkEventMessage,
  ClearMessage,
);
export type IncomingMessage = typeof IncomingMessage.Type;

export const OutgoingMessage = Schema.Union(ConnectedMessage, ConfigMessage);
export type OutgoingMessage = typeof OutgoingMessage.Type;

export const IncomingMessageFromJson = Schema.parseJson(IncomingMessage);
export const HandshakeMessageFromJson = Schema.parseJson(HandshakeMessage);
