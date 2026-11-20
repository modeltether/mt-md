// Theme styles: a named pair of colour sets (light and dark) laid over the built-in light and dark themes.
// A style only changes CSS variables, so every style works with the light/dark/system choice. Bundled styles are listed below;
// people can add their own from the popup (JSON, validated here so a theme can never carry anything but colours, fonts and a width).

export const DEFAULT_STYLE = "default"
export const STYLE_KEY = "mt-md-theme-style"
export const CUSTOM_KEY = "mt-md-themes"
export const MAX_CUSTOM = 10
export const MAX_THEME_BYTES = 20000

// short key -> CSS variable
export const VARS = {
  bg: "--mt-color-bg", text: "--mt-color-text", accent: "--mt-color-accent", border: "--mt-color-border", codeBg: "--mt-color-code-bg",
  note: "--mt-note", warning: "--mt-warning", tip: "--mt-tip", important: "--mt-important", caution: "--mt-caution",
  comment: "--mt-tok-comment", punctuation: "--mt-tok-punctuation", number: "--mt-tok-number", string: "--mt-tok-string",
  operator: "--mt-tok-operator", keyword: "--mt-tok-keyword", function: "--mt-tok-function", regex: "--mt-tok-regex",
  fontBody: "--mt-font-body", fontCode: "--mt-font-code", fontHeading: "--mt-font-heading", maxWidth: "--mt-max-width"
}
export const REQUIRED = ["bg", "text", "accent", "border", "codeBg"]
const FONT_KEYS = ["fontBody", "fontCode", "fontHeading"]

const mk = (bg, text, accent, border, codeBg, note, warning, tip, important, caution, comment, punctuation, number, string, operator, keyword, fn, regex) =>
  ({ bg, text, accent, border, codeBg, note, warning, tip, important, caution, comment, punctuation, number, string, operator, keyword, function: fn, regex })

// Palettes are the published ones (see THIRD_PARTY_NOTICES.md for their licences).
export const BUILTIN_STYLES = [
  { id: DEFAULT_STYLE, label: "mt-md (default)", builtin: true },
  {
    id: "catppuccin", label: "Catppuccin (Latte / Mocha)", builtin: true,
    light: mk("#eff1f5", "#4c4f69", "#1e66f5", "#ccd0da", "#e6e9ef", "#1e66f5", "#df8e1d", "#40a02b", "#8839ef", "#d20f39", "#8c8fa1", "#5c5f77", "#fe640b", "#40a02b", "#04a5e5", "#8839ef", "#1e66f5", "#ea76cb"),
    dark: mk("#1e1e2e", "#cdd6f4", "#89b4fa", "#45475a", "#181825", "#89b4fa", "#f9e2af", "#a6e3a1", "#cba6f7", "#f38ba8", "#6c7086", "#bac2de", "#fab387", "#a6e3a1", "#89dceb", "#cba6f7", "#89b4fa", "#f5c2e7")
  },
  {
    id: "solarized", label: "Solarized (light / dark)", builtin: true,
    light: mk("#fdf6e3", "#586e75", "#268bd2", "#e4ddc8", "#eee8d5", "#268bd2", "#b58900", "#859900", "#6c71c4", "#dc322f", "#93a1a1", "#586e75", "#d33682", "#2aa198", "#859900", "#859900", "#268bd2", "#cb4b16"),
    dark: mk("#002b36", "#93a1a1", "#268bd2", "#0f4a58", "#073642", "#268bd2", "#b58900", "#859900", "#6c71c4", "#dc322f", "#586e75", "#93a1a1", "#d33682", "#2aa198", "#859900", "#859900", "#268bd2", "#cb4b16")
  },
  {
    id: "rose-pine", label: "Rosé Pine (Dawn / main)", builtin: true,
    light: mk("#faf4ed", "#575279", "#286983", "#dfdad9", "#f2e9e1", "#56949f", "#ea9d34", "#286983", "#907aa9", "#b4637a", "#9893a5", "#797593", "#d7827e", "#ea9d34", "#56949f", "#286983", "#d7827e", "#907aa9"),
    dark: mk("#191724", "#e0def4", "#c4a7e7", "#403d52", "#1f1d2e", "#9ccfd8", "#f6c177", "#31748f", "#c4a7e7", "#eb6f92", "#6e6a86", "#908caa", "#ebbcba", "#f6c177", "#9ccfd8", "#31748f", "#ebbcba", "#c4a7e7")
  }
]

