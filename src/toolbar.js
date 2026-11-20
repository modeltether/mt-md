// Each tool is an icon (24x24 stroke paths); the label stays as the accessible name.
import { keyFor, keyOf, SHORTCUTS, DEFAULT_KEYMAP, keyProblem } from "./keys.js"
import { COPY_FORMATS, normalizeCopy, describeCopy } from "./copier.js"
import { FORMATS, IMAGE_MODES, WHERE, normalizeExport, describeExport } from "./exporter.js"
import { WIDTHS, SPACINGS, FONTS, ZOOM_STEPS, DEFAULT_LAYOUT, normalizeLayout, stepZoom, isDefaultLayout } from "./layout.js"

export const TOOLS = [
  { id: "theme", label: "Theme", title: "Theme", icon: [] },
  { id: "toc", label: "TOC", title: "Toggle table of contents", icon: ["M4 6h16", "M4 12h10", "M4 18h13"] },
  { id: "print", label: "Print", title: "Print / save as PDF", icon: ["M7 9V4h10v5", "M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2", "M7 14h10v6H7Z"] },
  { id: "raw", label: "Raw", title: "Toggle raw Markdown view", icon: ["M8 7l-5 5 5 5", "M16 7l5 5-5 5"] },
  { id: "edit", label: "Edit", title: "Open this file in your editor", icon: ["M4 20h4L19 9l-4-4L4 16Z", "M13.5 6.5l4 4"], fileOnly: true,
    offFile: "Edit works on local files only (file://)." },
  { id: "copy", label: "Copy HTML", title: "Copy rendered HTML to the clipboard", icon: ["M9 9h10v10H9Z", "M5 15V5h10"] },
  { id: "autoreload", label: "Auto-reload", title: "Auto-reload when the file changes", icon: ["M20 6v5h-5", "M4 18v-5h5", "M18.5 10A7 7 0 0 0 6 7.5L4 10", "M5.5 14A7 7 0 0 0 18 16.5L20 14"], toggle: true },
  // the id stays "bundle" so saved menus and shortcuts keep working; the tooltip and name come from the Export choices (describeExport)
  { id: "bundle", label: "Export", title: "Export this document", icon: ["M12 4v10", "M8 10l4 4 4-4", "M5 18h14"] }
]

const SVG_NS = "http://www.w3.org/2000/svg"

export const FEEDBACK_ICON = ["M4 5h16v11H9l-5 4Z"]

export function iconSvg(paths) {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("width", "18")
  svg.setAttribute("height", "18")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "1.7")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute("aria-hidden", "true")
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path")
    path.setAttribute("d", d)
    svg.appendChild(path)
  }
  return svg
}

const TOOLBAR_ID = "mt-md-toolbar"
const SETTINGS_ID = "mt-md-settings"
const HIDE_DELAY_MS = 2500
const SETTINGS_ICON = ["M10.38 4.98L10.66 2.49L13.34 2.49L13.62 4.98L15.82 5.89L17.78 4.33L19.67 6.22L18.11 8.18L19.02 10.38L21.51 10.66L21.51 13.34L19.02 13.62L18.11 15.82L19.67 17.78L17.78 19.67L15.82 18.11L13.62 19.02L13.34 21.51L10.66 21.51L10.38 19.02L8.18 18.11L6.22 19.67L4.33 17.78L5.89 15.82L4.98 13.62L2.49 13.34L2.49 10.66L4.98 10.38L5.89 8.18L4.33 6.22L6.22 4.33L8.18 5.89Z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"] // a gear: eight teeth and a hub

// The theme icon is a circle in three sectors (each sector is painted in its own fixed colour, so it reads the same on a dark or a light page: dark, white, and mid-grey for system with a small grey dot outside it). Clicking turns it clockwise, bringing the next sector under the small dot at the top of the button, so the sectors sit
// counter-clockwise: dark on top, light lower left, system lower right. No line is drawn between dark and light, so neither side looks
// heavier; the lines between the other pairs stay.
export const THEME_ORDER = ["dark", "light", "system"]
const SECTORS = [
  ["s-dark", "M12 12L4.206 7.5A9 9 0 0 1 19.794 7.5Z"],
  ["s-light", "M12 12L4.206 7.5A9 9 0 0 0 12 21Z"],
  ["s-system", "M12 12L19.794 7.5A9 9 0 0 1 12 21Z"],
  ["s-rim", "M4.206 7.5A9 9 0 0 1 19.794 7.5A9 9 0 0 1 12 21A9 9 0 0 1 4.206 7.5Z"],
  ["s-spoke", "M12 12L12 21M12 12L19.794 7.5"]
]
let themeIdx = null
let themeTurns = 0

