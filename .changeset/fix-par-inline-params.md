---
'@wolfcola/devtools-core': patch
---

Fix PAR inline-params rule falsely flagging client_id alongside request_uri

The `par:inline-params-with-request-uri` diagnosis rule incorrectly treated `client_id` as a prohibited inline parameter. Per RFC 9126, `client_id` is required alongside `request_uri` in the authorization request after a PAR. Only truly prohibited params (`redirect_uri`, `scope`, etc.) now trigger the warning.
