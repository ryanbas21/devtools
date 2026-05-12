module Shared exposing (Data, Model, Msg(..), SharedMsg(..), template)

import BackendTask exposing (BackendTask)
import BackendTask.File as File
import BackendTask.Glob as Glob
import Effect exposing (Effect)
import FatalError exposing (FatalError)
import Html exposing (Html)
import Html.Attributes as Attr exposing (attribute)
import Html.Events
import Json.Decode as Decode
import Pages.Flags
import Pages.PageUrl exposing (PageUrl)
import Route exposing (Route)
import Search exposing (SearchEntry, SearchIndex)
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
    | ToggleTheme
    | SearchInput String


type alias Data =
    { searchIndex : SearchIndex
    }


type SharedMsg
    = NoOp


type alias Model =
    { sidebarOpen : Bool
    , searchQuery : String
    , darkMode : Bool
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
    let
        darkMode =
            case flags of
                Pages.Flags.BrowserFlags value ->
                    Decode.decodeValue
                        (Decode.field "darkMode" Decode.bool)
                        value
                        |> Result.withDefault False

                Pages.Flags.PreRenderFlags ->
                    False
    in
    ( { sidebarOpen = True
      , searchQuery = ""
      , darkMode = darkMode
      }
    , Effect.none
    )


update : Msg -> Model -> ( Model, Effect Msg )
update msg model =
    case msg of
        SharedMsg _ ->
            ( model, Effect.none )

        ToggleSidebar ->
            ( { model | sidebarOpen = not model.sidebarOpen }, Effect.none )

        ToggleTheme ->
            ( { model | darkMode = not model.darkMode }, Effect.none )

        SearchInput query ->
            ( { model | searchQuery = query }, Effect.none )


subscriptions : UrlPath -> Model -> Sub Msg
subscriptions _ _ =
    Sub.none


data : BackendTask FatalError Data
data =
    BackendTask.map3
        (\docsEntries packageEntries contributingEntries ->
            { searchIndex =
                Search.buildIndex
                    (docsEntries ++ packageEntries ++ contributingEntries)
            }
        )
        (globEntries "content/docs/" "docs")
        (globEntries "content/packages/" "packages")
        (globEntries "content/contributing/" "contributing")


globEntries : String -> String -> BackendTask FatalError (List SearchEntry)
globEntries dir section =
    Glob.succeed (\slug -> slug)
        |> Glob.match (Glob.literal dir)
        |> Glob.capture Glob.wildcard
        |> Glob.match (Glob.literal ".md")
        |> Glob.toBackendTask
        |> BackendTask.andThen
            (\slugs ->
                slugs
                    |> List.map
                        (\slug ->
                            File.onlyFrontmatter
                                (Decode.map2
                                    (\title description ->
                                        { title = title
                                        , url = "/" ++ sectionToUrlPrefix section ++ "/" ++ slug
                                        , section = section
                                        , excerpt = description
                                        }
                                    )
                                    (Decode.field "title" Decode.string)
                                    (Decode.field "description" Decode.string)
                                )
                                (dir ++ slug ++ ".md")
                                |> BackendTask.allowFatal
                        )
                    |> BackendTask.combine
            )


sectionToUrlPrefix : String -> String
sectionToUrlPrefix section =
    case section of
        "guides" ->
            "docs"

        "docs" ->
            "docs"

        "packages" ->
            "packages"

        "contributing" ->
            "contributing"

        _ ->
            section


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
        [ Html.div
            [ attribute "data-theme"
                (if model.darkMode then
                    "dark"

                 else
                    "light"
                )
            ]
            [ viewHeader sharedData model toMsg
            , Html.div [ Attr.class "layout" ]
                [ viewSidebar model toMsg
                , Html.main_ [ Attr.class "content" ]
                    pageView.body
                ]
            ]
        ]
    , title = pageView.title
    }


viewHeader : Data -> Model -> (Msg -> msg) -> Html msg
viewHeader sharedData model toMsg =
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
        , viewSearch sharedData model toMsg
        , Html.nav [ Attr.class "header-nav" ]
            [ Html.a [ Attr.href "/packages/treeshake-check" ] [ Html.text "Packages" ]
            , Html.a [ Attr.href "/docs/getting-started" ] [ Html.text "Guides" ]
            , Html.a [ Attr.href "/api/treeshake-check/treeshake-check" ] [ Html.text "API" ]
            , Html.a [ Attr.href "/architecture" ] [ Html.text "Architecture" ]
            , Html.a [ Attr.href "/contributing/development-setup" ] [ Html.text "Contributing" ]
            ]
        , Html.button
            [ Attr.class "theme-toggle"
            , Html.Events.onClick (toMsg ToggleTheme)
            ]
            [ Html.text
                (if model.darkMode then
                    "Light"

                 else
                    "Dark"
                )
            ]
        ]


viewSearch : Data -> Model -> (Msg -> msg) -> Html msg
viewSearch sharedData model toMsg =
    let
        results =
            Search.search model.searchQuery sharedData.searchIndex
    in
    Html.div [ Attr.class "search-wrapper" ]
        ([ Html.input
            [ Attr.class "search-input"
            , Attr.type_ "text"
            , Attr.placeholder "Search docs..."
            , Attr.value model.searchQuery
            , Html.Events.onInput (\val -> toMsg (SearchInput val))
            ]
            []
         ]
            ++ (if List.isEmpty results then
                    []

                else
                    [ Html.div [ Attr.class "search-results" ]
                        (List.map viewSearchResult results)
                    ]
               )
        )


viewSearchResult : Search.SearchResult -> Html msg
viewSearchResult result =
    Html.a
        [ Attr.class "search-result"
        , Attr.href result.url
        ]
        [ Html.span [ Attr.class "search-result-section" ] [ Html.text result.section ]
        , Html.span [ Attr.class "search-result-title" ] [ Html.text result.title ]
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
            , ( "/docs/journey-integration", "Journey Integration" )
            , ( "/docs/oidc-integration", "Generic OIDC Integration" )
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
