module View exposing (View, map, placeholder)

import Html exposing (Html)


type alias View msg =
    { title : String
    , body : List (Html msg)
    }


map : (a -> b) -> View a -> View b
map fn view =
    { title = view.title
    , body = List.map (Html.map fn) view.body
    }


placeholder : String -> View msg
placeholder moduleName =
    { title = moduleName
    , body = [ Html.text moduleName ]
    }
