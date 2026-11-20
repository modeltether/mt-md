// Keyboard shortcuts: single keys, only while no modifier is held and the person is not typing, so every browser shortcut
// keeps working. They run the same handlers as the toolbar buttons. The Settings page can switch them off.
export const SHORTCUTS = [
  { key: "t", id: "theme", label: "Cycle the theme" },
  { key: "c", id: "toc", label: "Show or hide the contents panel" },
  { key: "f", id: "files", label: "Go to the Files panel" },
  { key: "r", id: "raw", label: "Raw or rendered" },
  { key: "e", id: "edit", label: "Edit in your editor (local files)" },
  { key: "d", id: "bundle", label: "Export (in the format chosen in Settings)" },
  { key: "a", id: "autoreload", label: "Pause or resume auto-reload" },
  { key: "s", id: "settings", label: "Settings" },
  { key: "+", id: "zoomin", label: "Larger text" },
  { key: "-", id: "zoomout", label: "Smaller text" },
  { key: "0", id: "zoomreset", label: "Normal text size" },
  { key: "w", id: "width", label: "Cycle the page width" },
  { key: "j", id: "next", label: "Next heading" },
  { key: "k", id: "prev", label: "Previous heading" },
  { key: "?", id: "help", label: "This list" }
]

export const DEFAULT_KEYMAP = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s.key]))

// The keys in use: the defaults, with whatever the person has changed (kept in extension storage as { action: key }).
let map = { ...DEFAULT_KEYMAP }

// One printable character per action (or "" for none, when the person cleared it), no two actions on the same key;
// anything else falls back to that action's default.
export function normalizeKeymap(saved) {
  const out = {}
  const used = new Set()
  const clean = (k) => (typeof k === "string" && k.length === 1 && /\S/.test(k) ? (/[A-Za-z]/.test(k) ? k.toLowerCase() : k) : "")
  const entries = SHORTCUTS.map((s) => [s.id, clean(saved?.[s.id])])
  for (const [id, k] of entries) if (k && !used.has(k)) { out[id] = k; used.add(k) }
  for (const s of SHORTCUTS) if (saved?.[s.id] === "") out[s.id] = "" // cleared on purpose: no key
  for (const s of SHORTCUTS) if (!(s.id in out)) {
    // a default that another action took over is replaced by the first free letter, so nothing is left without a key
    let k = s.key
    if (used.has(k)) k = "abcdefghijklmnopqrstuvwxyz0123456789".split("").find((c) => !used.has(c)) ?? k
    out[s.id] = k
    used.add(k)
  }
  return out
}

export const setKeymap = (saved) => { map = normalizeKeymap(saved); return map }
export const getKeymap = () => ({ ...map })
export const keyOf = (id) => map[id] ?? ""
export const keyFor = (id) => (map[id] ?? "").toUpperCase()

// Why a key cannot be given to this action, or "" if it can.
export function keyProblem(id, key, current = map) {
  if (typeof key !== "string" || key.length !== 1 || !/\S/.test(key)) return "Use one key, with no space"
  const k = /[A-Za-z]/.test(key) ? key.toLowerCase() : key
  const other = SHORTCUTS.find((s) => s.id !== id && current[s.id] === k)
  return other ? `${k.toUpperCase()} is already used for “${other.label}”` : ""
}

const TYPING = "input, select, textarea, [contenteditable=''], [contenteditable='true']"

// Should this key press be treated as a shortcut at all?
export function isShortcutEvent(ev) {
  if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return false
  const t = ev.target
  if (t?.closest?.(TYPING)) return false
  if (t?.closest?.('[role="tree"]')) return false // the Files tree uses its own keys
  if (document.getElementById("mt-md-lightbox")) return false // the image viewer has its own keys
  return true
}

let sheet = null

export function closeHelp() {
  sheet?.remove()
  sheet = null
}

export function toggleHelp() {
  if (sheet) return closeHelp()
  sheet = document.createElement("div")
  sheet.id = "mt-md-keys"
  sheet.setAttribute("role", "dialog")
  sheet.setAttribute("aria-label", "Keyboard shortcuts")
  const box = document.createElement("div")
  box.className = "mt-md-keys-box"
  const h = document.createElement("div")
  h.className = "mt-md-keys-title"
  h.textContent = "Keyboard shortcuts"
  const list = document.createElement("dl")
  for (const s of SHORTCUTS) {
    const dt = document.createElement("dt")
    const kbd = document.createElement("kbd")
    kbd.textContent = map[s.id] || "–"
    dt.appendChild(kbd)
    const dd = document.createElement("dd")
    dd.textContent = s.label
    list.append(dt, dd)
  }
  const tree = document.createElement("p")
  tree.className = "mt-md-keys-note"
  tree.textContent = "In the Files panel: ↑ ↓ move, → opens a folder, ← closes it or goes to its parent, Home and End jump, a letter jumps to a name, Esc leaves the panel."
  const off = document.createElement("p")
  off.className = "mt-md-keys-note"
  off.textContent = `Change, clear or turn off these shortcuts with the keyboard row in Settings. Press ${keyOf("help") ? `${keyOf("help")} or ` : ""}Esc to close.`
  box.append(h, list, tree, off)
  sheet.appendChild(box)
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeHelp() })
  document.body.appendChild(sheet)
}

// actions: id -> function. enabled(): whether shortcuts are on. Returns a function that removes the listener.
export function installKeys(actions, enabled) {
  const onKey = (ev) => {
    if (ev.key === "Escape" && sheet) { ev.preventDefault(); closeHelp(); return }
    if (!enabled() || !isShortcutEvent(ev)) return
    // a letter matches with caps lock on but not with Shift held; a symbol such as ? is typed with Shift on most keyboards
    const typed = ev.key === "=" && map.zoomin === "+" ? "+" : ev.key // "+" is Shift and "=" on most keyboards
    const hit = SHORTCUTS.find((s) => map[s.id] === typed || (/[a-z]/.test(map[s.id]) && ev.key.toLowerCase() === map[s.id] && !ev.shiftKey))
    if (!hit) return
    const run = actions[hit.id]
    if (!run) return
    ev.preventDefault()
    run()
  }
  document.addEventListener("keydown", onKey)
  return () => document.removeEventListener("keydown", onKey)
}

// The heading to jump to: the first one clearly below the top of the window, or the last one clearly above it.
export function headingTarget(headings, direction, topOffset = 8) {
  if (direction > 0) return headings.find((h) => h.getBoundingClientRect().top > topOffset) ?? null
  const above = headings.filter((h) => h.getBoundingClientRect().top < -topOffset)
  return above[above.length - 1] ?? null
}
