module ApiDocs.TreeshakeCheck exposing (modules)

import ApiDocs.Types exposing (ApiModule)


modules : List ApiModule
modules =
    [ { name = "treeshake-check"
      , description = "CLI & library to verify packages are tree-shakeable by Rollup"
      , types =
            [ { name = "TreeshakeResult"
              , signature = "type TreeshakeResult = { passed: boolean; exports: ExportResult[] }"
              , description = "The result of checking a package for tree-shaking support."
              }
            , { name = "ExportResult"
              , signature = "type ExportResult = { name: string; bundleSize: number; treeshakeable: boolean }"
              , description = "Result for an individual export."
              }
            ]
      , functions =
            [ { name = "checkTreeShaking"
              , signature = "(packageName: string, options?: CheckOptions) => Effect.Effect<TreeshakeResult, TreeshakeError>"
              , description = "Check whether a package's exports are tree-shakeable."
              , example = Just "import { checkTreeShaking } from \"@wolfcola/treeshake-check\"\n\nconst result = yield* checkTreeShaking(\"my-package\")"
              }
            ]
      }
    ]