// --- validation: nothing but plain colour, font and width values gets through
const COLOUR = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[-0-9.%\s,/a-zA-Z]{1,60}\)|[a-zA-Z]{3,24})$/
const FONT = /^[A-Za-z0-9 ,'"_-]{1,120}$/
const WIDTH = /^[0-9]{2,4}(\.[0-9]+)?(px|rem|em|ch|%)$/

function cleanValue(key, value) {
  if (typeof value !== "string") return null
  const v = value.trim()
  if (FONT_KEYS.includes(key)) return FONT.test(v) ? v : null
  if (key === "maxWidth") return WIDTH.test(v) ? v : null
  return COLOUR.test(v) && !/^(url|var|expression|image|attr|calc|env)$/i.test(v) ? v : null
}

function cleanMode(obj, label, errors) {
  const out = {}
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) { errors.push(`"${label}" must be an object`); return null }
  for (const [k, v] of Object.entries(obj)) {
    if (!(k in VARS)) { errors.push(`${label}: unknown key "${k}"`); continue }
    const c = cleanValue(k, v)
    if (c === null) errors.push(`${label}.${k}: "${String(v).slice(0, 30)}" is not an allowed ${FONT_KEYS.includes(k) ? "font list" : k === "maxWidth" ? "width" : "colour"}`)
    else out[k] = c
  }
  for (const k of REQUIRED) if (!(k in out)) errors.push(`${label}.${k} is required`)
  return out
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "theme"

// -> { ok: true, theme } or { ok: false, errors: [...] }. `text` is the file's contents, or an already parsed object.
export function validateTheme(input) {
  let raw = input
  if (typeof input === "string") {
    if (input.length > MAX_THEME_BYTES) return { ok: false, errors: [`The theme is larger than ${MAX_THEME_BYTES / 1000} KB`] }
    try { raw = JSON.parse(input) } catch { return { ok: false, errors: ["This is not valid JSON"] } }
  }
  const errors = []
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["The theme must be a JSON object"] }
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ").slice(0, 40) : ""
  if (!name) errors.push('"name" is required')
  const light = cleanMode(raw.light, "light", errors)
  const dark = cleanMode(raw.dark, "dark", errors)
  if (errors.length) return { ok: false, errors: errors.slice(0, 8) }
  return { ok: true, theme: { id: `custom-${slug(name)}`, label: name, light, dark } }
}

// The saved list is checked again when it is read, so a damaged or hand-edited entry is dropped, never applied.
export function normalizeCustom(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const item of list) {
    const r = validateTheme(item && typeof item === "object" ? { name: item.label ?? item.name, light: item.light, dark: item.dark } : item)
    if (r.ok && !seen.has(r.theme.id)) { seen.add(r.theme.id); out.push(r.theme) }
    if (out.length >= MAX_CUSTOM) break
  }
  return out
}

// Add or replace (same name) and keep the list short. -> { list } or { error }
export function addCustom(list, theme) {
  const rest = normalizeCustom(list).filter((t) => t.id !== theme.id)
  if (rest.length >= MAX_CUSTOM) return { error: `You can keep up to ${MAX_CUSTOM} custom themes. Remove one first.` }
  return { list: [...rest, theme] }
}

// The theme as a file people can copy, edit and upload again (same name replaces it).
export const themeToJson = (t) => JSON.stringify({ name: t.label, light: t.light, dark: t.dark }, null, 2)

export const allStyles = (custom) => [...BUILTIN_STYLES, ...normalizeCustom(custom)]
export const findStyle = (id, custom) => allStyles(custom).find((s) => s.id === id) || BUILTIN_STYLES[0]

// The CSS laid over the built-in theme for the given mode ("light" or "dark"); "" for the default style.
export function styleCss(style, mode) {
  const set = style?.[mode === "dark" ? "dark" : "light"]
  if (!set) return ""
  const lines = Object.entries(set).filter(([k]) => k in VARS).map(([k, v]) => `  ${VARS[k]}: ${v};`)
  return lines.length ? `:root {\n${lines.join("\n")}\n}\n` : ""
}

// The prompt people copy into their own assistant to make a theme file for upload.
export function llmPrompt() {
  const optional = Object.keys(VARS).filter((k) => !REQUIRED.includes(k))
  return `I use a Markdown viewer browser extension called mt-md. Please design a colour theme for it and give me the result as one JSON file I can upload. Reply with only the JSON in a code block.

The theme needs a "name", a "light" set and a "dark" set. Both sets are required, because the viewer switches between them. All colours should be hex like "#1a1a2e". Text must be easy to read on its background (aim for a contrast ratio of at least 4.5:1) in both sets.

Format:
{
  "name": "My theme",
  "light": { ... },
  "dark": { ... }
}

Keys that every set must have:
- bg: page background
- text: body text
- accent: links and highlights
- border: lines and table borders
- codeBg: background of code blocks

Optional keys (leave out any you do not want to change):
- note, warning, tip, important, caution: the five callout colours
- comment, punctuation, number, string, operator, keyword, function, regex: code highlighting colours
- fontBody, fontCode, fontHeading: font lists such as "Georgia, serif" (letters, digits, spaces, commas and quotes only)
- maxWidth: reading width such as "900px"

Use only these keys and plain values. No CSS, no url(), no comments.

Here is what I would like the theme to look like:
(describe the mood, colours, or a website or palette you like)`
}
