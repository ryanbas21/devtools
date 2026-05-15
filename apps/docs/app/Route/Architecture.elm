module Route.Architecture exposing (ActionData, Data, Model, Msg, route)

import BackendTask exposing (BackendTask)
import FatalError exposing (FatalError)
import Head
import Head.Seo as Seo
import Html
import Html.Attributes as Attr
import Pages.Url
import PagesMsg exposing (PagesMsg)
import RouteBuilder exposing (App, StatelessRoute)
import Shared
import Svg
import Svg.Attributes as SvgAttr
import View exposing (View)


type alias Model =
    {}


type alias Msg =
    ()


type alias RouteParams =
    {}


type alias Data =
    {}


type alias ActionData =
    {}


route : StatelessRoute RouteParams Data ActionData
route =
    RouteBuilder.single
        { head = head
        , data = data
        }
        |> RouteBuilder.buildNoState { view = view }


data : BackendTask FatalError Data
data =
    BackendTask.succeed {}


head :
    App Data ActionData RouteParams
    -> List Head.Tag
head app =
    Seo.summary
        { canonicalUrlOverride = Nothing
        , siteName = "wolfcola devtools"
        , image =
            { url = Pages.Url.external ""
            , alt = "wolfcola devtools"
            , dimensions = Nothing
            , mimeType = Nothing
            }
        , description = "Architecture overview of wolfcola devtools packages"
        , locale = Nothing
        , title = "Architecture - wolfcola devtools"
        }
        |> Seo.website


view :
    App Data ActionData RouteParams
    -> Shared.Model
    -> View (PagesMsg Msg)
view app _ =
    { title = "Architecture - wolfcola devtools"
    , body =
        [ Html.h1 [] [ Html.text "Architecture" ]
        , Html.p []
            [ Html.text "wolfcola devtools is organized into two tool families: "
            , Html.strong [] [ Html.text "OIDC DevTools" ]
            , Html.text " for debugging authentication flows, and "
            , Html.strong [] [ Html.text "Tree-Shake Tools" ]
            , Html.text " for verifying that packages are tree-shakeable by bundlers like Rollup."
            ]
        , Html.div [ Attr.class "architecture-diagram" ]
            [ viewDiagram ]
        , Html.h2 [] [ Html.text "OIDC DevTools" ]
        , Html.dl []
            [ Html.dt [] [ Html.text "@wolfcola/devtools-types" ]
            , Html.dd []
                [ Html.text "Effect Schema definitions for AuthEvent and FlowState. The shared foundation that all other OIDC packages depend on." ]
            , Html.dt [] [ Html.text "@wolfcola/devtools-core" ]
            , Html.dd []
                [ Html.text "Shared annotators (OIDC phase detection, CORS, DPoP, PAR), diagnosis engine, event store, and export/redaction logic. Used by both the browser extension and VS Code extension." ]
            , Html.dt [] [ Html.text "@wolfcola/devtools-bridge" ]
            , Html.dd []
                [ Html.text "SDK adapter for emitting events from DaVinci, Journey, and OIDC clients. Connects to the browser extension or standalone debugger. Depends on devtools-types." ]
            , Html.dt [] [ Html.text "@wolfcola/devtools-standalone" ]
            , Html.dd []
                [ Html.text "Standalone Electron debugger with WebSocket server and MCP integration. Uses devtools-core for event processing and devtools-ui for the Elm panel." ]
            , Html.dt [] [ Html.text "@wolfcola/devtools-ui" ]
            , Html.dd []
                [ Html.text "Elm UI components for Timeline, Flow, and Learn views. Provides the panel interface with inspector tabs, playback controls, and diagnosis display." ]
            , Html.dt [] [ Html.text "@wolfcola/devtools-extension" ]
            , Html.dd []
                [ Html.text "Chrome and Firefox browser extension. Bundles devtools-core and devtools-ui into a DevTools panel with network-first OIDC detection." ]
            , Html.dt [] [ Html.text "oidc-devtools (VS Code)" ]
            , Html.dd []
                [ Html.text "VS Code extension that connects via Chrome DevTools Protocol (CDP) for live auth traffic capture and flow visualization." ]
            ]
        , Html.h2 [] [ Html.text "Tree-Shake Tools" ]
        , Html.dl []
            [ Html.dt [] [ Html.text "@wolfcola/treeshake-check" ]
            , Html.dd []
                [ Html.text "CLI & library to verify packages are tree-shakeable by Rollup. Standalone package." ]
            , Html.dt [] [ Html.text "@wolfcola/eslint-plugin-treeshake" ]
            , Html.dd []
                [ Html.text "ESLint plugin that flags tree-breaking patterns. Can use treeshake-check for bundle-level verification." ]
            ]
        , Html.h2 [] [ Html.text "Utilities" ]
        , Html.dl []
            [ Html.dt [] [ Html.text "@wolfcola/dead-export-finder" ]
            , Html.dd []
                [ Html.text "CLI to find unused exports across monorepo package boundaries. Uses oxc-parser for fast AST analysis." ]
            , Html.dt [] [ Html.text "@wolfcola/changeset-sync-manifest" ]
            , Html.dd []
                [ Html.text "Internal CI tool that syncs package version from changesets to manifest files. Not documented on the docs site." ]
            ]
        ]
    }


