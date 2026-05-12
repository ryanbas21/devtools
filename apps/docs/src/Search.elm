module Search exposing (SearchEntry, SearchIndex, SearchResult, buildIndex, search)


type alias SearchEntry =
    { title : String
    , url : String
    , section : String
    , excerpt : String
    }


type alias SearchIndex =
    List SearchEntry


type alias SearchResult =
    SearchEntry


buildIndex : List SearchEntry -> SearchIndex
buildIndex entries =
    entries


search : String -> SearchIndex -> List SearchResult
search query index =
    if String.length query < 2 then
        []

    else
        let
            lowerQuery =
                String.toLower query
        in
        index
            |> List.filter
                (\entry ->
                    String.contains lowerQuery (String.toLower entry.title)
                        || String.contains lowerQuery (String.toLower entry.excerpt)
                )
            |> List.sortBy
                (\entry ->
                    if String.contains lowerQuery (String.toLower entry.title) then
                        0

                    else
                        1
                )
