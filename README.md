# mt-md

A browser extension that turns `.md` files into readable documents. It works on `file:///…/*.md` and on any `http(s)://…/*.md`
URL and runs entirely in the page. The extension itself makes no network requests and collects nothing; what a document points at
(an image, say) loads from wherever it points. Manifest V3, Chrome first and Firefox second.

How it compares with other Markdown viewers: `COMPARISON.md`; what their users complain about and how mt-md fares: `FEEDBACK-REVIEW.md`.

## Licence and how it was made

MIT, see `LICENSE` at the repository root (a copy ships inside every built extension, with `THIRD_PARTY_NOTICES.md` for the
bundled libraries, which are all under permissive licences; `npm run licenses` fails the gate if a new one is not on the allow-list).

**This project is about 100% AI-written ("vibe coded").** The code, tests, build and release tooling, and most of the
documentation were written by Claude (Anthropic's models, driven through Claude Code; the commits carry a
`Co-Authored-By: Claude` trailer) at the maintainer's direction. The maintainer chose what to build, tried the results and decided what
shipped. There has been no line-by-line human code review. The unit tests and the real-browser end-to-end run are the main safety
net, and the AI wrote those too. So read the code before you trust it with anything that matters. Issues and pull requests are welcome.

## What it renders

- GitHub-flavoured Markdown: tables, task lists, footnotes, sub/superscript, front-matter header with status badge
- Syntax highlighting (Prism) with line numbers and `hl_lines`
- GitHub-style callouts (`> [!NOTE]`, `[!WARNING]`, `[!TIP]` …) and collapsible `<details>`
- Mermaid diagrams (including mind maps and timelines), Graphviz (`dot` / `graphviz` fences), Vega / Vega-Lite charts (`vega`, `vega-lite` fences, data written in the chart), draw.io diagrams (`drawio`), JSON Canvas (`canvas`) and AntV infographics (`infographic`), drawn inline as SVG with nothing fetched from the network
- An image viewer: click a picture to see it large, step through the page's pictures with the arrow keys, click again for full size, Escape to close
- Page layout (Settings, the Page layout row): width (narrow, medium, wide, full window), text size (70% to 200%, only the document zooms), line spacing and font (system fonts); laid over the theme, remembered, ignored when printing. `+`/`-`/`0` change the size and `W` cycles the width. The contents panel moves to the inline button when a wide page leaves no room beside it
- Keyboard shortcuts, single keys that run the toolbar's actions: `T` theme, `C` contents, `F` Files panel, `R` raw/rendered, `E` edit, `D` export, `A` auto-reload, `S` Settings, `J`/`K` next/previous heading, `?` the list. They are ignored with Ctrl/Cmd/Alt held, while typing in a field and while the image viewer is open, so no browser shortcut is touched, and the Keyboard shortcuts row in Settings (highlighted while on, like Auto-reload) turns them off; its gear lets you change each key or restore the defaults. The Files panel is a tree: Tab enters it once, then arrows move, Right/Left open and close folders, Home/End jump, a letter jumps to a name, Esc leaves
- Math: `$…$` and `$$…$$`. KaTeX writes MathML, which the browser lays out itself; mt-md bundles a subset of **STIX Two Math**
  (OFL, `fonts/`) so brackets, integrals and roots stretch the same on every machine, instead of depending on whatever math
  font the OS has (on Linux the browser often uses none). The font is loaded from the bundled bytes with `FontFace`, so a page's
  Content-Security-Policy cannot block it