function themeIcon() {
  const wrap = document.createElement("span")
  wrap.className = "mt-md-theme-icon"
  const svg = iconSvg([])
  svg.classList.add("mt-md-theme-svg")
  for (const [cls, d] of SECTORS) {
    const path = document.createElementNS(SVG_NS, "path")
    path.setAttribute("d", d)
    path.setAttribute("class", cls)
    svg.appendChild(path)
  }
  const sys = document.createElementNS(SVG_NS, "circle")
  sys.setAttribute("class", "s-sysdot")
  sys.setAttribute("cx", "24.1")
  sys.setAttribute("cy", "19")
  sys.setAttribute("r", "1.9")
  svg.appendChild(sys)
  if (themeIdx !== null) svg.style.transform = `rotate(${themeTurns * 120}deg)`
  const dot = document.createElement("i")
  dot.className = "mt-md-theme-dot"
  wrap.append(svg, dot)
  return wrap
}

function editorPicker({ choice, options, onChange }) {
  const wrap = document.createElement("div")
  wrap.className = "mt-md-settings-editor"
  const label = document.createElement("label")
  label.textContent = "Editor "
  const select = document.createElement("select")
  select.id = "mt-md-editor-select"
  for (const o of options) select.appendChild(Object.assign(document.createElement("option"), { value: o.id, textContent: o.label }))
  select.value = choice.id
  label.appendChild(select)
  const custom = document.createElement("input")
  custom.type = "text"
  custom.id = "mt-md-editor-custom"
  custom.placeholder = "myeditor://open?file={path}"
  custom.value = choice.custom
  custom.hidden = choice.id !== "custom"
  const changed = () => {
    custom.hidden = select.value !== "custom"
    onChange({ id: select.value, custom: custom.value.trim() })
  }
  select.addEventListener("change", changed)
  custom.addEventListener("change", changed)
  wrap.append(label, custom)
  return wrap
}

// The Export gear: format, what to do with images (HTML), and where the file goes.
function exportPicker({ settings, onChange }, refresh) {
  const wrap = document.createElement("div")
  wrap.className = "mt-md-settings-editor mt-md-export-editor"
  const field = (id, text, options, value) => {
    const label = document.createElement("label")
    label.textContent = text + " "
    const select = document.createElement("select")
    select.id = id
    for (const o of options) select.appendChild(Object.assign(document.createElement("option"), { value: o.id, textContent: o.label }))
    select.value = value
    label.appendChild(select)
    return { label, select }
  }
  const cur = normalizeExport(settings)
  const format = field("mt-md-export-format", "Format", FORMATS, cur.format)
  const images = field("mt-md-export-images", "Images", IMAGE_MODES, cur.images)
  const where = field("mt-md-export-where", "Save to", WHERE, cur.where)
  const folder = document.createElement("input")
  folder.type = "text"
  folder.id = "mt-md-export-folder"
  folder.placeholder = "mt-md"
  folder.maxLength = 120
  folder.value = cur.folder
  folder.setAttribute("aria-label", "Folder name inside Downloads")
  const note = document.createElement("div")
  note.className = "mt-md-export-note"
  const sync = () => {
    const f = format.select.value
    images.label.hidden = f !== "html" // the other formats always carry their pictures
    where.label.hidden = f === "pdf" // the print dialog has its own Save as PDF
    folder.hidden = f === "pdf" || where.select.value !== "folder"
    note.textContent = f === "pdf" ? "Opens your browser's print dialog; choose Save as PDF there."
      : f === "txt" ? "Plain text has no pictures: each is replaced by its description."
      : where.select.value === "folder" ? "A folder inside your browser's Downloads folder, made if it does not exist (up to three levels, like notes/exports)."
      : where.select.value === "ask" ? "Opens your browser's Save as dialog for each export." : ""
    note.hidden = !note.textContent
  }
  const changed = () => {
    onChange(normalizeExport({ format: format.select.value, images: images.select.value, where: where.select.value, folder: folder.value }))
    sync()
    refresh()
  }
  for (const f of [format, images, where]) f.select.addEventListener("change", changed)
  folder.addEventListener("change", () => { changed(); folder.value = normalizeExport({ folder: folder.value }).folder })
  sync()
  wrap.append(format.label, images.label, where.label, folder, note)
  return wrap
}

