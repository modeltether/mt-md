import { isMarkdownUrl, rawTextFromBody, bodyIsRawText, titleFromUrl, rawTextAsUtf8, decodeSource, canAutoReload } from "./detect.js"
import { createAutoReload, readSource } from "./autoreload.js"
import { loadSetting, saveSetting } from "./settings.js"
import { bundleMarkdown, bundleFileName, folderLoader, pickFolder, loadImage } from "./bundle.js"
import { COPY_KEY, normalizeCopy, describeCopy, copyPayload, copyToClipboard } from "./copier.js"
import { EXPORT_KEY, FORMATS, normalizeExport, produce, saveBlob, exportFileName } from "./exporter.js"
import { toast } from "./toast.js"
import { splitFrontMatter } from "./frontmatter.js"
import { renderDocument } from "./render.js"
import { loadThemeOverride } from "./themeoverride.js"
import { applyTheme, currentTheme, hasThemeStorage, loadSavedTheme, saveTheme } from "./theme.js"
import { nextPreference, resolveTheme, watchSystemTheme } from "./themepref.js"
import { mountToolbar, setPressed, setThemeState, TOOLS } from "./toolbar.js"
import { DEFAULT_PINNED, normalizePinned } from "./menu.js"
import { emailHref, browserName, pageKind, feedbackTarget, normalizeFeedback, FEEDBACK_KEY, FEEDBACK_CHOICES } from "./feedback.js"
import support from "../support.json"
import { DEFAULT_STYLE, STYLE_KEY, allStyles, findStyle, styleCss } from "./themes.js"
import { loadCustomThemes, watchCustomThemes } from "./themestore.js"
import { startPosition } from "./position.js"
import { FOLDERS_KEY, folderAllowed } from "./folders.js"
import { EDITORS, DEFAULT_EDITOR, normalizeEditor, editorLink, editorLabel } from "./editor.js"
import { buildToc, mountToc, setupScrollspy } from "./toc.js"
import { dirOf, parseListing, isListingOf, visibleEntries, linkedDocuments, foldersBetween } from "./listing.js"
import { mountFiles } from "./filepanel.js"
import { decorateCodeBlocks } from "./codeblocks.js"
import { convertAdmonitions } from "./admonitions.js"
import { highlightAllUnder } from "./prism.js"
import { renderMath } from "./math.js"
import mathFontBytes from "../fonts/mt-math.woff2"
import { setupDiagrams, setDiagramTheme, renderAllDiagrams } from "./diagrams/mermaid.js"
import { setupLightbox } from "./lightbox.js"
import { LAYOUT_KEY, normalizeLayout, applyLayout, updateContentsMode, stepZoom, nextWidth, WIDTHS } from "./layout.js"
import { installKeys, toggleHelp, headingTarget, setKeymap, getKeymap } from "./keys.js"

const ROOT_ID = "mt-md-root"
const KEYS_KEY = "mt-md-keys"
const KEYMAP_KEY = "mt-md-keymap"
let keysOn = true
let layout = normalizeLayout(null)
let exportSettings = normalizeExport(null)
let copySettings = normalizeCopy(null)

let renderedEl
let rawEl
let rawSource = ""
let needFolder = false
let root
let disposeScrollspy = null
let watcher = null
let themeOverride = ""
let themePref = "system" // "dark", "light" or "system"
let pinnedTools = DEFAULT_PINNED
let editorChoice = DEFAULT_EDITOR
let styleId = DEFAULT_STYLE
let customThemes = []
let feedbackSettings = normalizeFeedback(null) // where the Feedback link goes
let lastDoc = "" // the document read before this one
let tocEntries = []
let article = null
// Inside an <iframe> (a local page showing a .md guide next to its own form) the document is read, not managed: no contents
// or file panel to crowd the parent page, no auto-reload, and links leave the frame. The toolbar and its settings stay.
const embedded = (() => { try { return window.self !== window.top } catch { return true } })()
// The Files section: `panel` once the folder listing has loaded; otherwise `linked` documents, if the page links to any.
const folder = { panel: null, linked: [] }

