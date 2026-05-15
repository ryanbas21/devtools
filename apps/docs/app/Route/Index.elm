module Route.Index exposing (ActionData, Data, Model, Msg, route)

import BackendTask exposing (BackendTask)
import FatalError exposing (FatalError)
import Head
import Head.Seo as Seo
import Html
import Html.Attributes as Attr
import Pages.Url
import PagesMsg exposing (PagesMsg)
import Route exposing (Route)
import UrlPath
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
            , route = Route.Packages__Slug_ { slug = "treeshake-check" }
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/eslint-plugin-treeshake"
            , description = "ESLint plugin that flags tree-breaking patterns"
            , route = Route.Packages__Slug_ { slug = "eslint-plugin-treeshake" }
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/devtools-bridge"
            , description = "SDK adapter for emitting events from DaVinci, Journey, OIDC clients"
            , route = Route.Packages__Slug_ { slug = "devtools-bridge" }
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/devtools-types"
            , description = "Effect Schema definitions for AuthEvent and FlowState"
            , route = Route.Packages__Slug_ { slug = "devtools-types" }
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/dead-export-finder"
            , description = "CLI to find unused exports across monorepo package boundaries"
            , route = Route.Packages__Slug_ { slug = "dead-export-finder" }
            , tag = "Published"
            }
        , viewPackageCard
            { name = "@wolfcola/devtools-standalone"
            , description = "Standalone Electron debugger with WebSocket server and MCP integration"
            , route = Route.Packages__Slug_ { slug = "devtools-standalone" }
            , tag = "New"
            }
        ]


viewPackageCard :
    { name : String, description : String, route : Route, tag : String }
    -> Html.Html (PagesMsg Msg)
viewPackageCard pkg =
    Route.link [ Attr.class "package-card" ]
        [ Html.div [ Attr.class "package-card-header" ]
            [ Html.h3 [] [ Html.text pkg.name ]
            , Html.span [ Attr.class "package-tag" ] [ Html.text pkg.tag ]
            ]
        , Html.p [] [ Html.text pkg.description ]
        ]
        pkg.route


viewQuickLinks : Html.Html (PagesMsg Msg)
viewQuickLinks =
    Html.section [ Attr.class "quick-links" ]
        [ Html.h2 [] [ Html.text "Quick Links" ]
        , Html.ul []
            [ Html.li []
                [ Route.link [] [ Html.text "Installation & Setup" ] (Route.Docs__Slug_ { slug = "getting-started" })
                ]
            , Html.li []
                [ Route.link [] [ Html.text "Architecture Overview" ] Route.Architecture
                ]
            , Html.li []
                [ Route.link [] [ Html.text "Contributing" ] (Route.Contributing__Slug_ { slug = "development-setup" })
                ]
            ]
        ]
