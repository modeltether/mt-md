# What users of other Markdown viewers complain about, and where mt-md stands

Read on 18 October 2026 from user reviews and issue trackers. Nothing here was run against those extensions; it is what their users wrote.
Sources: the Firefox reviews of [Markdown Viewer (xicilion)](https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-extension/reviews/),
[Markdown Viewer & Reader](https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-reader/reviews/) and
[Markdown Viewer Webext (Cimbali)](https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-webext/reviews/), and the most-discussed issues of
[simov/markdown-viewer](https://github.com/simov/markdown-viewer/issues), [Cimbali/markdown-viewer](https://github.com/Cimbali/markdown-viewer/issues)
and [volca/markdown-preview](https://github.com/volca/markdown-preview/issues). Chrome Web Store review text was not retrievable.

| What users report | Where | mt-md |
|---|---|---|
| "Needs access to all websites, tabs and local files" for something that only renders text (1-star review) | xicilion | **Already narrow.** No `tabs` permission; local files and localhost only until you allow a site; "all sites" is a button you press. See the README's permissions section. |
| Links to `other.md#section` open at the top, not at the section | simov #11 and others | **Was broken, fixed.** The rendered page is built after the browser's own anchor jump, so the jump is now redone (`src/position.js`). |
| Going Back or Forward loses your place | simov #11, volca #16 | **Was broken, fixed.** The position is kept in the history entry and restored after rendering. |
| ```` ```math ```` fences and GitLab's ``$`x`$`` don't render as math | volca #107, simov #24 | **Was missing, fixed.** |
| Raw HTML in a document isn't interpreted / a file that starts with an HTML tag isn't rendered | xicilion review, volca #61, Cimbali #58 | **Fine.** Raw HTML renders (sanitised); tested with a file that opens with a `<div>`. |
| Task lists, tables, footnotes, blank lines in code | simov #17 #152 #125, volca #34 #11 | **Fine.** All forms tested (`-`, `*`, `+`, ordered, nested, upper-case `[X]`). |
| Non-ASCII text garbled when the server sends no charset | simov #7, Cimbali #3 #4 #40, volca #2 | **Fine.** Re-read as UTF-8 (end-to-end tested). |
| Page jumps to the top when it auto-reloads | volca #16, Cimbali #7 | **Fine.** Scroll position, view and open panels are kept. |
| Auto-reload doesn't update on Linux | xicilion review | **Fine over http, checked in real Firefox 155.** For `file://` it works in Chrome; see the Firefox note below. |
| Settings only take effect after refreshing the tab | Viewer & Reader review | **Fine.** Theme, toolbar choices, editor and auto-reload apply immediately; "Allow this site" reloads the tab for you. |
| Extension stops working on a new Firefox version | simov #213 #304, xicilion/Cimbali "security error after an update" | **Checked on Firefox 155** over http (`npm run e2e:firefox`); there is no promise about future versions. |
| Doesn't work with a local http server / `localhost` | Cimbali #100, volca #9 | **Fine.** `localhost`, `127.0.0.1` and `[::1]` on any port work out of the box; other hosts need one click. |
| Blocking third-party cookies breaks scroll/settings | simov #70 | **Not affected.** Settings live in extension storage, not the page's `localStorage`. |
| High CPU / slow on big files | volca #95 | **Fine.** A 2 MB document renders in seconds (tested); auto-reload pauses while the tab is hidden. |
| Wants a way back to the raw text | Cimbali review | **Present** (the Raw tool). It is not on the toolbar by default; tick it in Settings. |
| Single line breaks don't break lines | Cimbali review | **By the Markdown rule:** a newline is a space; use two trailing spaces or a backslash. Not changed. |
| `.md` files are offered for download instead of displayed (Firefox on Linux; some servers) | Cimbali #93, Cimbali review | **Can't fix from an extension:** the extension only runs once the browser shows the file as text. Chrome displayed `text/markdown` here (tested). |
| Local `file://` documents don't render in Firefox | simov #90 #131, Cimbali #105 #6 | **Cause found and handled.** Firefox now requires a per-add-on opt-in ("Allow access to file URLs"); until it is given no extension runs on a local page, so every viewer shows plain text. mt-md now says so: a set-up page after install, a message in the popup on a local page, and a ! on the toolbar button. With the opt-in simulated, mt-md renders, lists the folder, auto-reloads and offers Edit in real Firefox 155. |

## Not done, on purpose
- `.markdown`, `.mdown` and `.mkd` files are not recognised (only `.md`); several competitors do.
- `:emoji:` shortcodes are left as text.
- A "treat line breaks as breaks" option, and MathJax as an alternative to KaTeX.