// Equations are MathML, which the browser lays out itself. Stretching brackets, integrals and radicals needs a font with an
// OpenType MATH table, and many systems have none that the browser picks, so ship one. FontFace takes the bytes directly,
// which no page Content-Security-Policy can block (a font-src rule only governs fetched URLs).
function loadMathFont() {
  try {
    const face = new FontFace("MT Math", mathFontBytes.buffer.slice(mathFontBytes.byteOffset, mathFontBytes.byteOffset + mathFontBytes.byteLength))
    face.load().then(() => document.fonts.add(face)).catch(() => {})
  } catch {
    /* no FontFace (tests, old browsers): the system's math font is used */
  }
}

// Build (or rebuild) the rendered and raw views inside the root. Used for the first render and for every auto-reload,
// which keeps the page's scroll position, raw/rendered choice and hidden contents panel.
function build(raw) {
  const keep = {
    rawShown: rawEl ? !rawEl.hidden : false,
    tocHidden: document.getElementById("mt-md-toc")?.classList.contains("mt-md-toc-hidden") ?? false,
  }
  disposeScrollspy?.()
  disposeScrollspy = null
  const { front, body } = splitFrontMatter(raw)
  renderedEl = renderDocument(front, body)
  article = renderedEl.querySelector(".mt-md-article")
  convertAdmonitions(article)
  decorateCodeBlocks(article)
  highlightAllUnder(article)
  renderMath(article)
  if (article.querySelector(".mt-md-math math")) loadMathFont()
  setupDiagrams(article)
  setupLightbox(article)
  tocEntries = buildToc(article)
  if (!embedded && !folder.panel) folder.linked = linkedDocuments(article, location.href)
  mountSidebar(keep.tocHidden)
  rawSource = raw
  rawEl = document.createElement("pre")
  rawEl.className = "mt-md-raw-view"
  rawEl.textContent = raw
  rawEl.hidden = !keep.rawShown
  renderedEl.hidden = keep.rawShown

  root.replaceChildren(renderedEl, rawEl)
  if (embedded) leaveFrameLinks(article)
  document.title = (front && front.title) || titleFromUrl(location.href) || document.title
}

// A link that leaves the document opens in a new tab; one that stays inside it (#section) scrolls the frame.
function leaveFrameLinks(scope) {
  for (const a of scope.querySelectorAll("a[href]")) {
    let u
    try { u = new URL(a.href, location.href) } catch { continue }
    if (u.href.split("#")[0] === location.href.split("#")[0] && u.hash) continue
    a.target = "_blank"
    a.rel = "noopener noreferrer"
  }
}

// The contents (and the Files section above it). Rebuilt when the document re-renders and when the folder listing arrives.
function mountSidebar(hidden = document.getElementById("mt-md-toc")?.classList.contains("mt-md-toc-hidden") ?? false) {
  disposeScrollspy?.()
  disposeScrollspy = null
  document.getElementById("mt-md-toc")?.remove()
  const files = folder.panel || (folder.linked.length ? mountFiles({ title: "Linked documents", entries: folder.linked, currentUrl: location.href, backUrl: lastDoc }) : null)
  if (!tocEntries.length && !files) return
  const toc = mountToc(tocEntries, files)
  // after the title block so the printed contents follow it; the screen sidebar is a floating column
  const header = renderedEl.querySelector(".mt-md-header")
  if (header) header.after(toc)
  else renderedEl.prepend(toc)
  if (hidden) toc.classList.add("mt-md-toc-hidden")
  if (tocEntries.length) disposeScrollspy = setupScrollspy(article, toc)
}

// Read a folder as the page the browser or server shows for it. file: folders go through the background script.
async function readFolder(dirUrl) {
  const api = globalThis.browser ?? globalThis.chrome
  if (dirUrl.startsWith("file:")) {
    try { // Firefox lets the page read its own folder listing; Chrome does not, so the background script does
      const res = await fetch(dirUrl)
      if (res.ok) return await res.text()
    } catch { /* blocked: ask the background script */ }
    const reply = await api.runtime.sendMessage({ type: "mt-md-list", url: dirUrl })
    return reply?.ok ? reply.html : null
  }
  const res = await fetch(dirUrl, { credentials: "same-origin" })
  if (!res.ok || !/html|text/i.test(res.headers.get("content-type") || "")) return null
  return res.text()
}

