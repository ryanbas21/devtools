---
title: '@wolfcola/devtools-types'
description: 'Effect Schema definitions for AuthEvent and FlowState'
section: packages
order: 4
---

# @wolfcola/devtools-types

This package provides the shared type definitions and runtime validators for the wolfcola devtools ecosystem. All types are defined using [Effect Schema](https://effect.website/docs/schema/introduction), giving you both TypeScript types and runtime validation in a single definition.

## Installation

```bash
npm install @wolfcola/devtools-types
```

This package has `effect` as a peer dependency. Make sure Effect is installed in your project:

```bash
npm install effect
```

## Key Types

### AuthEvent

Represents a single authentication event captured during an OIDC flow.

```typescript
import { Schema } from 'effect';

const AuthEvent = Schema.TaggedStruct('AuthEvent', {
  type: Schema.String,
  timestamp: Schema.Number,
  data: Schema.Unknown,
});
```

The `type` field identifies the kind of event (e.g. `"authorize"`, `"token_exchange"`, `"refresh"`, `"error"`). The `timestamp` is milliseconds since the epoch. The `data` field contains event-specific payload.

### FlowState

Represents the state of an OIDC authentication flow at a point in time.

```typescript
const FlowState = Schema.TaggedStruct('FlowState', {
  step: Schema.String,
  tokens: Schema.NullOr(TokenSet),
  error: Schema.NullOr(FlowError),
});
```

A `FlowState` tracks which step the user is on, whether tokens have been issued, and whether an error has occurred.

### TokenSet

```typescript
const TokenSet = Schema.Struct({
  accessToken: Schema.String,
  idToken: Schema.OptionFromNullishOr(Schema.String),
  refreshToken: Schema.OptionFromNullishOr(Schema.String),
  expiresAt: Schema.Number,
});
```

### FlowError

```typescript
const FlowError = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  details: Schema.optional(Schema.Unknown),
});
```

## Usage with Effect

### Decoding Events

Use the provided decode functions to validate raw data at runtime:

```typescript
import { Effect } from 'effect';
import { decodeAuthEvent } from '@wolfcola/devtools-types';

const program = Effect.gen(function* () {
  const rawData = yield* getEventFromExtension();
  const event = yield* decodeAuthEvent(rawData);

  // event is now fully typed as AuthEvent
  console.log(event.type, event.timestamp);
});
```

### Encoding Events

Encode typed events back to plain objects for serialization:

```typescript
import { encodeAuthEvent } from '@wolfcola/devtools-types';

const plain = yield * encodeAuthEvent(event);
// plain is a plain JavaScript object safe to send over postMessage
```

### Custom Event Types

Extend the base `AuthEvent` schema for domain-specific events:

```typescript
import { Schema } from 'effect';
import { AuthEvent } from '@wolfcola/devtools-types';

const DaVinciEvent = Schema.extend(
  AuthEvent,
  Schema.Struct({
    nodeId: Schema.String,
    flowId: Schema.String,
  }),
);
```

<callout type="warning">This package uses `Schema.TaggedStruct` for discriminated unions. Make sure you are on Effect 3.10 or later, which includes the tagged struct API.</callout>

## Versioning

The schema definitions follow semantic versioning. Breaking changes to the shape of `AuthEvent` or `FlowState` will result in a major version bump. Additive changes (new optional fields) are minor versions.
