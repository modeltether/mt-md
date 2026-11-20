<!-- slot: intro -->
mt-md turns Markdown (`.md`) files into readable documents. Two quick things to know.

<!-- slot: local -->
## 1. Local files

<!-- slot: local-why -->
Your browser keeps extensions away from files on your computer until you say so. If you only read `.md` files on websites or a local server, you can skip this.

<!-- slot: local-done -->
mt-md can read local files. Open any `.md` file from your computer in a tab to try it.

<!-- slot: folders -->
## Render only these folders *(optional)*

By default mt-md renders every local `.md` file. If you would rather it only rendered certain folders, list them here, one per line (subfolders are included). Files elsewhere stay as plain text.

This limits where documents are *rendered*, not what mt-md can reach: the browser's "Allow access to file URLs" switch covers every file on the computer, and the Files panel can show the names of files and folders outside your list (it never reads their contents until you open one).

<!-- slot: websites -->
## 2. Websites

Local servers (`localhost`) work straight away. For any other website, open a `.md` page there and click the mt-md button in the toolbar and choose **Allow this site** (that site only) or **Allow all sites**. You can remove either in the same place.

<!-- slot: tips -->
## Worth knowing

- **Shortcuts:** press `?` on any page for the list. `T` changes the theme, `C` opens the contents, `F` the files.
- **Look:** Settings (the gear on the toolbar) has your theme style, page width, text size and font.
- **Feedback:** Settings and the toolbar popup both have one **Feedback** link. By default it opens the project's issue page (needs a GitHub account); in Settings, its gear lets you send it to the project's email address (no account) or to a link or address of your own instead. Hover the link to see where it goes now. It fills in only your mt-md version and browser, never the page you were reading, and nothing is sent until you submit or send it.
- **Diagrams:** Mermaid, Graphviz, Vega, `draw.io`, JSON Canvas and infographics are drawn from code blocks, offline.

<!-- slot: disclaimer -->
*mt-md was almost entirely written by AI (Claude, from Anthropic) at the maintainer's direction. No person has reviewed the code line by line; it is tested by its automated unit and browser test suites, which the AI also wrote, so it can contain mistakes. It is provided as it is, without warranty. It runs entirely in your browser and makes no network requests of its own, but images and other things a document points at load from wherever they point. If something looks wrong, please tell us.*
