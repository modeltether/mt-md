---
title: mt-md playground
status: Approved
---

# mt-md playground

Every document here exercises one part of mt-md. Open this folder two ways and compare:

- **`file://`**: the pencil (Edit) tool is available, the Files panel lists the folder through the browser's own listing, and auto-reload watches the file.
- **`http://127.0.0.1:8794/`**: no Edit tool (a web page has no file to edit), the Files panel reads the server's index, and auto-reload polls the server.

## Documents

The [render/](render/README.md) folder has one short page per drawing feature, including Vega charts, mind maps and the image viewer.

| File | What it shows |
|---|---|
| [01-basics.md](01-basics.md) | headings, lists, tables, task lists, footnotes, sub/superscript, links |
| [02-code.md](02-code.md) | highlighted code, line numbers, highlighted lines, copy buttons |
| [03-callouts-details.md](03-callouts-details.md) | GitHub callouts and collapsible sections |
| [04-math.md](04-math.md) | inline and display equations (bundled STIX Two Math) |
| [05-diagrams.md](05-diagrams.md) | Mermaid and Graphviz |
| [render/README.md](render/README.md) | the showcase: every render feature on its own page, with Vega, mind maps and the image viewer |
| [06-frontmatter.md](06-frontmatter.md) | the title block and status badges |
| [07-unicode.md](07-unicode.md) | UTF-8 text (the http server sends no charset on purpose) |
| [08-images.md](08-images.md) | images, and the Export (bundle) tool with its payload note |
| [09-long-document.md](09-long-document.md) | a long page: contents panel and scroll tracking |
| [guides/getting-started.md](guides/getting-started.md) | nested folders for the Files panel, Up and Back |
| [live/clock.md](live/clock.md) | auto-reload (run `npm run playground:live`) |
| [themed/themed.md](themed/themed.md) | `mt-md-theme.css` override (file:// only) |
| [odd names/ünïcode & spaces.md](odd%20names/%C3%BCn%C3%AFcode%20%26%20spaces.md) | awkward file names |

Hidden files (`.hidden.md`) and other types (`notes.txt`) must **not** appear in the Files panel.
