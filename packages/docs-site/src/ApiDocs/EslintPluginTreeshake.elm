module ApiDocs.EslintPluginTreeshake exposing (modules)

import ApiDocs.Types exposing (ApiModule)


modules : List ApiModule
modules =
    [ { name = "eslint-plugin-treeshake"
      , description = "ESLint plugin that flags tree-breaking patterns"
      , types = []
      , functions =
            [ { name = "configs.recommended"
              , signature = "Linter.FlatConfig"
              , description = "Recommended flat config preset that enables all tree-shaking rules."
              , example = Just "import treeshake from \"@wolfcola/eslint-plugin-treeshake\"\n\nexport default [treeshake.configs.recommended]"
              }
            ]
      }
    ]
