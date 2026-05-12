module ApiDocs.Types exposing (ApiModule, FunctionDoc, TypeDoc)


type alias ApiModule =
    { name : String
    , description : String
    , types : List TypeDoc
    , functions : List FunctionDoc
    }


type alias TypeDoc =
    { name : String
    , signature : String
    , description : String
    }


type alias FunctionDoc =
    { name : String
    , signature : String
    , description : String
    , example : Maybe String
    }
