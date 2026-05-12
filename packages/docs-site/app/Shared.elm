module Shared exposing (Data, Model, Msg(..), SharedMsg(..), template)

import BackendTask exposing (BackendTask)
import Effect exposing (Effect)
import FatalError exposing (FatalError)
import Html exposing (Html)
import Html.Attributes as Attr
import Html.Events
import Pages.Flags
import Pages.PageUrl exposing (PageUrl)
import Route exposing (Route)
import SharedTemplate exposing (SharedTemplate)
import UrlPath exposing (UrlPath)
import View exposing (View)


template : SharedTemplate Msg Model Data msg
template =
    { init = init
    , update = update
    , view = view
    , data = data
    , subscriptions = subscriptions
    , onPageChange = Nothing
    }


type Msg
    = SharedMsg SharedMsg
    | ToggleSidebar


type alias Data =
    ()


type SharedMsg
    = NoOp


type alias Model =
    { sidebarOpen : Bool
    }


init :
    Pages.Flags.Flags
    ->
        Maybe
            { path :
                { path : UrlPath
                , query : Maybe String
                , fragment : Maybe String
                }
            , metadata : route
            , pageUrl : Maybe PageUrl
            }
    -> ( Model, Effect Msg )
init flags maybePagePath =
    ( { sidebarOpen = True }
    , Effect.none
    )


update : Msg -> Model -> ( Model, Effect Msg )
update msg model =
    case msg of
        SharedMsg _ ->
            ( model, Effect.none )

        ToggleSidebar ->
            ( { model | sidebarOpen = not model.sidebarOpen }, Effect.none )


subscriptions : UrlPath -> Model -> Sub Msg
subscriptions _ _ =
    Sub.none


data : BackendTask FatalError Data
data =
    BackendTask.succeed ()


view :
    Data
    ->
        { path : UrlPath
        , route : Maybe Route
        }
    -> Model
    -> (Msg -> msg)
    -> View msg
    -> { body : List (Html msg), title : String }
view sharedData page model toMsg pageView =
    { body =
        [ viewHeader model toMsg
        , Html.div [ Attr.class "layout" ]
            [ viewSidebar model toMsg
            , Html.main_ [ Attr.class "content" ]
                pageView.body
            ]
        ]
    , title = pageView.title
    }


viewHeader : Model -> (Msg -> msg) -> Html msg
viewHeader model toMsg =
    Html.header [ Attr.class "header" ]
        [ Html.button
            [ Attr.class "sidebar-toggle"
            , Html.Events.onClick (toMsg ToggleSidebar)
            ]
            [ Html.text
                (if model.sidebarOpen then
                    "\u{2630}"

                 else
                    "\u{2630}"
                )
            ]
        , Html.a
            [ Attr.class "logo"
            , Attr.href "/"
            ]
            [ Html.text "wolfcola devtools" ]
        , Html.nav [ Attr.class "header-nav" ]
            [ Html.a [ Attr.href "/packages" ] [ Html.text "Packages" ]
            , Html.a [ Attr.href "/guides" ] [ Html.text "Guides" ]
            , Html.a [ Attr.href "/api" ] [ Html.text "API" ]
            , Html.a [ Attr.href "/architecture" ] [ Html.text "Architecture" ]
            , Html.a [ Attr.href "/contributing" ] [ Html.text "Contributing" ]
            ]
        ]


viewSidebar : Model -> (Msg -> msg) -> Html msg
viewSidebar model toMsg =
    Html.aside
        [ Attr.class
            (if model.sidebarOpen then
                "sidebar"

             else
                "sidebar sidebar--closed"
            )
        ]
        [ viewSidebarSection "Packages"
            [ ( "/packages/treeshake-check", "treeshake-check" )
            , ( "/packages/eslint-plugin-treeshake", "eslint-plugin-treeshake" )
            , ( "/packages/devtools-bridge", "devtools-bridge" )
            , ( "/packages/devtools-types", "devtools-types" )
            ]
        , viewSidebarSection "Guides"
            [ ( "/docs/getting-started", "Getting Started" )
            , ( "/docs/devtools-extension", "DevTools Extension" )
            , ( "/docs/vscode-extension", "VS Code Extension" )
            , ( "/docs/tree-shaking", "Tree-Shaking" )
            , ( "/docs/davinci-integration", "DaVinci Integration" )
            ]
        , viewSidebarSection "Contributing"
            [ ( "/contributing/development-setup", "Development Setup" )
            , ( "/contributing/repository-structure", "Repository Structure" )
            , ( "/contributing/code-style", "Code Style" )
            , ( "/contributing/release-process", "Release Process" )
            ]
        ]


viewSidebarSection : String -> List ( String, String ) -> Html msg
viewSidebarSection heading links =
    Html.div [ Attr.class "sidebar-section" ]
        [ Html.h3 [ Attr.class "sidebar-heading" ] [ Html.text heading ]
        , Html.ul [ Attr.class "sidebar-links" ]
            (List.map
                (\( href, label ) ->
                    Html.li []
                        [ Html.a [ Attr.href href ] [ Html.text label ] ]
                )
                links
            )
        ]
