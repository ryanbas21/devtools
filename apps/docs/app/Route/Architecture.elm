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
        , Html.h2 [] [ Html.text "Package Relationships" ]
        , Html.dl []
            [ Html.dt [] [ Html.text "@wolfcola/devtools-types" ]
            , Html.dd []
                [ Html.text "Effect Schema definitions for AuthEvent and FlowState. Shared foundation used by devtools-bridge." ]
            , Html.dt [] [ Html.text "@wolfcola/devtools-bridge" ]
            , Html.dd []
                [ Html.text "SDK adapter for emitting events from DaVinci, Journey, and OIDC clients. Depends on devtools-types." ]
            , Html.dt [] [ Html.text "@wolfcola/treeshake-check" ]
            , Html.dd []
                [ Html.text "CLI & library to verify packages are tree-shakeable by Rollup. Standalone package." ]
            , Html.dt [] [ Html.text "@wolfcola/eslint-plugin-treeshake" ]
            , Html.dd []
                [ Html.text "ESLint plugin that flags tree-breaking patterns. Can use treeshake-check for verification." ]
            ]
        ]
    }


viewDiagram : Html.Html (PagesMsg Msg)
viewDiagram =
    Svg.svg
        [ SvgAttr.viewBox "0 0 700 360"
        , SvgAttr.width "700"
        , SvgAttr.height "360"
        , SvgAttr.style "max-width: 100%; height: auto;"
        ]
        [ -- OIDC DevTools group
          svgGroup 20 20 320 300 "OIDC DevTools"
        , svgBox 60 80 240 60 "devtools-types"
        , svgBox 60 200 240 60 "devtools-bridge"

        -- Tree-Shake Tools group
        , svgGroup 370 20 310 300 "Tree-Shake Tools"
        , svgBox 400 80 240 60 "treeshake-check"
        , svgBox 400 200 240 60 "eslint-plugin-treeshake"

        -- Arrows
        , svgArrow 180 140 180 200

        -- devtools-types -> devtools-bridge
        , svgArrow 520 160 520 200

        -- treeshake-check -> eslint-plugin-treeshake (optional dependency)
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