viewDiagram : Html.Html (PagesMsg Msg)
viewDiagram =
    Svg.svg
        [ SvgAttr.viewBox "0 0 900 580"
        , SvgAttr.width "900"
        , SvgAttr.height "580"
        , SvgAttr.style "max-width: 100%; height: auto;"
        ]
        [ -- OIDC DevTools group
          svgGroup 20 20 520 540 "OIDC DevTools"
        , svgBox 180 60 200 50 "devtools-types"
        , svgBox 40 160 200 50 "devtools-core"
        , svgBox 300 160 200 50 "devtools-bridge"
        , svgBox 40 270 200 50 "devtools-ui"
        , svgBox 40 370 200 50 "devtools-extension"
        , svgBox 300 370 200 50 "vscode-extension"
        , svgBox 300 470 200 50 "devtools-standalone"

        -- Tree-Shake Tools group
        , svgGroup 570 20 310 200 "Tree-Shake Tools"
        , svgBox 600 60 240 50 "treeshake-check"
        , svgBox 600 160 240 50 "eslint-plugin-treeshake"

        -- Utilities group
        , svgGroup 570 250 310 210 "Utilities"
        , svgBox 600 290 240 50 "dead-export-finder"
        , svgBox 600 390 240 50 "changeset-sync-manifest"

        -- Arrows: devtools-types -> devtools-core
        , svgArrow 230 110 180 160

        -- Arrows: devtools-types -> devtools-bridge
        , svgArrow 330 110 370 160

        -- Arrows: devtools-core -> devtools-extension
        , svgArrow 140 210 140 270

        -- Arrows: devtools-ui -> devtools-extension
        , svgArrow 140 320 140 370

        -- Arrows: devtools-core -> vscode-extension
        , svgArrow 200 210 380 370

        -- Arrows: devtools-core -> devtools-standalone
        , svgArrow 200 210 380 470

        -- Arrows: treeshake-check -> eslint-plugin-treeshake
        , svgArrow 720 110 720 160
        ]


svgBox : Float -> Float -> Float -> Float -> String -> Svg.Svg msg
svgBox x y w h label =
    Svg.g []
        [ Svg.rect
            [ SvgAttr.x (String.fromFloat x)
            , SvgAttr.y (String.fromFloat y)
            , SvgAttr.width (String.fromFloat w)
            , SvgAttr.height (String.fromFloat h)
            , SvgAttr.rx "8"
            , SvgAttr.fill "var(--bg, #ffffff)"
            , SvgAttr.stroke "var(--accent, #3b82f6)"
            , SvgAttr.strokeWidth "2"
            ]
            []
        , Svg.text_
            [ SvgAttr.x (String.fromFloat (x + w / 2))
            , SvgAttr.y (String.fromFloat (y + h / 2 + 5))
            , SvgAttr.textAnchor "middle"
            , SvgAttr.fill "var(--text, #1a1a2e)"
            , SvgAttr.fontFamily "var(--font-mono, monospace)"
            , SvgAttr.fontSize "13"
            ]
            [ Svg.text label ]
        ]


svgGroup : Float -> Float -> Float -> Float -> String -> Svg.Svg msg
svgGroup x y w h label =
    Svg.g []
        [ Svg.rect
            [ SvgAttr.x (String.fromFloat x)
            , SvgAttr.y (String.fromFloat y)
            , SvgAttr.width (String.fromFloat w)
            , SvgAttr.height (String.fromFloat h)
            , SvgAttr.rx "12"
            , SvgAttr.fill "none"
            , SvgAttr.stroke "var(--border, #e5e7eb)"
            , SvgAttr.strokeWidth "2"
            , SvgAttr.strokeDasharray "8 4"
            ]
            []
        , Svg.text_
            [ SvgAttr.x (String.fromFloat (x + 16))
            , SvgAttr.y (String.fromFloat (y + 16))
            , SvgAttr.fill "var(--text-muted, #6b7280)"
            , SvgAttr.fontSize "12"
            , SvgAttr.fontWeight "600"
            , SvgAttr.textAnchor "start"
            , SvgAttr.dominantBaseline "hanging"
            ]
            [ Svg.text label ]
        ]


svgArrow : Float -> Float -> Float -> Float -> Svg.Svg msg
svgArrow x1 y1 x2 y2 =
    Svg.g []
        [ Svg.line
            [ SvgAttr.x1 (String.fromFloat x1)
            , SvgAttr.y1 (String.fromFloat y1)
            , SvgAttr.x2 (String.fromFloat x2)
            , SvgAttr.y2 (String.fromFloat y2)
            , SvgAttr.stroke "var(--text-muted, #6b7280)"
            , SvgAttr.strokeWidth "2"
            , SvgAttr.markerEnd "url(#arrowhead)"
            ]
            []
        , Svg.defs []
            [ Svg.marker
                [ SvgAttr.id "arrowhead"
                , SvgAttr.markerWidth "10"
                , SvgAttr.markerHeight "7"
                , SvgAttr.refX "10"
                , SvgAttr.refY "3.5"
                , SvgAttr.orient "auto"
                ]
                [ Svg.polygon
                    [ SvgAttr.points "0 0, 10 3.5, 0 7"
                    , SvgAttr.fill "var(--text-muted, #6b7280)"
                    ]
                    []
                ]
            ]
        ]
