---
title: '@wolfcola/devtools-types'
description: 'Effect Schema definitions for AuthEvent, FlowState, and related types'
section: packages
order: 4
---

# @wolfcola/devtools-types

This package provides the shared type definitions and runtime validators for the wolfcola devtools ecosystem. All types are defined using [Effect Schema](https://effect.website/docs/schema/introduction), giving you both TypeScript types and runtime validation from a single source of truth.

## Installation

```bash
npm install @wolfcola/devtools-types
```

This package has `effect` as a peer dependency:

```bash
npm install effect
```

## Auth Event Schemas

### `AuthEventSchema`

The top-level event schema. Every event captured by the devtools bridge conforms to this shape.

```typescript
Schema.Struct({
  id: Schema.String,
  timestamp: Schema.Number,
  type: AuthEventTypeSchema,
  source: Schema.Union('network', 'sdk', 'dom', 'session'),
  flowId: Schema.NullOr(Schema.String),
  causedBy: Schema.NullOr(Schema.String),
  data: Schema.Union(
    NetworkDataSchema,
    SdkDataSchema,
    SdkConfigDataSchema,
    DomDataSchema,
    SessionDataSchema,
    JourneyDataSchema,
    OidcDataSchema,
  ),
  flags: AuthEventFlagsSchema,
  oidcSemantics: Schema.optional(OidcSemanticsSchema),
});
```

### `AuthEventTypeSchema`

A union of all valid event type strings:

`'network:request'` | `'network:response'` | `'network:cors-flag'` | `'sdk:node-change'` | `'sdk:action'` | `'sdk:config'` | `'sdk:journey-step'` | `'sdk:oidc-state'` | `'dom:form-submit'` | `'dom:redirect'` | `'session:cookie'` | `'session:storage'`

### `AuthEventFlagsSchema`

```typescript
Schema.Struct({
  isCors: Schema.Boolean,
  isError: Schema.Boolean,
  isAuthRelated: Schema.Boolean,
});
```

## Data Schemas (TaggedStruct)

Each event data variant uses `Schema.TaggedStruct` for discriminated unions via the `_tag` field.

### `NetworkDataSchema` (tag: `'network'`)

Network request/response data with URL, method, status, headers, duration, optional CORS flag, and optional request/response bodies.

### `SdkDataSchema` (tag: `'sdk'`)

SDK node change data including `nodeStatus`, `previousStatus`, `interactionId`, `interactionToken`, `nodeId`, `requestId`, `nodeName`, `nodeDescription`, `eventName`, `httpStatus`, `collectors`, `error` (via `SdkErrorSchema`), `authorization` (via `SdkAuthorizationSchema`), `session`, and `responseBody`.

### `SdkConfigDataSchema` (tag: `'sdk-config'`)

SDK configuration data containing a single `config: Schema.Unknown` field.

### `DomDataSchema` (tag: `'dom'`)

DOM event data with optional `element` and `url` fields.

### `SessionDataSchema` (tag: `'session'`)

Session change data with `key`, optional `before`, and optional `after` fields for tracking cookie and localStorage mutations.

### `JourneyDataSchema` (tag: `'journey'`)

Journey/Tree authentication data with `stepType` (`'Step'` | `'LoginSuccess'` | `'LoginFailure'`), optional `callbacks`, `authId`, `tokenId`, `successUrl`, `realm`, `stage`, `header`, `description`, `errorCode`, `errorMessage`, and `errorReason`.

### `OidcDataSchema` (tag: `'oidc'`)

OIDC state data with `phase` (`'authorize'` | `'exchange'` | `'revoke'` | `'userinfo'` | `'logout'`), `status` (`'success'` | `'error'`), and optional `clientId`, `errorCode`, `errorMessage`.

## CORS Schema

### `CorsFlagSchema`

Describes a detected CORS issue with `url`, `reason` (one of `'status-zero'`, `'missing-allow-origin'`, `'credentials-mismatch'`, `'wildcard-with-credentials'`, `'preflight-failed'`), `method`, and optional `preflightStatus`, `allowOrigin`, `allowCredentials`.

## OIDC Semantic Schemas

Fine-grained OIDC protocol details attached optionally to any `AuthEvent`.

### `OidcSemanticsSchema` (tag: `'oidc-semantics'`)

Contains `oidcPhase` (`'discovery'` | `'authorize'` | `'par'` | `'token'` | `'userinfo'` | `'revocation'` | `'introspection'` | `'end-session'` | `'jwks'`), and optional fields: `grantType`, `pkce` (via `OidcPkceSchema`), `dpop` (via `OidcDpopSchema`), `par` (via `OidcParSchema`), `state`, `nonce`, `clientId`, `tokens` (via `OidcTokensSchema`), `error` (via `OidcErrorSchema`).

### `OidcPkceSchema`

PKCE details: optional `challengeMethod` and required `hasVerifier: boolean`.

### `OidcDpopSchema`

DPoP details: optional `proofJwt`, `tokenType`, `nonce`.

### `OidcParSchema`

Pushed Authorization Request details: optional `requestUri` and `expiresIn`.

### `OidcTokensSchema`

Token presence indicators: optional booleans for `accessToken`, `refreshToken`, `idToken`, plus optional `tokenType` and `expiresIn`.

### `OidcErrorSchema`

OIDC error with required `error: string` and optional `errorDescription`.

## Flow State Schemas

### `FlowStateSchema`

Represents the state of a captured authentication flow.

```typescript
Schema.Struct({
  flowId: Schema.NullOr(Schema.String),
  capturedAt: Schema.String,
  events: Schema.Array(AuthEventSchema),
  summary: FlowSummarySchema,
  lastSdkEventId: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
});
```

### `FlowSummarySchema`

Aggregate statistics for a flow: `nodeCount`, `errorCount`, `corsFlags` (array of `CorsFlagSchema`), `duration`, and `sdkConnected`.

### `FlowExportSchema`

Wraps a `FlowState` for export/import with `version: 1`, `exportedAt`, `redacted`, and `flow`.

## Derived Types

All TypeScript types are derived from their schemas using `Schema.Schema.Type`:

`AuthEvent`, `AuthEventType`, `AuthEventFlags`, `NetworkData`, `SdkData`, `SdkConfigData`, `DomData`, `SessionData`, `JourneyData`, `OidcData`, `CorsFlag`, `OidcSemantics`, `FlowState`, `FlowSummary`, `FlowExport`

<callout type="warning">This package uses `Schema.TaggedStruct` for discriminated unions. Make sure you are on Effect 3.10 or later.</callout>

## Versioning

The schema definitions follow semantic versioning. Breaking changes to the shape of `AuthEvent` or `FlowState` will result in a major version bump. Additive changes (new optional fields) are minor versions.
