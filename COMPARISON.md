# mt-md compared with other Markdown viewer extensions

Where mt-md **0.4.2** stands against the viewers found. The mt-md column was re-checked against the code on 27 October 2026; the other projects were last re-read on 24 October 2026 and were not re-read for this update.

## How to read this

- **mt-md's column** comes from the code and its tests (unit tests and a real-Chromium end-to-end run), so a ✅ there means the code does it and the tests cover most of it. What is not covered is listed under Known limits in the README (for example the printed contents has no page numbers in Chrome, and nothing tests printing).
- **The other columns** come only from each project's README, store listing or site, read on the date above. They were not installed or tested.
- ✅ = stated as supported. ◐ = partly, with the detail in the cell. ❌ = known to be absent (mt-md only). ➖ = **not stated** in what was read, which is not the same as "no". Treat a ➖ as "check before relying on it".
- Download counts and update dates are from the listings and will drift.

## The field

| Extension | Browsers | Where it was read |
|---|---|---|
| **mt-md** 0.4.2 | Chrome, Firefox (Mozilla-signed; a real-Firefox run covers rendering, the folder listing, auto-reload and Edit, but not the popup, the set-up page or the real file-access switch) | this repo |
| **Markdown Viewer** (simov) | Chrome, Firefox, Edge, Opera, Brave, Chromium, Vivaldi; MIT | [README](https://github.com/simov/markdown-viewer) |
| **Markdown Preview Plus** (volca) | Chrome | [README](https://github.com/volca/markdown-preview) |
| **MarkView** | Chrome, Edge and other Chromium browsers; free, no sign-up, "thousands of users" on its site (about 20,000 on the Chrome store when first read) | [site](https://getmarkview.com), Chrome store listing |
| **Markdown Viewer** (xicilion) | Chrome, Firefox, VS Code, Obsidian; ISC; 738 users on Firefox, version 5.3.2 | [Firefox listing](https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-extension/) |
| **Markdown Viewer & Reader** (mdedit.ai) | Chrome, Firefox; 95 users on Firefox | [Firefox listing](https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-reader/) |

## Rendering

| | mt-md | simov | Preview Plus | MarkView | xicilion | Viewer & Reader |
|---|---|---|---|---|---|---|
| GitHub-flavoured Markdown (tables, task lists) | ✅ | ✅ (CommonMark + GFM, many options) | ✅ | ➖ | ➖ | ✅ |
| Footnotes, sub/superscript | ✅ | ✅ (options) | ➖ | ➖ | ➖ | ➖ |
| Front matter as a title block with status badge | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Syntax highlighting | ✅ Prism, line numbers, highlighted lines, copy buttons | ✅ Prism | ➖ | ✅ 180+ languages | ✅ 100+ languages | ✅ (code theme choice) |
| GitHub-style callouts (`> [!NOTE]`) and collapsible `<details>` | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Math | ✅ KaTeX → MathML, with a bundled math font so it looks the same everywhere | ◐ MathJax, off by default | ✅ KaTeX and MathJax | ✅ KaTeX | ✅ LaTeX (becomes editable equations in Word export) | ➖ |
| Mermaid | ✅ | ◐ off by default; resize, zoom and pan | ✅ | ✅ flowchart, sequence, Gantt, state; zoom and pan | ✅ | ✅ |
| Graphviz (DOT) | ✅ | ➖ | ➖ | ➖ | ✅ | ✅ |
| Other diagram kinds | ✅ Vega and Vega-Lite, draw.io, JSON Canvas (Obsidian), AntV infographics, mind maps and timelines (Mermaid) | ➖ | ➖ | ➖ | ✅ Vega, drawio, canvas, infographic | ✅ mind maps |
| Image viewer (lightbox) | ✅ click to open, arrows between the page's pictures, click for full size | ➖ | ➖ | ✅ gallery, lazy loading | ➖ | ➖ |
| Re-reads a charset-less server response as UTF-8 | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ |

## Reading and navigation

| | mt-md | simov | Preview Plus | MarkView | xicilion | Viewer & Reader |
|---|---|---|---|---|---|---|
| Table of contents | ✅ left column on wide windows, current-section tracking | ✅ off by default | ➖ | ✅ current-section tracking | ✅ sidebar | ➖ |
| **Folder / file browser** | ✅ tree of `.md` files and folders; Up and Back; open folders stay open across documents; works on `file://` and on servers with a folder index | ➖ | ➖ | ✅ browser with search and filter | ➖ (document history) | ➖ |
| Rendered inside an `<iframe>` (a local page that frames a `.md` guide) | ✅ compact, filling the frame; keeps the toolbar, Settings, auto-reload and a closed inline Contents button; no Files panel; outside links open a new tab and `#` links stay; still local-only | ➖ | ➖ | ➖ | ➖ | ➖ |
| Light and dark theme | ✅ dark, light or system (follows the browser live); remembered | ✅ via themes | ➖ | ✅ | ➖ | ✅ |
| Number of themes / fonts | ◐ light, dark and system, with three bundled styles (Catppuccin, Solarized, Rosé Pine), your own uploaded as validated JSON, and a per-folder `mt-md-theme.css` on `file://` | ✅ 30+ themes, custom theme upload, page widths | ◐ per-file themes | ✅ 9 fonts, sizes, line heights | ✅ 29 themes | ◐ font size, width, code theme |
| Raw ⇄ rendered toggle | ✅ | ✅ | ➖ | ➖ | ➖ | ➖ |
| Keyboard shortcuts | ✅ single keys for theme, contents, files, raw, edit, export, headings and a `?` list; switchable off; arrow-key tree in the Files panel | ➖ | ➖ | ✅ (TOC, theme, file browser) | ✅ (TOC, save) | ➖ |
| Remembers scroll position | ✅ across auto-reloads | ✅ | ➖ | ➖ | ✅ | ➖ |
| Work in the page layout (zoom, width, layouts) | ✅ width (narrow, medium, wide or the full window), text size 70% to 200%, line spacing, 3 system font families; keys for size and width | ✅ widths | ➖ | ✅ | ✅ zoom and 3 layouts | ✅ |
| Per-site layout and theme (a different look for each site or folder) | ❌ one layout and one theme everywhere; only a `mt-md-theme.css` beside local files restyles a folder | ➖ | ◐ per-file themes | ➖ | ➖ | ➖ |

## Files, editing and output

| | mt-md | simov | Preview Plus | MarkView | xicilion | Viewer & Reader |
|---|---|---|---|---|---|---|
| Auto-reload when the file changes | ✅ `file://` and localhost; pause button | ✅ off by default; `file://` and localhost, polls every second | ✅ | ✅ | ➖ | ➖ |
| **Open the file in an editor** | ✅ Edit tool (VS Code by default; also Insiders, VSCodium, Cursor, or a custom link); greyed out with a reason on web pages | ➖ | ➖ | ➖ | ➖ | ➖ |
| **Bundle into one file with its images** | ✅ Export (Markdown format, the default): images become reference definitions at the end, plus a note near the top with the line where the text ends and the image data starts | ➖ | ➖ | ➖ | ➖ | ➖ |
| Print / PDF layout | ✅ A4, page breaks, light palette, a printed contents page (no page numbers in Chrome; printing is not covered by a test) | ➖ | ➖ | ➖ | ➖ | ➖ |
| **Copy to the clipboard** | ✅ Copy tool with a gear: HTML code, formatted text to paste into Word, Docs or e-mail, the Markdown source, or plain text; the button's tooltip and name say which | ➖ | ➖ | ➖ | ➖ | ➖ |
| Export to another format | ✅ HTML (images embedded, linked, zipped as files or left out), Word .docx, OpenDocument .odt, Word 97-2003 .doc, Rich Text, EPUB, plain text, Markdown with images embedded; PDF through the print dialog; choose the format and Downloads or Save-as in the Export gear. Not a real PDF writer, and equations become text in the Word formats | ➖ | ✅ HTML | ✅ DOCX and HTML (per the store listing) | ✅ Word (PDF planned) | ➖ |
| Works offline, nothing sent anywhere | ✅ | ✅ "secure by design" | ➖ | ✅ stated | ✅ stated | ✅ stated |

## Access and trust

| | mt-md | simov | Preview Plus | MarkView | xicilion | Viewer & Reader |
|---|---|---|---|---|---|---|
| Local files (`file://`) | ✅ needs "Allow access to file URLs" | ✅ same switch | ✅ same switch | ✅ same switch | ✅ local file access setting | ✅ |
| Other sites | ✅ off until you press **Allow this site** in the toolbar popup; **Allow all sites** is one more button; both removable there. Only `.md` pages on a granted host | ✅ per-origin with wildcards, optional path regex, "Allow All" | ➖ | ✅ GitHub, GitLab, Bitbucket raw pages (how access is granted is not stated) | ◐ asks for "data for all websites" | ➖ |
| Permission model visible to the user | ✅ popup lists every allowed site, and the always-on local ones | ✅ options page | ➖ | ➖ | ◐ required and optional permissions listed | ➖ |
| Settings sync across devices | ◐ custom themes only, through the browser's own sync (opt-in) | ✅ origins, themes | ➖ | ➖ | ➖ | ➖ |
| Feedback and bug reports | ✅ one **Feedback** link in Settings and in the popup; by default it opens the project's issue page with the version, browser and kind of page filled in (never an address or text), and a gear lets the reader send it to the project's email (no account needed) or to a link of their own instead; its tooltip says where it goes; nothing is sent until you submit or send it | ◐ GitHub Issues (90 open); no link in the extension that was read | ◐ GitHub Issues and CONTRIBUTING.md | ◐ a support page and a GitHub issues repo on its site | ◐ "Report Issues" and "Feature Requests" links on its Firefox listing, a support email | ◐ a support site and email on its Firefox listing |
| Price | ✅ free, with no tip link, paid tier or sign-up | ✅ free, open source | ➖ | ✅ free (a third-party page flags paid features; not confirmed) | ➖ | ➖ |
| Distribution | Chrome Web Store (unlisted) and a self-hosted update channel (Chrome and Firefox) | public stores | Chrome store | Chrome and Edge stores | Chrome, Firefox, VS Code, Obsidian | Chrome, Firefox |

## Where mt-md stands

**Ahead (no other project read states these):**
- The **bundle with a line-number note** for LLM readers: one `.md` with its images at the end, and a pointer to where the text stops.
- **More export formats than the others state** (xicilion: Word only; Preview Plus: HTML): HTML, .docx, .odt, .doc, RTF, EPUB, plain text and Markdown with images, with PDF through print.
- **Print-grade output**: an A4 layout with page breaks and a printed contents page.
- **Open in your editor** straight from a `file://` document.
- **Copy in the form you need** (HTML code, formatted for pasting, Markdown source, plain text), chosen once in a gear.
- **A single, configurable feedback link inside the extension** that opens a pre-filled issue (or the project's email, or the reader's own link) and says where it goes; the others point to a repository or store page, and none of the pages read describe a link inside the extension.
- A **persistent folder tree** that keeps its open folders between documents, with Up and Back, and that also works over http where the server shows an index.
- **Local guides inside a frame**: a `.md` page shown in an `<iframe>` next to your own form is rendered compactly, with the toolbar and Contents still there (none of the other pages read mention frames).
- **Math that looks the same on every machine**, because the font is bundled.
- **Callouts, collapsible sections and front-matter title blocks**.
- The **narrowest default access** in the field alongside simov: nothing outside local files and localhost until you grant a site, with one click.

**Level with the best:** Mermaid and Graphviz together (only xicilion and Viewer & Reader state both), auto-reload, TOC with section tracking, light/dark/system theme, and a folder browser (MarkView has one too, and its filter and search are something mt-md lacks).

**Behind:**
- **Themes and fonts.** simov has 30+ themes with upload, widths and per-origin options. xicilion has 29 themes (no custom themes yet, by its listing). MarkView has 9 fonts. mt-md has three bundled styles, uploads of your own (colours, fonts and a width only; editable, copyable as JSON, and optionally synced through the browser) and a per-folder CSS override, which is fewer than the large collections.
- **Diagram zoom and pan**, **sync of settings beyond custom themes** (origins, for example), and a **file-browser search/filter**.
- **MathJax** as an alternative to KaTeX.
- **Per-site layout and theme**: low priority. No viewer read states it (Preview Plus has per-file themes), the global layout covers most readers, and local folders already have `mt-md-theme.css`. Worth doing only if people ask for, say, a wide layout on one docs site and a narrow one elsewhere.
- **Reach.** mt-md has no public listing yet and is unlisted on the Chrome store. MarkView has about 20,000 users and the most-used viewer seen had about 100,000. Edge, Opera, Brave and Vivaldi are listed by simov; mt-md hasn't been tried there.
- **Firefox.** mt-md is Mozilla-signed, and `npm run e2e:firefox` covers rendering, the folder listing, auto-reload and Edit in real Firefox; the popup, the set-up page and the real file-access switch are untested there.

## Biggest gaps worth closing

1. **More bundled themes**, since themes are the most visible difference and the one the field leads on. The three bundled styles and your own uploads are in; a bigger set, or a bundled Claude.ai-style theme, would close more of the gap.
2. **A real PDF writer** (PDF still goes through the print dialog; a writer needs a bundled library) and **LaTeX/AsciiDoc** export. EPUB, RTF and plain text are done.
3. **Search/filter in the Files panel**, to match MarkView.
4. **A Firefox pass** of the popup, the set-up page and the real file-access switch.
5. **A public store listing**, so people can find it at all.

## Sources read

- [simov/markdown-viewer README](https://github.com/simov/markdown-viewer)
- [volca/markdown-preview README](https://github.com/volca/markdown-preview)
- [getmarkview.com](https://getmarkview.com) and the MarkView Chrome Web Store listing (via search results)
- [Markdown Viewer (xicilion), Firefox add-ons](https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-extension/)
- [Markdown Viewer & Reader (mdedit.ai), Firefox add-ons](https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-reader/)
- Earlier search results on [Markdown Reader](https://www.extscope.org/extension/medapdbncneneejhbgcjceippjlfkmkg) (about 100,000 users) and Markdown Diagrams, not compared here: their feature lists were not read.
