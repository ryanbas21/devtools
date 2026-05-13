---
'@wolfcola/devtools-extension': patch
---

Automate manifest.json version sync: after `changeset version` bumps
package.json, the new `sync-manifest` CLI copies the version into
manifest.json so Chrome Web Store publishes show real version numbers.
