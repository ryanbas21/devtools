module ApiDocs.DevtoolsTypes exposing (modules)

import ApiDocs.Types exposing (ApiModule)


modules : List ApiModule
modules =
    [ { name = "devtools-types"
      , description = "Effect Schema definitions for AuthEvent and FlowState"
      , types =
            [ { name = "AuthEvent"
              , signature = "Schema.TaggedStruct<\"AuthEvent\", { type: string; timestamp: number; data: unknown }>"
              , description = "Represents a single authentication event captured during an OIDC flow."
              }
            , { name = "FlowState"
              , signature = "Schema.TaggedStruct<\"FlowState\", { step: string; tokens: TokenSet | null; error: FlowError | null }>"
              , description = "Represents the state of an OIDC authentication flow at a point in time."
              }
            ]
      , functions =
            [ { name = "decodeAuthEvent"
              , signature = "(input: unknown) => Effect.Effect<AuthEvent, ParseError>"
              , description = "Decode and validate raw data into a typed AuthEvent using Effect Schema."
              , example = Just "import { decodeAuthEvent } from \"@wolfcola/devtools-types\"\n\nconst event = yield* decodeAuthEvent(rawData)"
              }
            ]
      }
    ]
