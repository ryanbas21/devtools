module Route.Index exposing (ActionData, Data, Model, Msg, route)

import BackendTask exposing (BackendTask)
import FatalError exposing (FatalError)
import Head
import Head.Seo as Seo
import Html
import Html.Attributes as Attr
import Pages.Url
import PagesMsg exposing (PagesMsg)
import UrlPath
import Route
import RouteBuilder exposing (App, StatelessRoute)
import Shared
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
            { url = [ "images", "icon-png.png" ] |> UrlPath.join |> Pages.Url.fromPath
            , alt = "wolfcola devtools logo"
            , dimensions = Nothing
            , mimeType = Nothing
            }
        , description = "Developer tools for OIDC debugging and tree-shake verification"
        , locale = Nothing
        , title = "wolfcola devtools"
        }
        |> Seo.website


view :
    App Data ActionData RouteParams
    -> Shared.Model
    -> View (PagesMsg Msg)
view app shared =
    { title = "wolfcola devtools"
    , body =
        [ viewHero
        , viewPackageGrid
        , viewQuickLinks
        ]
    }


viewHero : Html.Html (PagesMsg Msg)
viewHero =
    Html.section [ Attr.class "hero" ]
        [ Html.h1 [] [ Html.text "wolfcola devtools" ]
        , Html.p [ Attr.class "hero-subtitle" ]
            [ Html.text "Developer tools for OIDC debugging and tree-shake verification" ]
        ]


viewPackageGrid : Html.Html (PagesMsg Msg)
viewPackageGrid =
    Html.div [ Attr.class "package-grid" ]
        [ viewPackageCard
            { name = "@wolfcola/treeshake-check"
            , description = "CLI & library to verify packages are tree-shakeable by Rollup"
            , href = "/packages/treeshake-check"
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/eslint-plugin-treeshake"
            , description = "ESLint plugin that flags tree-breaking patterns"
            , href = "/packages/eslint-plugin-treeshake"
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/devtools-bridge"
            , description = "SDK adapter for emitting events from DaVinci, Journey, OIDC clients"
            , href = "/packages/devtools-bridge"
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/devtools-types"
            , description = "Effect Schema definitions for AuthEvent and FlowState"
            , href = "/packages/devtools-types"
            , tag = "Published"
            }
        ]


viewPackageCard :
    { name : String, description : String, href : String, tag : String }
    -> Html.Html (PagesMsg Msg)
viewPackageCard pkg =
    Html.a [ Attr.class "package-card", Attr.href pkg.href ]
        [ Html.div [ Attr.class "package-card-header" ]
            [ Html.h3 [] [ Html.text pkg.name ]
            , Html.span [ Attr.class "package-tag" ] [ Html.text pkg.tag ]
            ]
        , Html.p [] [ Html.text pkg.description ]
        ]


viewQuickLinks : Html.Html (PagesMsg Msg)
viewQuickLinks =
    Html.section [ Attr.class "quick-links" ]
        [ Html.h2 [] [ Html.text "Quick Links" ]
        , Html.ul []
            [ Html.li []
                [ Html.a [ Attr.href "/docs/getting-started" ]
                    [ Html.text "Installation & Setup" ]
                ]
            , Html.li []
                [ Html.a [ Attr.href "/architecture" ]
                    [ Html.text "Architecture Overview" ]
                ]
            , Html.li []
                [ Html.a [ Attr.href "/contributing/development-setup" ]
                    [ Html.text "Contributing" ]
                ]
            ]
        ]