async function listFolder(dirUrl) {
  const html = await readFolder(dirUrl)
  return html == null ? null : visibleEntries(parseListing(html, dirUrl))
}

// Remember which document was read before this one, so the Files panel can offer Back. Reading another document swaps
// the two, so Back from B returns to A and Back again returns to B.
async function trackLastDoc() {
  if (!(globalThis.browser ?? globalThis.chrome)?.runtime?.id) return
  const here = location.href.split("#")[0]
  const seen = await loadSetting("mt-md-docs", { current: "", previous: "" })
  let previous = seen.previous
  if (seen.current && seen.current !== here) {
    previous = seen.current
    saveSetting("mt-md-docs", { current: here, previous })
  } else if (!seen.current) saveSetting("mt-md-docs", { current: here, previous: "" })
  if (previous && previous !== here) { lastDoc = previous; mountSidebar() }
}

// Show the document's folder, if the browser or server will list it. Anywhere else the linked documents stand in.
async function setupFiles() {
  if (!(globalThis.browser ?? globalThis.chrome)?.runtime?.id) return
  try {
    const dirUrl = dirOf(location.href)
    const html = await readFolder(dirUrl)
    if (html == null) return
    const all = parseListing(html, dirUrl)
    if (!isListingOf(all, location.href)) return
    let entries = visibleEntries(all)
    if (!entries.length) return
    // keep the tree the person was browsing: the same top folder, with the same folders open, as long as this document is in it
    let rootUrl = dirUrl
    let expanded = []
    const saved = await loadSetting("mt-md-tree", null)
    if (saved?.dirUrl && saved.dirUrl !== dirUrl && dirUrl.startsWith(saved.dirUrl)) {
      const top = await listFolder(saved.dirUrl).catch(() => null)
      if (top?.length) { rootUrl = saved.dirUrl; entries = top }
    }
    if (saved?.dirUrl === rootUrl) expanded = saved.open || []
    expanded = [...new Set([...expanded, ...foldersBetween(rootUrl, dirUrl)])] // the folder holding this document is always open
    const open = await loadSetting("mt-md-files-open", true)
    folder.panel = mountFiles({ title: "Files", entries, dirUrl: rootUrl, currentUrl: location.href, backUrl: lastDoc, list: listFolder, open, expanded,
      onState: (state) => saveSetting("mt-md-tree", state), onToggle: (v) => saveSetting("mt-md-files-open", v) })
    mountSidebar()
  } catch {
    /* no listing: the page keeps its contents (and linked documents) */
  }
}

function reload(raw) {
  const y = window.scrollY
  build(raw)
  window.scrollTo(0, y)
  toast("Reloaded")
}

// Re-render when the file changes: file: documents (read by the background script) and local dev servers are watched;
// anything else only re-checks when the button is pressed.
async function setupAutoReload() {
  const decode = (buf) => decodeSource(buf)
  watcher = createAutoReload({ read: () => readSource(location.href, decode), onChange: reload })
  const watchable = canAutoReload(location.href)
  // only inside a real extension (runtime.id): plain pages and the jsdom tests must not start a timer
  const inExtension = !!(globalThis.browser ?? globalThis.chrome)?.runtime?.id
  if (inExtension && watchable && (await loadSetting("mt-md-autoreload", true))) watcher.start()
  setPressed("autoreload", watcher.running)
  document.getElementById("mt-md-btn-autoreload")?.setAttribute("title", watchable ? "Auto-reload when the file changes" : "Check the file for changes now")
}

const currentStyleCss = (name) => styleCss(findStyle(styleId, customThemes), name)

function showTheme() {
  const name = resolveTheme(themePref)
  applyTheme(name, themeOverride, currentStyleCss(name))
  setDiagramTheme(name)
}

// Shortcuts run the toolbar's own handlers, so a greyed-out tool stays inert (it says why instead).
function setLayout(next, say) {
  layout = normalizeLayout(next)
  saveSetting(LAYOUT_KEY, layout)
  applyLayout(root, layout)
  if (say) toast(say)
}