// The Copy gear: just what goes on the clipboard.
function copyPicker({ settings, onChange }, refresh) {
  const wrap = document.createElement("div")
  wrap.className = "mt-md-settings-editor mt-md-export-editor"
  const label = document.createElement("label")
  label.textContent = "Copy as "
  const select = document.createElement("select")
  select.id = "mt-md-copy-format"
  for (const o of COPY_FORMATS) select.appendChild(Object.assign(document.createElement("option"), { value: o.id, textContent: o.label }))
  select.value = normalizeCopy(settings).format
  select.addEventListener("change", () => { onChange(normalizeCopy({ format: select.value })); refresh() })
  label.appendChild(select)
  wrap.appendChild(label)
  return wrap
}

// Turn every theme icon to the given preference, always forward so the circle keeps rotating the same way.
export function setThemeState(pref) {
  let idx = THEME_ORDER.indexOf(pref)
  if (idx < 0) idx = 1
  themeTurns = themeIdx === null ? idx : themeTurns + ((idx - themeIdx + 3) % 3)
  themeIdx = idx
  for (const svg of document.querySelectorAll(".mt-md-theme-svg")) svg.style.transform = `rotate(${themeTurns * 120}deg)`
  const next = THEME_ORDER[(idx + 1) % 3]
  for (const el of document.querySelectorAll("[data-mt-tool=theme]")) el.title = `Theme: ${pref}. Click for ${next}`
}

const toolIcon = (tool) => (tool.id === "theme" ? themeIcon() : iconSvg(tool.icon))

function stylePicker({ choice, options, onChange }) {
  const wrap = document.createElement("div")
  wrap.className = "mt-md-settings-editor"
  const label = document.createElement("label")
  label.textContent = "Style "
  const select = document.createElement("select")
  select.id = "mt-md-style-select"
  for (const o of options) select.appendChild(Object.assign(document.createElement("option"), { value: o.id, textContent: o.label }))
  select.value = choice
  select.addEventListener("change", () => onChange(select.value))
  label.appendChild(select)
  wrap.appendChild(label)
  return wrap
}

const LAYOUT_ICON = ["M4 5h16v14H4Z", "M9 5v14"]

