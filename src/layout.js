// Page layout: how wide the page is, how big the text is, the line spacing and the font. These are the reader's choices and
// are laid over the theme (so they work with every theme style); an empty choice leaves the theme's own value.
export const LAYOUT_KEY = "mt-md-layout"

export const WIDTHS = [
  { id: "", label: "Theme default" },
  { id: "narrow", label: "Narrow", css: "720px" },
  { id: "medium", label: "Medium", css: "900px" },
  { id: "wide", label: "Wide", css: "1240px" },
  { id: "full", label: "Full window", css: "100%" }
]
export const SPACINGS = [
  { id: "", label: "Theme default" },
  { id: "compact", label: "Compact", css: "1.4" },
  { id: "relaxed", label: "Relaxed", css: "1.9" },
  { id: "airy", label: "Airy", css: "2.2" }
]
export const FONTS = [
  { id: "", label: "Theme default" },
  { id: "sans", label: "Sans-serif", css: 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: "serif", label: "Serif", css: 'Georgia, "Iowan Old Style", "Times New Roman", serif' },
  { id: "mono", label: "Monospace", css: 'ui-monospace, "Cascadia Code", "Fira Code", Menlo, Consolas, monospace' }
]
export const ZOOM_STEPS = [70, 80, 90, 100, 110, 125, 150, 175, 200]
export const DEFAULT_LAYOUT = { width: "", zoom: 100, spacing: "", font: "" }

const pick = (list, id) => (list.some((o) => o.id === id) ? id : "")

// Saved values are checked against the lists above, so nothing but these exact values ever reaches the page's CSS.
export function normalizeLayout(saved) {
  const zoom = ZOOM_STEPS.includes(saved?.zoom) ? saved.zoom : 100
  return { width: pick(WIDTHS, saved?.width), zoom, spacing: pick(SPACINGS, saved?.spacing), font: pick(FONTS, saved?.font) }
}

export const isDefaultLayout = (l) => JSON.stringify(normalizeLayout(l)) === JSON.stringify(DEFAULT_LAYOUT)

export function stepZoom(zoom, direction) {
  const i = Math.max(0, ZOOM_STEPS.indexOf(ZOOM_STEPS.includes(zoom) ? zoom : 100))
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + direction))]
}

// Next width in the list (for a key that cycles it).
export function nextWidth(width) {
  const i = WIDTHS.findIndex((w) => w.id === width)
  return WIDTHS[(i + 1) % WIDTHS.length].id
}

// The CSS variables for this layout (only the ones the reader changed).
export function layoutVars(layout) {
  const l = normalizeLayout(layout)
  const vars = {}
  const css = (list, id) => list.find((o) => o.id === id)?.css
  if (l.width) vars["--mt-max-width"] = css(WIDTHS, l.width)
  if (l.spacing) vars["--mt-line-height"] = css(SPACINGS, l.spacing)
  if (l.font) { vars["--mt-font-body"] = css(FONTS, l.font); vars["--mt-font-heading"] = css(FONTS, l.font) }
  vars["--mt-zoom"] = String(l.zoom / 100)
  return vars
}

export function applyLayout(root, layout) {
  if (!root) return
  const vars = layoutVars(layout)
  for (const k of ["--mt-max-width", "--mt-line-height", "--mt-font-body", "--mt-font-heading", "--mt-zoom"]) {
    if (k in vars) root.style.setProperty(k, vars[k])
    else root.style.removeProperty(k)
  }
  updateContentsMode(root)
}

// The contents panel sits in a side column when the window has room beside the page, otherwise it is the inline "Contents" button.
// The page's width decides, so a wider layout switches to the inline button sooner.
export function updateContentsMode(root = document.getElementById("mt-md-root")) {
  if (!root) return
  const raw = window.getComputedStyle(root).getPropertyValue("--mt-max-width").trim()
  const px = /^(\d+(\.\d+)?)px$/.test(raw) ? parseFloat(raw) : null
  // inside a frame the contents stay the inline button: a side column would cover the frame's text
  document.documentElement.classList.toggle("mt-md-toc-side", px !== null && !root.classList.contains("mt-md-embedded") && window.innerWidth >= px + 420)
}