function setupKeys(handlers) {
  const tool = (id) => () => {
    const btn = document.getElementById(`mt-md-btn-${id}`)
    if (btn?.disabled) return toast(btn.title, 5000)
    handlers[id]?.()
  }
  const jump = (dir) => {
    const target = headingTarget([...document.querySelectorAll("#mt-md-root .mt-md-article h1, #mt-md-root .mt-md-article h2, #mt-md-root .mt-md-article h3, #mt-md-root .mt-md-article h4, #mt-md-root .mt-md-article h5, #mt-md-root .mt-md-article h6")], dir)
    if (!target || !target.offsetParent) return
    target.scrollIntoView({ behavior: "smooth" })
    if (target.id) history.replaceState(null, "", `#${target.id}`)
  }
  const files = () => {
    const toc = document.getElementById("mt-md-toc")
    const first = toc?.querySelector(".mt-md-files")
    if (!toc || !first) return toast("This page has no Files panel")
    toc.classList.remove("mt-md-toc-hidden")
    toc.classList.add("mt-md-toc-open")
    const body = first.querySelector(".mt-md-files-body")
    if (body.hidden) first.querySelector(".mt-md-files-head").click()
    ;(body.querySelector('[role="treeitem"][tabindex="0"]') ?? body.querySelector('[role="treeitem"]'))?.focus()
  }
  installKeys({
    theme: tool("theme"), toc: tool("toc"), raw: tool("raw"), edit: tool("edit"), bundle: tool("bundle"), autoreload: tool("autoreload"),
    zoomin: () => setLayout({ ...layout, zoom: stepZoom(layout.zoom, 1) }, `Text size ${stepZoom(layout.zoom, 1)}%`),
    zoomout: () => setLayout({ ...layout, zoom: stepZoom(layout.zoom, -1) }, `Text size ${stepZoom(layout.zoom, -1)}%`),
    zoomreset: () => setLayout({ ...layout, zoom: 100 }, "Text size 100%"),
    width: () => { const w = nextWidth(layout.width); setLayout({ ...layout, width: w }, `Page width: ${WIDTHS.find((x) => x.id === w).label}`) },
    files, settings: () => document.getElementById("mt-md-btn-settings")?.click(), next: () => jump(1), prev: () => jump(-1), help: toggleHelp
  }, () => keysOn)
}