// The Page layout row: icon, label and a gear in the same places as the other rows; either one opens the choices.
function layoutRow(layout) {
  const wrap = document.createDocumentFragment()
  const row = document.createElement("div")
  row.className = "mt-md-settings-keys mt-md-settings-layout"
  const use = document.createElement("button")
  use.type = "button"
  use.id = "mt-md-layout-toggle"
  use.className = "mt-md-settings-use"
  use.title = "Page width, text size, spacing and font"
  use.append(iconSvg(LAYOUT_ICON), Object.assign(document.createElement("span"), { textContent: "Page layout" }))
  const cog = document.createElement("button")
  cog.type = "button"
  cog.id = "mt-md-layout-gear"
  cog.className = "mt-md-settings-cog"
  cog.title = "Change the page layout"
  cog.setAttribute("aria-label", "Change the page layout")
  cog.setAttribute("aria-expanded", "false")
  const icon = iconSvg(SETTINGS_ICON)
  icon.setAttribute("width", "14")
  icon.setAttribute("height", "14")
  cog.appendChild(icon)
  const spacer = document.createElement("span")
  spacer.className = "mt-md-settings-pin"
  row.append(use, cog, spacer)

  const picker = document.createElement("div")
  picker.className = "mt-md-settings-editor mt-md-layout-editor"
  picker.hidden = true
  const change = (patch) => { layout.onChange(normalizeLayout({ ...layout.value, ...patch })); sync() }
  const choice = (id, text, list, key) => {
    const label = document.createElement("label")
    label.textContent = text
    const select = document.createElement("select")
    select.id = id
    for (const o of list) select.appendChild(Object.assign(document.createElement("option"), { value: o.id, textContent: o.label }))
    select.addEventListener("change", () => change({ [key]: select.value }))
    label.appendChild(select)
    return { label, select }
  }
  const width = choice("mt-md-layout-width", "Width ", WIDTHS, "width")
  const spacing = choice("mt-md-layout-spacing", "Spacing ", SPACINGS, "spacing")
  const font = choice("mt-md-layout-font", "Font ", FONTS, "font")
  const size = document.createElement("div")
  size.className = "mt-md-layout-size"
  const sizeLabel = document.createElement("span")
  sizeLabel.textContent = "Text size "
  const small = Object.assign(document.createElement("button"), { type: "button", id: "mt-md-layout-smaller", textContent: "−", title: "Smaller text" })
  const big = Object.assign(document.createElement("button"), { type: "button", id: "mt-md-layout-larger", textContent: "+", title: "Larger text" })
  const pct = document.createElement("output")
  pct.id = "mt-md-layout-zoom"
  small.addEventListener("click", () => change({ zoom: stepZoom(layout.value.zoom, -1) }))
  big.addEventListener("click", () => change({ zoom: stepZoom(layout.value.zoom, 1) }))
  small.setAttribute("aria-label", "Smaller text")
  big.setAttribute("aria-label", "Larger text")
  size.append(sizeLabel, small, pct, big)
  const reset = Object.assign(document.createElement("button"), { type: "button", id: "mt-md-layout-reset", textContent: "Restore the theme's layout" })
  reset.addEventListener("click", () => change({ ...DEFAULT_LAYOUT }))
  const sync = () => {
    const l = normalizeLayout(layout.value)
    width.select.value = l.width
    spacing.select.value = l.spacing
    font.select.value = l.font
    pct.textContent = `${l.zoom}%`
    small.disabled = l.zoom <= ZOOM_STEPS[0]
    big.disabled = l.zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]
    reset.disabled = isDefaultLayout(l)
  }
  sync()
  picker.append(width.label, size, spacing.label, font.label, reset)
  const toggle = () => {
    picker.hidden = !picker.hidden
    cog.setAttribute("aria-expanded", String(!picker.hidden))
    if (!picker.hidden) sync() // a key such as + may have changed the layout meanwhile
  }
  use.addEventListener("click", toggle)
  cog.addEventListener("click", toggle)
  wrap.append(row, picker)
  return wrap
}

const KEYBOARD_ICON = ["M3 6h18v12H3Z", "M7 10h.01", "M11 10h.01", "M15 10h.01", "M7 14h10"]

