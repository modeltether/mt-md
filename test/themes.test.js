import test from "node:test"
import assert from "node:assert/strict"
import { BUILTIN_STYLES, VARS, REQUIRED, MAX_CUSTOM, validateTheme, normalizeCustom, addCustom, styleCss, llmPrompt, findStyle, allStyles, DEFAULT_STYLE } from "../src/themes.js"

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

const COLOURS = Object.keys(VARS).filter((k) => !/^font|maxWidth/.test(k))
const good = () => ({ name: "Mine", light: { bg: "#ffffff", text: "#111111", accent: "#0044cc", border: "#dddddd", codeBg: "#f4f4f4" }, dark: { bg: "#101010", text: "#eeeeee", accent: "#66aaff", border: "#333333", codeBg: "#1a1a1a" } })

test("every bundled style defines every colour in both modes, and the text is readable", () => {
  const styles = BUILTIN_STYLES.filter((s) => s.id !== DEFAULT_STYLE)
  assert.ok(styles.length >= 3)
  for (const s of styles) for (const mode of ["light", "dark"]) {
    for (const k of COLOURS) assert.match(s[mode][k] || "", /^#[0-9a-f]{6}$/i, `${s.id} ${mode} ${k}`)
    assert.ok(contrast(s[mode].text, s[mode].bg) >= 4.5, `${s.id} ${mode} text contrast ${contrast(s[mode].text, s[mode].bg).toFixed(2)}`)
    assert.ok(contrast(s[mode].accent, s[mode].bg) >= 3, `${s.id} ${mode} accent contrast ${contrast(s[mode].accent, s[mode].bg).toFixed(2)}`)
  }
  assert.equal(new Set(BUILTIN_STYLES.map((s) => s.id)).size, BUILTIN_STYLES.length)
})

test("a good theme file is accepted and becomes a custom style", () => {
  const r = validateTheme(JSON.stringify(good()))
  assert.ok(r.ok, JSON.stringify(r))
  assert.equal(r.theme.id, "custom-mine")
  assert.equal(r.theme.label, "Mine")
})

test("a theme file can only carry colours, fonts and a width", () => {
  const bad = (mut) => { const t = good(); mut(t); return validateTheme(JSON.stringify(t)) }
  assert.ok(!bad((t) => (t.light.bg = "url(http://x/y)")).ok)
  assert.ok(!bad((t) => (t.light.bg = "red; background: url(x)")).ok)
  assert.ok(!bad((t) => (t.light.bg = "#fff } body { display:none")).ok)
  assert.ok(!bad((t) => (t.dark.accent = "var(--x)")).ok)
  assert.ok(!bad((t) => (t.light.fontBody = "x; } a{")).ok)
  assert.ok(!bad((t) => (t.light.maxWidth = "100vw; x")).ok)
  assert.ok(!bad((t) => (t.light.position = "fixed")).ok, "unknown key")
  assert.ok(!bad((t) => delete t.dark).ok, "dark set is required")
  assert.ok(!bad((t) => delete t.light.text).ok, "required key")
  assert.ok(!bad((t) => (t.name = "")).ok)
  assert.ok(bad((t) => { t.light.fontBody = "Georgia, 'Times New Roman', serif"; t.light.maxWidth = "900px"; t.dark.note = "rgb(10, 20, 30)"; t.dark.tip = "hsla(120, 40%, 50%, 0.9)" }).ok)
})

test("bad input is refused with a reason", () => {
  assert.deepEqual(validateTheme("not json").errors, ["This is not valid JSON"])
  assert.ok(!validateTheme("[]").ok)
  assert.match(validateTheme("x".repeat(30000)).errors[0], /larger than/)
  assert.ok(validateTheme(JSON.stringify({ name: "x", light: {}, dark: {} })).errors.some((e) => /light.bg is required/.test(e)))
})

test("saved themes are checked again on read, deduplicated and capped", () => {
  const ok = validateTheme(JSON.stringify(good())).theme
  const damaged = { ...ok, light: { ...ok.light, bg: "url(x)" } }
  assert.deepEqual(normalizeCustom([damaged, "x", null]), [])
  assert.equal(normalizeCustom([ok, ok]).length, 1)
  assert.deepEqual(normalizeCustom("nope"), [])
  let list = []
  for (let i = 0; i < MAX_CUSTOM; i++) list = addCustom(list, validateTheme(JSON.stringify({ ...good(), name: "T" + i })).theme).list
  assert.equal(list.length, MAX_CUSTOM)
  assert.ok(addCustom(list, validateTheme(JSON.stringify({ ...good(), name: "Extra" })).theme).error)
  assert.equal(addCustom(list, validateTheme(JSON.stringify({ ...good(), name: "T3" })).theme).list.length, MAX_CUSTOM, "same name replaces")
})

test("style CSS holds only mt-md variables, and the default adds nothing", () => {
  assert.equal(styleCss(findStyle(DEFAULT_STYLE, []), "dark"), "")
  const css = styleCss(findStyle("catppuccin", []), "dark")
  assert.match(css, /--mt-color-bg: #1e1e2e;/)
  for (const line of css.split("\n").filter((l) => l.startsWith("  "))) assert.match(line, /^ {2}--mt-[a-z-]+: [^;{}]+;$/)
  assert.ok(!/url|@import|expression/i.test(css))
  assert.equal(findStyle("gone", []).id, DEFAULT_STYLE)
  assert.ok(allStyles([]).length === BUILTIN_STYLES.length)
})

test("the prompt for an assistant names every key and the rules", () => {
  const p = llmPrompt()
  for (const k of Object.keys(VARS)) assert.ok(p.includes(k), k)
  for (const k of REQUIRED) assert.ok(p.includes(k))
  assert.match(p, /"light"/)
  assert.match(p, /"dark"/)
  assert.match(p, /no url\(\)/i)
})
