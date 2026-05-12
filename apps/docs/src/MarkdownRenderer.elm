module MarkdownRenderer exposing (renderer)

{-| Custom Markdown renderer for wolfcola devtools documentation.

Supports standard Markdown elements plus a custom `<callout>` HTML element
with an optional `type` attribute (info/warning).

Code blocks emit `class="language-<lang>"` on the `<code>` element for
Prism.js syntax highlighting.

-}

import Html exposing (Html)
import Html.Attributes as Attr
import Markdown.Block as Block exposing (ListItem)
import Markdown.Html
import Markdown.Renderer exposing (Renderer)


{-| The custom renderer for documentation pages.
-}
renderer : Renderer (Html msg)
renderer =
    { heading = viewHeading
    , paragraph = Html.p []
    , blockQuote = Html.blockquote []
    , html = htmlRenderer
    , text = Html.text
    , codeSpan =
        \content -> Html.code [] [ Html.text content ]
    , strong =
        \children -> Html.strong [] children
    , emphasis =
        \children -> Html.em [] children
    , strikethrough =
        \children -> Html.del [] children
    , hardLineBreak = Html.br [] []
    , link = viewLink
    , image = viewImage
    , unorderedList = viewUnorderedList
    , orderedList = viewOrderedList
    , codeBlock = viewCodeBlock
    , thematicBreak = Html.hr [] []
    , table = Html.table []
    , tableHeader = Html.thead []
    , tableBody = Html.tbody []
    , tableRow = Html.tr []
    , tableCell = viewTableCell
    , tableHeaderCell = viewTableHeaderCell
    }



-- Headings


viewHeading : { level : Block.HeadingLevel, rawText : String, children : List (Html msg) } -> Html msg
viewHeading { level, rawText, children } =
    let
        slug : String
        slug =
            rawText
                |> String.toLower
                |> String.replace " " "-"
                |> String.filter (\c -> Char.isAlphaNum c || c == '-')

        tag : List (Html.Attribute msg) -> List (Html msg) -> Html msg
        tag =
            case level of
                Block.H1 ->
                    Html.h1

                Block.H2 ->
                    Html.h2

                Block.H3 ->
                    Html.h3

                Block.H4 ->
                    Html.h4

                Block.H5 ->
                    Html.h5

                Block.H6 ->
                    Html.h6
    in
    tag [ Attr.id slug ] children



-- Links


viewLink : { title : Maybe String, destination : String } -> List (Html msg) -> Html msg
viewLink link children =
    case link.title of
        Just title ->
            Html.a
                [ Attr.href link.destination
                , Attr.title title
                ]
                children

        Nothing ->
            Html.a [ Attr.href link.destination ] children



-- Images


viewImage : { alt : String, src : String, title : Maybe String } -> Html msg
viewImage imageInfo =
    case imageInfo.title of
        Just title ->
            Html.img
                [ Attr.src imageInfo.src
                , Attr.alt imageInfo.alt
                , Attr.title title
                ]
                []

        Nothing ->
            Html.img
                [ Attr.src imageInfo.src
                , Attr.alt imageInfo.alt
                ]
                []



-- Lists


viewUnorderedList : List (ListItem (Html msg)) -> Html msg
viewUnorderedList items =
    Html.ul []
        (items
            |> List.map
                (\item ->
                    case item of
                        Block.ListItem task children ->
                            let
                                checkbox : Html msg
                                checkbox =
                                    case task of
                                        Block.NoTask ->
                                            Html.text ""

                                        Block.IncompleteTask ->
                                            Html.input
                                                [ Attr.disabled True
                                                , Attr.checked False
                                                , Attr.type_ "checkbox"
                                                ]
                                                []

                                        Block.CompletedTask ->
                                            Html.input
                                                [ Attr.disabled True
                                                , Attr.checked True
                                                , Attr.type_ "checkbox"
                                                ]
                                                []
                            in
                            Html.li [] (checkbox :: children)
                )
        )


viewOrderedList : Int -> List (List (Html msg)) -> Html msg
viewOrderedList startingIndex items =
    Html.ol
        (if startingIndex /= 1 then
            [ Attr.start startingIndex ]

         else
            []
        )
        (items
            |> List.map (\itemBlocks -> Html.li [] itemBlocks)
        )



-- Code blocks


viewCodeBlock : { body : String, language : Maybe String } -> Html msg
viewCodeBlock { body, language } =
    let
        codeAttrs : List (Html.Attribute msg)
        codeAttrs =
            case Maybe.map String.words language of
                Just (lang :: _) ->
                    [ Attr.class ("language-" ++ lang) ]

                _ ->
                    []
    in
    Html.pre []
        [ Html.code codeAttrs
            [ Html.text body ]
        ]



-- Table cells


viewTableHeaderCell : Maybe Block.Alignment -> List (Html msg) -> Html msg
viewTableHeaderCell maybeAlignment =
    Html.th (alignmentAttrs maybeAlignment)


viewTableCell : Maybe Block.Alignment -> List (Html msg) -> Html msg
viewTableCell maybeAlignment =
    Html.td (alignmentAttrs maybeAlignment)


alignmentAttrs : Maybe Block.Alignment -> List (Html.Attribute msg)
alignmentAttrs maybeAlignment =
    case maybeAlignment of
        Just alignment ->
            [ Attr.align
                (case alignment of
                    Block.AlignLeft ->
                        "left"

                    Block.AlignCenter ->
                        "center"

                    Block.AlignRight ->
                        "right"
                )
            ]

        Nothing ->
            []



-- Custom HTML elements


htmlRenderer : Markdown.Html.Renderer (List (Html msg) -> Html msg)
htmlRenderer =
    Markdown.Html.oneOf
        [ Markdown.Html.tag "callout"
            (\maybeType children ->
                let
                    className : String
                    className =
                        case maybeType of
                            Just "warning" ->
                                "callout callout--warning"

                            Just "info" ->
                                "callout callout--info"

                            _ ->
                                "callout"
                in
                Html.div [ Attr.class className ] children
            )
            |> Markdown.Html.withOptionalAttribute "type"
        ]