// The Keyboard shortcuts row: pressed (highlighted) while on, like Auto-reload, with a gear that opens every key to change.
// It is not a toolbar tool, so it has no Menu checkbox.
function keysRow(keys, onChange) {
  const wrap = document.createDocumentFragment()
  const row = document.createElement("div")
  row.className = "mt-md-settings-keys"
  const use = document.createElement("button")
  use.type = "button"
  use.id = "mt-md-keys-toggle"
  use.className = "mt-md-settings-use"
  use.setAttribute("aria-pressed", String(!!keys.on))
  use.title = "Turn the keyboard shortcuts on or off"
  use.append(iconSvg(KEYBOARD_ICON), Object.assign(document.createElement("span"), { textContent: "Keyboard shortcuts" }))
  use.addEventListener("click", () => {
    keys.onChange(!keys.on)
    use.setAttribute("aria-pressed", String(!!keys.on))
    onChange()
  })
  const cog = document.createElement("button")
  cog.type = "button"
  cog.id = "mt-md-keys-gear"
  cog.className = "mt-md-settings-cog"
  cog.title = "See, change or clear the keys"
  cog.setAttribute("aria-label", "See and change the keys")
  cog.setAttribute("aria-expanded", "false")
  const icon = iconSvg(SETTINGS_ICON)
  icon.setAttribute("width", "14")
  icon.setAttribute("height", "14")
  cog.appendChild(icon)
  // an empty cell where the other rows have their Menu checkbox, so this gear lines up with theirs
  const spacer = document.createElement("span")
  spacer.className = "mt-md-settings-pin"
  row.append(use, cog, spacer)

  const picker = document.createElement("div")
  picker.className = "mt-md-settings-editor mt-md-keys-editor"
  picker.hidden = true
  const note = document.createElement("div")
  note.className = "mt-md-keys-msg"
  note.setAttribute("role", "status")
  const grid = document.createElement("div")
  grid.className = "mt-md-keys-grid"
  const draw = () => {
    grid.replaceChildren()
    for (const s of SHORTCUTS) {
      const label = document.createElement("label")
      label.textContent = s.label
      const input = document.createElement("input")
      input.type = "text"
      input.maxLength = 1
      input.size = 2
      input.dataset.mtKeyFor = s.id
      input.value = keyOf(s.id)
      input.setAttribute("aria-label", `Key for: ${s.label}`)
      input.addEventListener("focus", () => input.select())
      input.placeholder = "–"
      const save = (next, said) => { keys.onMap({ ...keys.map, [s.id]: next }); note.textContent = said; input.value = keyOf(s.id); onChange() }
      // Backspace or Delete clears the shortcut: it then has no key (the toolbar button still works)
      input.addEventListener("keydown", (e) => {
        if ((e.key === "Backspace" || e.key === "Delete") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); save("", `${s.label}: no key`) }
      })
      input.addEventListener("input", () => {
        if (input.value === "") return save("", `${s.label}: no key`)
        const problem = keyProblem(s.id, input.value, keys.map)
        if (problem) { note.textContent = problem; input.value = keyOf(s.id); return }
        save(input.value, "")
      })
      input.addEventListener("blur", () => { input.value = keyOf(s.id) })
      grid.append(label, input)
    }
  }
  draw()
  const reset = document.createElement("button")
  reset.type = "button"
  reset.id = "mt-md-keys-reset"
  reset.textContent = "Restore the default keys"
  reset.addEventListener("click", () => { keys.onMap({ ...DEFAULT_KEYMAP }); note.textContent = "Default keys restored"; draw(); onChange() })
  picker.append(grid, reset, note)
  cog.addEventListener("click", () => {
    picker.hidden = !picker.hidden
    cog.setAttribute("aria-expanded", String(!picker.hidden))
  })
  wrap.append(row, picker)
  return wrap
}

// The one Feedback link, laid out like the Keyboard shortcuts row: the link, then a gear that opens where it should go.
// `feedback` is { target(), settings, choices, onChange }: target() is the current destination ({ href, newTab, title }), so
// the tooltip always names it, and it is asked again whenever the choice changes.
function feedbackRow(feedback) {
  const wrap = document.createDocumentFragment()
  const row = document.createElement("div")
  row.className = "mt-md-settings-keys"
  const a = document.createElement("a")
  a.id = "mt-md-feedback"
  a.className = "mt-md-settings-use"
  a.append(iconSvg(FEEDBACK_ICON), Object.assign(document.createElement("span"), { textContent: "Feedback" }))
  const refresh = () => {
    const t = feedback.target()
    a.hidden = !t
    if (!t) return
    a.href = t.href
    a.title = t.title
    a.setAttribute("aria-label", t.title)
    if (t.newTab) { a.target = "_blank"; a.rel = "noopener noreferrer" } else { a.removeAttribute("target"); a.removeAttribute("rel") }
  }
  const cog = document.createElement("button")
  cog.type = "button"
  cog.id = "mt-md-feedback-gear"
  cog.className = "mt-md-settings-cog"
  cog.title = "Choose where the Feedback link goes"
  cog.setAttribute("aria-label", "Choose where the Feedback link goes")
  cog.setAttribute("aria-expanded", "false")
  const icon = iconSvg(SETTINGS_ICON)
  icon.setAttribute("width", "14")
  icon.setAttribute("height", "14")
  cog.appendChild(icon)
  const spacer = document.createElement("span")
  spacer.className = "mt-md-settings-pin"
  row.append(a, cog, spacer)

  const picker = document.createElement("div")
  picker.className = "mt-md-settings-editor"
  picker.hidden = true
  const label = document.createElement("label")
  label.textContent = "Goes to "
  const select = document.createElement("select")
  select.id = "mt-md-feedback-choice"
  for (const o of feedback.choices) select.appendChild(Object.assign(document.createElement("option"), { value: o.id, textContent: o.label }))
  select.value = feedback.settings.choice
  label.appendChild(select)
  const custom = document.createElement("input")
  custom.type = "text"
  custom.id = "mt-md-feedback-custom"
  custom.placeholder = "https://… or name@example.org"
  custom.setAttribute("aria-label", "Your own feedback link or email address")
  custom.value = feedback.settings.custom
  custom.hidden = select.value !== "custom"
  const changed = () => {
    custom.hidden = select.value !== "custom"
    feedback.onChange({ choice: select.value, custom: custom.value.trim() })
    refresh()
  }
  select.addEventListener("change", changed)
  custom.addEventListener("change", changed)
  picker.append(label, custom)
  cog.addEventListener("click", () => {
    picker.hidden = !picker.hidden
    cog.setAttribute("aria-expanded", String(!picker.hidden))
  })
  refresh()
  wrap.append(row, picker)
  return wrap
}

