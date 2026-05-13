# @wolfcola/changeset-sync-manifest

Copies the `version` field from `package.json` into `manifest.json` in the same directory. Used after `changeset version` to keep the browser extension manifest version in sync with the npm package version.

## Usage

```bash
sync-manifest <dir>
```

Where `<dir>` is the package directory containing both `package.json` and `manifest.json`.

### Example

```bash
sync-manifest packages/devtools-extension
```

Reads `packages/devtools-extension/package.json`, extracts the `version` field, and writes it into `packages/devtools-extension/manifest.json`.

## Integration

Typically wired into the changeset version workflow:

```json
{
  "scripts": {
    "version": "changeset version && sync-manifest packages/devtools-extension"
  }
}
```

## License

MIT
