module ApiDocs.DevtoolsBridge exposing (modules)

import ApiDocs.Types exposing (ApiModule)


modules : List ApiModule
modules =
    [ { name = "devtools-bridge"
      , description = "SDK adapter for emitting events from DaVinci, Journey, OIDC clients"
      , types =
            [ { name = "Bridge"
              , signature = "type Bridge = { emit: (event: AuthEvent) => void; destroy: () => void }"
              , description = "A bridge instance that emits AuthEvent objects to the DevTools panel."
              }
            ]
      , functions =
            [ { name = "createBridge"
              , signature = "(adapter: Adapter) => Bridge"
              , description = "Create a bridge instance from an SDK adapter."
              , example = Just "import { createBridge } from \"@wolfcola/devtools-bridge\"\nimport { davinci } from \"@wolfcola/devtools-bridge/adapters/davinci\"\n\nconst bridge = createBridge(davinci(client))"
              }
            ]
      }
    ]
