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
                                        , url = Route.baseUrl ++ sectionToUrlPrefix section ++ "/" ++ slug
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
        , Route.link [ Attr.class "logo" ] [ Html.text "wolfcola devtools" ] Route.Index
        , viewSearch sharedData model toMsg
        , Html.nav [ Attr.class "header-nav" ]
            [ Route.link [] [ Html.text "Packages" ] (Route.Packages__Slug_ { slug = "treeshake-check" })
            , Route.link [] [ Html.text "Guides" ] (Route.Docs__Slug_ { slug = "getting-started" })
            , Route.link [] [ Html.text "Architecture" ] Route.Architecture
            , Route.link [] [ Html.text "Contributing" ] (Route.Contributing__Slug_ { slug = "development-setup" })
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
            [ ( Route.Packages__Slug_ { slug = "treeshake-check" }, "treeshake-check" )
            , ( Route.Packages__Slug_ { slug = "eslint-plugin-treeshake" }, "eslint-plugin-treeshake" )
            , ( Route.Packages__Slug_ { slug = "devtools-bridge" }, "devtools-bridge" )
            , ( Route.Packages__Slug_ { slug = "devtools-types" }, "devtools-types" )
            ]
        , viewSidebarSection "Guides"
            [ ( Route.Docs__Slug_ { slug = "getting-started" }, "Getting Started" )
            , ( Route.Docs__Slug_ { slug = "devtools-extension" }, "DevTools Extension" )
            , ( Route.Docs__Slug_ { slug = "vscode-extension" }, "VS Code Extension" )
            , ( Route.Docs__Slug_ { slug = "tree-shaking" }, "Tree-Shaking" )
            , ( Route.Docs__Slug_ { slug = "davinci-integration" }, "DaVinci Integration" )
            , ( Route.Docs__Slug_ { slug = "journey-integration" }, "Journey Integration" )
            , ( Route.Docs__Slug_ { slug = "oidc-integration" }, "Generic OIDC Integration" )
            ]
        , viewSidebarSection "Contributing"
            [ ( Route.Contributing__Slug_ { slug = "development-setup" }, "Development Setup" )
            , ( Route.Contributing__Slug_ { slug = "repository-structure" }, "Repository Structure" )
            , ( Route.Contributing__Slug_ { slug = "code-style" }, "Code Style" )
            , ( Route.Contributing__Slug_ { slug = "release-process" }, "Release Process" )
            ]
        ]


viewSidebarSection : String -> List ( Route, String ) -> Html msg
viewSidebarSection heading links =
    Html.div [ Attr.class "sidebar-section" ]
        [ Html.h3 [ Attr.class "sidebar-heading" ] [ Html.text heading ]
        , Html.ul [ Attr.class "sidebar-links" ]
            (List.map
                (\( route, label ) ->
                    Html.li []
                        [ Route.link [] [ Html.text label ] route ]
                )
                links
            )
        ]