// `pinned` are the tool ids shown on the toolbar; `onPins(ids)` is told when the settings page changes them.
// Every tool keeps its button (hidden when not pinned), so state like "pressed" stays in step.
// `editor` ({ choice, options, onChange }) adds the editor picker to the settings page (file: pages only).
// `themes` ({ choice, options, onChange }) adds a gear on the Theme row that opens the theme style choice.
export function mountToolbar(handlers, pinned = [], onPins = () => {}, editor = null, themes = null, keys = null, layout = null, exporter = null, copier = null, feedback = null) {
  const bar = document.createElement("div")
  bar.id = TOOLBAR_ID
  const buttons = new Map()
  const onFile = location.protocol === "file:"
  const tools = TOOLS
  const unavailable = (tool) => !!tool.fileOnly && !onFile // shown, but greyed out with the reason
  const withKey = (text, tool) => (keys?.on && keyFor(tool.id) ? `${text} (${keyFor(tool.id)})` : text)
  const dynamic = (tool) => (tool.id === "bundle" && exporter ? describeExport(exporter.settings) : tool.id === "copy" && copier ? describeCopy(copier.settings) : null)
  const titleOf = (tool) => dynamic(tool)?.title ?? tool.title
  const hint = (tool) => (unavailable(tool) ? tool.offFile : withKey(titleOf(tool), tool))
  const refreshHints = () => {
    for (const tool of tools) {
      buttons.get(tool.id).title = hint(tool)
      if (dynamic(tool)) buttons.get(tool.id).setAttribute("aria-label", dynamic(tool).label)
      const use = document.querySelector(`#${SETTINGS_ID} [data-mt-row="${tool.id}"]`)
      if (use) use.title = hint(tool)
    }
  }
  for (const tool of tools) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.id = `mt-md-btn-${tool.id}`
    btn.className = "mt-md-tool"
    btn.dataset.mtTool = tool.id
    btn.setAttribute("aria-label", dynamic(tool)?.label ?? tool.label)
    if (tool.toggle) btn.setAttribute("aria-pressed", "false")
    btn.title = hint(tool)
    btn.disabled = unavailable(tool)
    btn.hidden = !pinned.includes(tool.id)
    btn.appendChild(toolIcon(tool))
    btn.addEventListener("click", () => handlers[tool.id]?.())
    buttons.set(tool.id, btn)
    bar.appendChild(btn)
  }
  const gear = document.createElement("button")
  gear.type = "button"
  gear.id = "mt-md-btn-settings"
  gear.className = "mt-md-tool"
  gear.setAttribute("aria-label", "Settings")
  gear.title = "Settings: choose what appears on this menu"
  gear.appendChild(iconSvg(SETTINGS_ICON))
  bar.appendChild(gear) // always last
  document.body.appendChild(bar)

  let panel = null
  const pins = new Set(pinned)
  const closePanel = () => {
    panel?.remove()
    panel = null
    gear.setAttribute("aria-pressed", "false")
  }
  const openPanel = () => {
    panel = document.createElement("div")
    panel.id = SETTINGS_ID
    const h = document.createElement("div")
    h.className = "mt-md-settings-title"
    h.textContent = "Settings"
    const sub = document.createElement("div")
    sub.className = "mt-md-settings-sub"
    sub.textContent = "Click to use. Tick to keep in the menu."
    const cols = document.createElement("div")
    cols.className = "mt-md-settings-cols"
    cols.textContent = "Menu"
    panel.append(h, sub, cols)
    for (const tool of tools) {
      const row = document.createElement("div")
      row.className = "mt-md-settings-row"
      const use = document.createElement("button")
      use.type = "button"
      use.className = "mt-md-settings-use"
      use.dataset.mtTool = tool.id
      use.dataset.mtRow = tool.id
      if (tool.toggle) use.setAttribute("aria-pressed", buttons.get(tool.id).getAttribute("aria-pressed"))
      use.title = hint(tool)
      use.disabled = unavailable(tool)
      use.append(toolIcon(tool), Object.assign(document.createElement("span"), { textContent: tool.label }))
      use.addEventListener("click", () => {
        handlers[tool.id]?.()
        if (tool.toggle) queueMicrotask(() => use.setAttribute("aria-pressed", buttons.get(tool.id).getAttribute("aria-pressed")))
      })
      const label = document.createElement("label")
      label.className = "mt-md-settings-pin"
      const box = document.createElement("input")
      box.type = "checkbox"
      box.checked = pins.has(tool.id)
      box.setAttribute("aria-label", `Show ${tool.label} in the menu`)
      box.addEventListener("change", () => {
        if (box.checked) pins.add(tool.id)
        else pins.delete(tool.id)
        buttons.get(tool.id).hidden = !box.checked
        onPins(TOOLS.map((t) => t.id).filter((id) => pins.has(id)))
      })
      label.appendChild(box)
      row.append(use)
      let picker = null
      const addCog = (id, title, makePicker) => {
        // a small gear on this row opens its choice just below it
        const cog = document.createElement("button")
        cog.type = "button"
        cog.className = "mt-md-settings-cog"
        cog.id = id
        cog.title = title
        cog.setAttribute("aria-label", title)
        cog.setAttribute("aria-expanded", "false")
        const icon = iconSvg(SETTINGS_ICON)
        icon.setAttribute("width", "14")
        icon.setAttribute("height", "14")
        cog.appendChild(icon)
        picker = makePicker()
        picker.hidden = true
        cog.addEventListener("click", () => {
          picker.hidden = !picker.hidden
          cog.setAttribute("aria-expanded", String(!picker.hidden))
        })
        row.appendChild(cog)
      }
      if (tool.id === "edit" && editor) addCog("mt-md-editor-gear", "Choose the editor", () => editorPicker(editor))
      if (tool.id === "bundle" && exporter) addCog("mt-md-export-gear", "Choose the export format and where it is saved", () => exportPicker(exporter, refreshHints))
      if (tool.id === "copy" && copier) addCog("mt-md-copy-gear", "Choose what Copy puts on the clipboard", () => copyPicker(copier, refreshHints))
      if (tool.id === "theme" && themes) addCog("mt-md-theme-gear", "Choose the theme style", () => stylePicker(themes))
      row.appendChild(label)
      panel.appendChild(row)
      if (picker) panel.appendChild(picker)
    }
    if (layout) panel.appendChild(layoutRow(layout))
    if (keys) panel.appendChild(keysRow(keys, refreshHints))
    if (feedback?.target()) panel.appendChild(feedbackRow(feedback))
    document.body.appendChild(panel)
    gear.setAttribute("aria-pressed", "true")
    if (themeIdx !== null) setThemeState(THEME_ORDER[themeIdx])
  }
  gear.addEventListener("click", () => (panel ? closePanel() : openPanel()))
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closePanel() })
  document.addEventListener("mousedown", (ev) => {
    if (panel && !panel.contains(ev.target) && !bar.contains(ev.target)) closePanel()
  })

  let timer = null
  const scheduleHide = () => {
    bar.classList.remove("mt-md-hidden")
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!bar.matches(":hover") && !panel) bar.classList.add("mt-md-hidden")
    }, HIDE_DELAY_MS)
  }
  document.addEventListener("mousemove", scheduleHide)
  // a pointer that leaves the bar (or a frame) from the bar sends no further mousemove, so the bar must re-arm itself
  bar.addEventListener("mouseleave", scheduleHide)
  scheduleHide()
  return bar
}

export function setPressed(id, pressed) {
  const value = pressed ? "true" : "false"
  document.getElementById(`mt-md-btn-${id}`)?.setAttribute("aria-pressed", value)
  document.querySelector(`#${SETTINGS_ID} [data-mt-row="${id}"]`)?.setAttribute("aria-pressed", value)
}