- Export (the arrow-down tool; it was called Download). Its gear in Settings sets the format and where the file goes. Formats: Markdown
  with images embedded (the default, below), an HTML page (images embedded, linked, as separate files in a .zip, or left out), Word
  `.docx`, OpenDocument `.odt`, Word 97-2003 `.doc` (a web archive Word and LibreOffice open), Rich Text `.rtf`, EPUB `.epub`, plain text `.txt`
  and PDF (through the print dialog). Diagrams
  become PNG pictures in the Word, RTF and EPUB formats (inline SVG stays vector in HTML, and an ODT carries the SVG with the PNG behind it as a fallback); equations come out as their text. Save to the Downloads folder (default), a folder inside Downloads (you name it) or ask each time (the browser's Save as dialog), the last two
  through the `downloads` permission. The button's tooltip and name say what a click will do. The Markdown format
  saves one `.md` with its images embedded as base64 reference definitions at the end. For LLM
  readers a one-line note near the top (after any front matter) says where the text ends and the image data starts and ends
  (`ends at line 212. Lines 214 to 230 are base64 image data`), so a tool that reads a file in line ranges can stop before the
  payload; a comment before the payload says the same. There is no standard "stop reading" marker (MCP and file readers have
  none), so this is a convention, not a guarantee
- Toolbar (top right, fades when idle): the theme circle, contents and export are on it to begin with. The gear at the bottom
  opens Settings, which lists every tool (print, raw view, Copy, with a gear to choose HTML code, formatted text, Markdown source or plain text, auto-reload as well) with a Menu column of tick boxes; a tool can be used
  from there without being on the toolbar. The theme is a three-segment circle (dark, light, system) that turns so the active
  segment meets the dot at the top; an Edit tool (greyed out, with the reason as its tooltip, on web pages) opens the file in your editor through the editor's own link (`vscode://file/<path>` by default; VS Code, Insiders, VSCodium, Cursor or a custom pattern with `{path}`/`{url}`, chosen in Settings; the browser may ask before handing it over); "system" follows the browser's light/dark setting live. Both choices are remembered in extension storage
- Files panel: above the contents, the document's folder as a small tree of `.md` files and sub-folders (folders open in
  place; the open document is marked). It reads the listing page the browser or server already shows for the folder: Chrome's
  `file://` listing, or an autoindex (Apache, nginx, Caddy, `python -m http.server`) on http. Where there is no listing
  (most public sites) it shows the `.md` documents the page links to instead, or nothing. For `file://` the background script
  fetches the listing (names only, for a `.md` page of ours). The panel has Up (lists the parent folder in place) and Back (the document read before this one; the last two document URLs are kept in extension storage). Firefox's `file://` listing is read
  as a page of links (`npm run e2e:firefox` checks it in real Firefox). The panel can list any folder on this machine, not only the ones under "Render only these folders" (those limit where documents are rendered, not access)
