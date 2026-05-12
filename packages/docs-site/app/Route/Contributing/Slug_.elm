module Route.Contributing.Slug_ exposing (ActionData, Data, Model, Msg, route)

import BackendTask exposing (BackendTask)
import BackendTask.File as File
import BackendTask.Glob as Glob
import FatalError exposing (FatalError)
import Head
import Head.Seo as Seo
import Html
import Html.Attributes as Attr
import Json.Decode as Decode exposing (Decoder)
import Markdown.Parser
import Markdown.Renderer
import MarkdownRenderer
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
    { slug : String }


route : StatelessRoute RouteParams Data ActionData
route =
    RouteBuilder.preRender
        { head = head
        , pages = pages
        , data = data
        }
        |> RouteBuilder.buildNoState { view = view }


pages : BackendTask FatalError (List RouteParams)
pages =
    Glob.succeed (\slug -> { slug = slug })
        |> Glob.match (Glob.literal "content/contributing/")
        |> Glob.capture Glob.wildcard
        |> Glob.match (Glob.literal ".md")
        |> Glob.toBackendTask


type alias Data =
    { title : String
    , description : String
    , markdownBody : String
    }


type alias ActionData =
    {}


data : RouteParams -> BackendTask FatalError Data
data routeParams =
    File.bodyWithFrontmatter
        (\markdownBody ->
            Decode.map2
                (\title description ->
                    { title = title
                    , description = description
                    , markdownBody = markdownBody
                    }
                )
                (Decode.field "title" Decode.string)
                (Decode.field "description" Decode.string)
        )
        ("content/contributing/" ++ routeParams.slug ++ ".md")
        |> BackendTask.allowFatal


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
        , description = app.data.description
        , locale = Nothing
        , title = app.data.title
        }
        |> Seo.website


renderMarkdown : String -> List (Html.Html msg)
renderMarkdown markdownBody =
    markdownBody
        |> Markdown.Parser.parse
        |> Result.mapError (\_ -> "Markdown parsing error.")
        |> Result.andThen (Markdown.Renderer.render MarkdownRenderer.renderer)
        |> Result.withDefault []


view :
    App Data ActionData RouteParams
    -> Shared.Model
    -> View (PagesMsg Msg)
view app _ =
    { title = app.data.title
    , body =
        [ Html.article [ Attr.class "markdown-content" ]
            (renderMarkdown app.data.markdownBody)
        ]
    }
