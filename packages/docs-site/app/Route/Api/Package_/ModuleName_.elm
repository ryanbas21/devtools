module Route.Api.Package_.ModuleName_ exposing (ActionData, Data, Model, Msg, route)

import ApiDocs.TreeshakeCheck
import ApiDocs.Types exposing (ApiModule, FunctionDoc, TypeDoc)
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
import View exposing (View)


type alias Model =
    {}


type alias Msg =
    ()


type alias RouteParams =
    { package : String
    , moduleName : String
    }


type alias Data =
    { apiModule : ApiModule
    }


type alias ActionData =
    {}


route : StatelessRoute RouteParams Data ActionData
route =
    RouteBuilder.preRender
        { head = head
        , pages = pages
        , data = data
        }
        |> RouteBuilder.buildNoState { view = view }


allModules : List ( String, String, ApiModule )
allModules =
    List.map (\m -> ( "treeshake-check", m.name, m )) ApiDocs.TreeshakeCheck.modules


pages : BackendTask FatalError (List RouteParams)
pages =
    allModules
        |> List.map (\( pkg, modName, _ ) -> { package = pkg, moduleName = modName })
        |> BackendTask.succeed


data : RouteParams -> BackendTask FatalError Data
data routeParams =
    case findModule routeParams.package routeParams.moduleName of
        Just apiMod ->
            BackendTask.succeed { apiModule = apiMod }

        Nothing ->
            BackendTask.fail
                (FatalError.fromString
                    ("API module not found: " ++ routeParams.package ++ "/" ++ routeParams.moduleName)
                )


findModule : String -> String -> Maybe ApiModule
findModule pkg modName =
    allModules
        |> List.filter (\( p, n, _ ) -> p == pkg && n == modName)
        |> List.head
        |> Maybe.map (\( _, _, m ) -> m)


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
        , description = app.data.apiModule.description
        , locale = Nothing
        , title = app.data.apiModule.name ++ " - API Reference"
        }
        |> Seo.website


view :
    App Data ActionData RouteParams
    -> Shared.Model
    -> View (PagesMsg Msg)
view app _ =
    let
        apiMod =
            app.data.apiModule
    in
    { title = apiMod.name ++ " - API Reference"
    , body =
        [ Html.div [ Attr.class "api-reference" ]
            ([ Html.h1 [] [ Html.text apiMod.name ]
             , Html.p [ Attr.class "api-description" ] [ Html.text apiMod.description ]
             ]
                ++ viewTypes apiMod.types
                ++ viewFunctions apiMod.functions
            )
        ]
    }


viewTypes : List TypeDoc -> List (Html.Html (PagesMsg Msg))
viewTypes types =
    if List.isEmpty types then
        []

    else
        Html.h2 [] [ Html.text "Types" ]
            :: List.map viewType types


viewType : TypeDoc -> Html.Html (PagesMsg Msg)
viewType typeDoc =
    Html.div [ Attr.class "api-item" ]
        [ Html.h3 [ Attr.class "api-item-name" ] [ Html.text typeDoc.name ]
        , Html.pre [ Attr.class "api-signature" ]
            [ Html.code [] [ Html.text typeDoc.signature ] ]
        , Html.p [] [ Html.text typeDoc.description ]
        ]


viewFunctions : List FunctionDoc -> List (Html.Html (PagesMsg Msg))
viewFunctions functions =
    if List.isEmpty functions then
        []

    else
        Html.h2 [] [ Html.text "Functions" ]
            :: List.map viewFunction functions


viewFunction : FunctionDoc -> Html.Html (PagesMsg Msg)
viewFunction funcDoc =
    Html.div [ Attr.class "api-item" ]
        ([ Html.h3 [ Attr.class "api-item-name" ] [ Html.text funcDoc.name ]
         , Html.pre [ Attr.class "api-signature" ]
            [ Html.code [] [ Html.text funcDoc.signature ] ]
         , Html.p [] [ Html.text funcDoc.description ]
         ]
            ++ viewExample funcDoc.example
        )


viewExample : Maybe String -> List (Html.Html (PagesMsg Msg))
viewExample maybeExample =
    case maybeExample of
        Just example ->
            [ Html.div [ Attr.class "api-example" ]
                [ Html.h4 [] [ Html.text "Example" ]
                , Html.pre [] [ Html.code [] [ Html.text example ] ]
                ]
            ]

        Nothing ->
            []