- The theme starts on **system** (follows the browser's light/dark setting) until you choose dark or light.
- Theme styles: the gear next to Theme in Settings picks a style (mt-md default, Catppuccin, Solarized, Rosé Pine; each has a
  light and a dark set, so it works with the light/dark/system choice). Your own styles are added in the popup under Themes
  (upload a JSON file or paste it; Firefox closes a popup when a file dialog opens, so there only paste is offered). "Copy
  prompt for your AI" copies instructions for an assistant to write the file. A theme file holds a `name`, a `light` and a
  `dark` set of colours (and optionally fonts and a reading width) and nothing else: `src/themes.js` refuses anything with
  `url()`, braces, semicolons or unknown keys, checks the saved list again on every read, and allows 10 custom themes of up
  to 20 KB. Each custom theme in the popup has Edit (puts its JSON back in the paste box; the same name replaces it), Copy
  JSON and Remove. "Sync my themes across my devices" also keeps them in `storage.sync`, which the browser copies between the person's
  own devices when browser sync is on (the extension makes no request); while it is on the synced list is the one that counts, so a
  removal reaches the other devices, and switching it on merges the two lists with the synced copy winning. Bundled palettes and their licences are in `THIRD_PARTY_NOTICES.md`.
- Auto-reload: the page re-renders when the file changes (`file://` documents and `localhost` servers), keeping the scroll
  position, the raw/rendered choice and the contents panel. The toolbar's circular-arrows button pauses it (remembered), and
  on other sites it re-checks once. A small background script reads `file://` documents, because a page cannot read its own
  file; it only answers our own content script, only for `.md` files, and only for the page that asked
- Print and PDF layout (`src/styles/print.css`): A4, forced light palette, sensible page breaks

**Set-up page.** After a fresh install mt-md opens a short page (`welcome.html`, also reachable from the popup's *Local file settings*)
that shows, live, whether the browser lets mt-md read local files, how to allow it in this browser, and an optional **Render only these folders**
list (one path per line, subfolders included; files elsewhere stay plain text; it limits where documents are rendered, not what the browser lets the extension reach, and the popup can still *Render once* or *Add this folder*).
Until local files are allowed the toolbar button carries a red **!** (dismiss it with *I don't need local files*). Chrome's switch is
"Allow access to file URLs"; Firefox (since its opt-in for local files, preference `extensions.webextensions.fileSchemeAccess.requireOptIn`)
needs "Allow access to file URLs" in the add-on's Permissions tab. Both are asked the same way (`extension.isAllowedFileSchemeAccess`).

**Site access.** `file://` documents and `localhost` always work. Any other site is off until you allow it: open a `.md` page
on that site, click the toolbar icon, and press **Allow this site** (or **Render once**). The browser grants the whole host (`https://host/*`); mt-md itself
only acts on `.md` pages there. **Allow all sites** grants every `http(s)` host in one go (still only `.md` pages are acted on). Both can be removed from the
same popup. Under the hood the extension declares `http(s)` hosts as *optional*
host permissions and registers its content script for the granted hosts (`src/sites.js`), so allowing more sites needs no
new release and no store review.

For local files, turn on "Allow access to file URLs" for the extension (`chrome://extensions`, or the add-on's Permissions tab in Firefox). Without it the browser runs no extension code on a local page, which is why the set-up page and the popup explain it.
For local files an optional `mt-md-theme.css` next to the document is read and applied.

## Install

| Where | How |
|---|---|
| Self-hosted update channel | open the install page (`<baseUrl>/` from `hosting.json`); the page detects the browser and offers the matching install |
| Firefox | the Mozilla-signed XPI from that page; it updates itself from `firefox/updates.json` |
| Chrome Web Store | submitted as an unlisted item (link only), pending Google's review; see `CHROMEWEBSTORE.md` |
| Chrome without the store | force-install by policy: copy `build/policy/chrome-managed.json` (made by `npm run package` from `hosting.json`) to `/etc/opt/chrome/policies/managed/` (Flatpak Chrome merges the host's `/etc/opt/chrome/policies/managed`) |

The self-hosted Chrome build keeps a fixed extension ID (`keahkebjkabggblfaffdgdpiobhmdfon`, from the `key` in
`manifest.chrome.json`). The store listing has its own ID, so do not install both in one browser.

## Develop

```
npm install
npm run gate           # lint, build, package, unit tests
npm run e2e            # real Chromium with the extension loaded; needs `chromium` (or CHROMIUM=…) and a prior `npm run package`
npm run preflight      # gate + e2e
npm run e2e:firefox    # the Firefox build in a real headless Firefox over http (needs `firefox`)
npm run package        # build/chrome, build/firefox, build/chrome-store and the store zip
```

Layout: `src/` (content script, `autoreload.js`, `background.js`, `diagrams/`, `styles/`, `theme.js`, `math.js`), `test/` (jsdom + `node:test`),
`scripts/` (build, package, release, store tooling), `manifest.{chrome,firefox}.json`.

To try an unpacked build, load `build/chrome-store`, not `build/chrome`: this Chromium refuses to load an unpacked extension whose manifest
carries the fixed `key` (that build is only for the packed, self-hosted CRX).

Things that are easy to break:

- **Six bundles, not one.** `dist/mt-md.js`, `dist/mt-md-mermaid.js`, `dist/mt-md-graphviz.js`, `dist/mt-md-vega.js`, `dist/mt-md-infographic.js` and `dist/mt-md-drawio.js`. AMO will not parse a
  script over 5 MB; a test fails the build if any file is bigger. The vendor bundles register on `globalThis.__mtVendor`
  and the manifests load them before the main script.
- **No ELK layout.** Mermaid's ELK engine is aliased to a stub to save 1.5 MB, so Mermaid is told to use `layout: "dagre"`
  explicitly (without it every flowchart fails). Diagrams that ask for `layout: elk` show an error.
- **Diagram CSS.** Article paragraph margins must not reach Mermaid's labels (`base.css`, `.mt-md-diagram svg p`), or node
  labels are clipped.
- Firefox needs `strict_min_version` 142 and `data_collection_permissions` for AMO.

## Feedback

One **Feedback** link sits in the in-page Settings panel and in the toolbar popup. By default it opens the project's new-issue page
(`feedbackUrl` in `support.json`; an https address, GitHub or GitLab) with a short template: what happened, what you expected, and one line
with the mt-md version, the browser and the kind of page (a local file, localhost or a website). It never includes an address or any text from
a document, and the extension sends nothing itself: the issue page shows what is filled in and you decide whether to submit.

The gear beside it in Settings chooses where it goes, and the choice is remembered: the issue page, an email to the project (`feedbackEmail` in
`support.json`: a `mailto:` with the same template, opening the reader's own mail program, no account needed), or a link or email address of the
reader's own (an https link is opened as it is, with nothing filled in). A choice that cannot be used falls back to the issue page, then to the email.
Hovering the link (its tooltip and accessible name) always says where it goes now, and the popup's link follows the same choice. Nothing is sent until
the reader submits the issue or sends the message.

## Self-hosting settings

The address your updates are served from is **not in the repo**. Copy `hosting.example.json` to `hosting.json` (git-ignored; or point `MT_MD_HOSTING` at another file) and
set `baseUrl` (public https address of the folder) and `publishTarget` (an rsync destination). `npm run package` writes them into the
builds' `update_url` and into `build/policy/chrome-managed.json`; `npm run release` needs them. Without the file
everything still builds, just with no self-update address.

## Releasing

Bump `version` in **both** manifests (and `package.json`), then:

0. **Store texts first:** `npm run release` stops until the store texts and screenshots have been reviewed for this version (see `CHROMEWEBSTORE.md`, "Every release"): edit `store/listing.json`, `npm run store:assets`, paste into the dashboard, `npm run listing:confirm`.
1. `npm run preflight` (gate, then the end-to-end run: charset-less UTF-8, the Bundle button with its folder picker on
   `test/bundle-demo`, and rendering of the bundled file). `npm run release` and `npm run release:store` run the end-to-end
   check again themselves, but a failure after signing wastes a version number, so run preflight first.
2. **Firefox:** `npm run sign:firefox` signs `build/firefox` as an unlisted add-on and files the XPI (the AMO API credentials are read from
   a private file in `~/.config/browser-ext/`, outside the repository, and travel in the environment, never on the command
   line; output is scrubbed of them). Do not run `web-ext sign --api-key …` by hand: `npx` echoes its command line. AMO signs in a minute or two. If the command
   times out the upload still goes through; fetch the signed file from the AMO API instead of resubmitting. Save it as
   `release/mt-md/firefox/mt-md-<v>.xpi`.
3. `CHROME_BIN=<chromium> npm run release` packs `release/mt-md/chrome/mt-md-<v>.crx` and `updates.xml`, writes
   `firefox/updates.json` from the signed XPI, and the catalog entry (`meta.json`, `icon.png`). The CRX is signed with
   `~/.config/browser-ext/mt-md.pem` (mode 600, never in the repo; losing it changes the extension ID).
4. **Publish:** copy `release/mt-md/` to the folder your web server serves at `<baseUrl>/mt-md/` (for example
   `rsync -a release/mt-md/ <publishTarget>mt-md/`), so that `<baseUrl>/mt-md/chrome/updates.xml` resolves. The install page that lists several
   extensions is built by a script that is not part of this repository.
5. **Chrome Web Store:** `npm run release:store` uploads the store zip and submits it for review
   (service account; setup and listing text in `CHROMEWEBSTORE.md`). Wait for a pending review to finish first.

## Icons

The icon is the Model Tether base mark (an Ouroboros ring: M for the head, T for the tail) with `.md` in orange. Both are
generated, not hand-drawn. The finished files are in `icons/`. `icons/gen_icons.py` adds the `.md` and writes `icon-{16,32,48,128}.png`;
it needs the base-mark script (`gen_icons.py`, expected in `../../../shared/icons`), which is not part of this repository,
so you can only regenerate the icons if you have it.

## Permissions, and why

- **None at install that read your browsing:** no `tabs`, no history, no cookies, no "all websites".
- `storage`: your settings (theme, toolbar choices, editor, the Files panel's open folders, the last two documents for Back), on your device only.
- `activeTab` and `scripting`: the popup's "Render once" and "Allow this site" act on the page you are looking at; granted sites get the content script registered.
- `downloads`: Export saves into a folder inside Downloads, or through Save as. Only files you export, and only inside Downloads; with the default setting (the Downloads folder itself) it is not used at all.
- Hosts: `file:///*/*.md` (local files; in Firefox also an *optional* `file:///*` host permission, which is what its "Allow access to file URLs" opt-in grants) and `localhost`, `127.0.0.1`, `[::1]` `.md` pages. Everything else is an *optional* host permission you grant per site (or all at once) from the popup, and can remove there.

## Known limits

- The printed table of contents has no page numbers in Chrome (no `target-counter`).
- Tall tables may split across print pages.
- Mermaid printed from dark mode may keep its dark palette (not verified).
- The extension only runs once the browser shows the file as text. Where a browser offers to download a `.md` instead of displaying it (Firefox on Linux with some desktop setups, or a server that sends an unusual content type), the extension never sees the page.
- `file://` in **Firefox** needs the user's opt-in (see above). `npm run e2e:firefox` checks both sides in real Firefox 155: plain text without the opt-in, and with the opt-in simulated by the preference (rendering, folder listing, auto-reload, Edit). It cannot click the real switch, open the popup or the set-up page.
- Single newlines are not line breaks (the Markdown rule); use two trailing spaces or a backslash.
- Safari is not supported (it needs a macOS app wrapper and a paid Apple developer account).