function mount(raw) {
  root = document.createElement("div")
  root.id = ROOT_ID
  document.body.replaceChildren(root)
  if (embedded) root.classList.add("mt-md-embedded")
  build(raw)

  const handlers = {
    theme: () => {
      themePref = nextPreference(themePref)
      showTheme()
      setThemeState(themePref)
      saveTheme(themePref)
    },
    toc: () => {
      const toc = document.getElementById("mt-md-toc")
      if (!toc) return
      toc.classList.toggle("mt-md-toc-hidden")
      if (toc.classList.contains("mt-md-toc-hidden")) toc.classList.remove("mt-md-toc-open")
    },
    print: () => window.print(),
    edit: () => {
      const link = editorLink(location.href, editorChoice)
      if (!link) return toast("Set the editor link in Settings first", 6000)
      toast(`Opening in ${editorLabel(editorChoice)}… (your browser may ask first)`, 6000)
      const a = document.createElement("a")
      a.href = link
      document.body.appendChild(a)
      a.click()
      a.remove()
    },
    raw: () => {
      rawEl.hidden = !rawEl.hidden
      renderedEl.hidden = !renderedEl.hidden
    },
    copy: async () => {
      const fmt = normalizeCopy(copySettings).format
      try {
        await copyToClipboard(await copyPayload(fmt, { rendered: renderedEl, source: rawSource }))
        toast(`Copied ${describeCopy(copySettings).label.slice(5)}`)
      } catch {
        toast("The browser would not let this page use the clipboard")
      }
    },
    autoreload: async () => {
      if (!canAutoReload(location.href)) {
        toast((await watcher.check()) ? "Reloaded" : "No changes")
        return
      }
      if (watcher.running) watcher.stop()
      else watcher.start()
      setPressed("autoreload", watcher.running)
      saveSetting("mt-md-autoreload", watcher.running)
      toast(watcher.running ? "Auto-reload on" : "Auto-reload off")
    },
    bundle: async () => {
      const settings = exportSettings
      const fmt = FORMATS.find((f) => f.id === settings.format)
      if (settings.format === "pdf") {
        toast("Choose Save as PDF in the print dialog")
        return window.print()
      }
      // a page that could not read its own files asks for the folder on the next click (the picker needs a click)
      let loader
      if (needFolder) {
        const files = await pickFolder()
        if (!files.length) return toast("No folder chosen")
        loader = folderLoader(files)
      }
      const saved = async (blob, name) => {
        const how = await saveBlob(blob, name, settings, fmt)
        return how === "cancelled" ? "Save cancelled"
          : how === "downloaded-fallback" ? `Exported ${name} to Downloads (the chosen place could not be used)`
          : how === "saved" && settings.where === "folder" ? `Exported ${name} to Downloads/${settings.folder}` : null
      }
      if (settings.format !== "md") {
        toast(`Exporting ${fmt.ext.toUpperCase()}…`)
        await renderAllDiagrams(document)
        const failed = []
        const docEl = document.querySelector("#mt-md-root .mt-md-doc")
        const { blob, name } = await produce(settings, {
          doc: docEl, title: document.title, css: document.getElementById("mt-md-styles")?.textContent || "", dark: currentTheme() === "dark",
          rootStyle: root.getAttribute("style") || "", href: location.href, load: loader || loadImage, failed,
          backdrop: getComputedStyle(root).backgroundColor,
        })
        const local = failed.filter((u) => u.startsWith("file:"))
        if (!loader && local.length) {
          needFolder = true
          return toast(`${local.length} local image${local.length > 1 ? "s" : ""} can't be read from a file page. Click Export again and choose the folder that holds them.`, 9000)
        }
        needFolder = false
        const note = await saved(blob, name)
        return toast(note || `Exported ${name}` + (failed.length ? ` (${failed.length} image${failed.length > 1 ? "s" : ""} could not be read)` : ""))
      }
      toast("Bundling images…")
      const { text, embedded, skipped, bytes } = await bundleMarkdown(rawSource, location.href, loader)
      const local = skipped.filter((s) => s.url.startsWith("file:"))
      if (!loader && local.length) {
        needFolder = true
        return toast(`${local.length} local image${local.length > 1 ? "s" : ""} can't be read from a file page. Click Export again and choose the folder that holds them.`, 9000)
      }
      needFolder = false
      if (!embedded.length) return toast(skipped.length ? `No image could be read (${skipped.length} skipped)` : "No images to bundle")
      const note = await saved(new Blob([text], { type: "text/markdown;charset=utf-8" }), exportFileName(settings, location.href))
      const kb = Math.round(bytes / 1024)
      toast(note || `Bundled ${embedded.length} image${embedded.length > 1 ? "s" : ""} (${kb} KB)` + (skipped.length ? `, ${skipped.length} left as links` : ""))
    }
  }
  mountToolbar(handlers, pinnedTools, (ids) => saveSetting("mt-md-menu", ids), {
    get choice() { return editorChoice },
    options: EDITORS,
    onChange: (next) => { editorChoice = next; saveSetting("mt-md-editor", next) }
  }, {
    get choice() { return styleId },
    get options() { return allStyles(customThemes).map((t) => ({ id: t.id, label: t.label })) },
    onChange: (id) => { styleId = id; saveSetting(STYLE_KEY, id); showTheme() }
  }, {
    get on() { return keysOn },
    onChange: (v) => { keysOn = v; saveSetting(KEYS_KEY, v) },
    get map() { return getKeymap() },
    onMap: (m) => { saveSetting(KEYMAP_KEY, setKeymap(m)) }
  }, {
    get value() { return layout },
    onChange: (next) => setLayout(next)
  }, {
    get settings() { return exportSettings },
    onChange: (next) => { exportSettings = normalizeExport(next); saveSetting(EXPORT_KEY, exportSettings) }
  }, {
    get settings() { return copySettings },
    onChange: (next) => { copySettings = normalizeCopy(next); saveSetting(COPY_KEY, copySettings) }
  }, (() => {
    const facts = { version: (() => { try { return (globalThis.browser ?? globalThis.chrome).runtime.getManifest().version } catch { return "" } })(), browser: browserName(navigator.userAgent), where: pageKind(location) }
    // the e-mail choice is only offered when the project has an address
    const hasMail = !!emailHref(support.feedbackEmail, facts)
    return {
      get settings() { return feedbackSettings },
      choices: FEEDBACK_CHOICES.filter((c) => c.id !== "email" || hasMail),
      onChange: (next) => { feedbackSettings = normalizeFeedback(next); saveSetting(FEEDBACK_KEY, feedbackSettings) },
      target: () => feedbackTarget(feedbackSettings, support, facts)
    }
  })())
  setThemeState(themePref)
  setupKeys(handlers)
  applyLayout(root, layout)
  window.addEventListener("resize", () => updateContentsMode(root))
}

