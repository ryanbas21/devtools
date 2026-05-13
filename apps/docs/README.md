# @wolfcola/docs-site

The documentation site for wolfcola devtools, built with [elm-pages](https://elm-pages.com/).

## Development

```bash
pnpm --filter @wolfcola/docs-site dev
```

Opens a local dev server with hot reload.

## Build

```bash
pnpm --filter @wolfcola/docs-site build
```

Generates a static site in `dist/` using the Netlify adapter. The site is served under the `/devtools/` base path.

## Content

Documentation is authored as Markdown files in the `content/` directory:

| Directory               | Section      | Description                                          |
| ----------------------- | ------------ | ---------------------------------------------------- |
| `content/docs/`         | Guides       | Getting started, extension usage, integration guides |
| `content/packages/`     | Packages     | API reference for each published package             |
| `content/contributing/` | Contributing | Development setup, code style, release process       |

Each Markdown file has YAML frontmatter with `title`, `description`, `section`, and `order` fields used for navigation and search indexing.

## Architecture

- **elm-pages** — static site generator with file-based routing
- **Elm** — all page logic, layout, search, and theme toggle
- **Vite** — bundler (configured via `elm-pages.config.mjs`)
- **Netlify** — deployment adapter
- **Prism.js** — syntax highlighting for code blocks

### Adding a new page

1. Create a Markdown file in the appropriate `content/` subdirectory
2. Add frontmatter with `title`, `description`, `section`, and `order`
3. Add a sidebar link in `app/Shared.elm` under the matching section
4. The route is automatically generated from the directory and filename

### Key files

| File                               | Purpose                                           |
| ---------------------------------- | ------------------------------------------------- |
| `app/Shared.elm`                   | Layout, header, sidebar, search, theme toggle     |
| `app/Route/Index.elm`              | Home page with package grid                       |
| `app/Route/Architecture.elm`       | Architecture diagram (SVG)                        |
| `app/Route/Docs/Slug_.elm`         | Dynamic guide page renderer                       |
| `app/Route/Packages/Slug_.elm`     | Dynamic package page renderer                     |
| `app/Route/Contributing/Slug_.elm` | Dynamic contributing page renderer                |
| `src/MarkdownRenderer.elm`         | Custom Markdown renderer with callout support     |
| `src/Search.elm`                   | Full-text search index and matching               |
| `style.css`                        | Stylesheet with CSS custom properties for theming |