// Open collapsed <details> while printing so their content is not lost, then restore.
function setupPrintExpand() {
  let opened = []
  window.addEventListener("beforeprint", () => {
    opened = [...document.querySelectorAll("#mt-md-root details:not([open])")]
    opened.forEach((d) => d.setAttribute("open", ""))
  })
  window.addEventListener("afterprint", () => {
    opened.forEach((d) => d.removeAttribute("open"))
    opened = []
  })
}

async function start(savedTheme = "system") {
  if (document.getElementById(ROOT_ID)) return // already rendered (a second content script, e.g. a re-injection)
  if (!isMarkdownUrl(location.href)) return
  if (!bodyIsRawText(document.body)) return
  // "only these folders": a local file outside the person's list is left as plain text (the popup can still render it once)
  if (location.protocol === "file:" && !folderAllowed(location.href, await loadSetting(FOLDERS_KEY, []))) return
  const raw = await rawTextAsUtf8(location.href, rawTextFromBody(document.body))
  themePref = savedTheme
  editorChoice = normalizeEditor(await loadSetting("mt-md-editor", null))
  keysOn = (await loadSetting(KEYS_KEY, true)) !== false
  setKeymap(await loadSetting(KEYMAP_KEY, null))
  layout = normalizeLayout(await loadSetting(LAYOUT_KEY, null))
  exportSettings = normalizeExport(await loadSetting(EXPORT_KEY, null))
  copySettings = normalizeCopy(await loadSetting(COPY_KEY, null))
  feedbackSettings = normalizeFeedback(await loadSetting(FEEDBACK_KEY, null))
  pinnedTools = normalizePinned(await loadSetting("mt-md-menu", null), TOOLS.map((t) => t.id))
  styleId = await loadSetting(STYLE_KEY, DEFAULT_STYLE)
  customThemes = await loadCustomThemes()
  if (!allStyles(customThemes).some((t) => t.id === styleId)) styleId = DEFAULT_STYLE
  applyTheme(resolveTheme(themePref), "", currentStyleCss(resolveTheme(themePref)))
  setDiagramTheme(resolveTheme(themePref))
  // themes added or removed in the popup (or on another device) show up on open pages straight away
  const restyle = () => {
    if (!allStyles(customThemes).some((t) => t.id === styleId)) styleId = DEFAULT_STYLE
    showTheme()
  }
  watchCustomThemes((list) => { customThemes = list; restyle() })
  try {
    (globalThis.browser ?? globalThis.chrome).storage.onChanged.addListener((c, area) => {
      if (area === "local" && c[STYLE_KEY]) { styleId = c[STYLE_KEY].newValue; restyle() }
      if (area === "local" && c[EXPORT_KEY]) exportSettings = normalizeExport(c[EXPORT_KEY].newValue)
      if (area === "local" && c[COPY_KEY]) copySettings = normalizeCopy(c[COPY_KEY].newValue)
      if (area === "local" && c[LAYOUT_KEY]) { layout = normalizeLayout(c[LAYOUT_KEY].newValue); applyLayout(root, layout) }
    })
  } catch {}
  watchSystemTheme(() => { if (themePref === "system") showTheme() })
  mount(raw)
  if (!embedded) startPosition()
  setupPrintExpand()
  setupAutoReload()
  if (!embedded) trackLastDoc().then(setupFiles)
  loadThemeOverride().then((override) => {
    themeOverride = override
    if (override) applyTheme(currentTheme(), override, currentStyleCss(currentTheme()))
  })
}

// Read the saved theme before the first paint of the rendered page; without extension storage
// (tests, plain pages) start straight away.
if (hasThemeStorage()) loadSavedTheme().then(start)
else start()
