import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { WIDTHS, SPACINGS, FONTS, ZOOM_STEPS, DEFAULT_LAYOUT, normalizeLayout, isDefaultLayout, stepZoom, nextWidth, layoutVars, applyLayout } from "../src/layout.js"
import { mountToolbar } from "../src/toolbar.js"
import { setKeymap, getKeymap, DEFAULT_KEYMAP, installKeys } from "../src/keys.js"

test("saved layouts are checked against the allowed lists, and nothing else gets through", () => {
  assert.deepEqual(normalizeLayout(undefined), DEFAULT_LAYOUT)
  assert.deepEqual(normalizeLayout({ width: "wide", zoom: 125, spacing: "relaxed", font: "serif" }), { width: "wide", zoom: 125, spacing: "relaxed", font: "serif" })
  assert.deepEqual(normalizeLayout({ width: "999px; x", zoom: 137, spacing: "url(x)", font: "evil" }), DEFAULT_LAYOUT)
  assert.ok(isDefaultLayout(null))
  assert.ok(!isDefaultLayout({ zoom: 110 }))
})

test("zoom steps stop at both ends and width cycles through every choice", () => {
  assert.equal(stepZoom(100, 1), 110)
  assert.equal(stepZoom(100, -1), 90)
  assert.equal(stepZoom(ZOOM_STEPS.at(-1), 1), ZOOM_STEPS.at(-1))
  assert.equal(stepZoom(ZOOM_STEPS[0], -1), ZOOM_STEPS[0])
  assert.equal(stepZoom(137, 1), 110, "an odd value counts as 100")
  let w = ""
  const seen = []
  for (let i = 0; i < WIDTHS.length; i++) { seen.push(w); w = nextWidth(w) }
  assert.equal(w, "")
  assert.equal(new Set(seen).size, WIDTHS.length)
})

test("only the choices the reader changed become variables, and the values are fixed ones", () => {
  assert.deepEqual(layoutVars(DEFAULT_LAYOUT), { "--mt-zoom": "1" })
  const v = layoutVars({ width: "full", zoom: 150, spacing: "compact", font: "mono" })
  assert.equal(v["--mt-max-width"], "100%")
  assert.equal(v["--mt-zoom"], "1.5")
  assert.equal(v["--mt-line-height"], "1.4")
  assert.match(v["--mt-font-body"], /monospace/)
  assert.equal(v["--mt-font-heading"], v["--mt-font-body"])
  for (const list of [WIDTHS, SPACINGS, FONTS]) for (const o of list) if (o.css) assert.ok(!/[;{}]|url\(/.test(o.css), o.id)
})

test("applyLayout sets and clears the variables on the page root", () => {
  document.body.innerHTML = '<div id="mt-md-root"></div>'
  const root = document.getElementById("mt-md-root")
  applyLayout(root, { width: "narrow", zoom: 125, spacing: "", font: "" })
  assert.equal(root.style.getPropertyValue("--mt-max-width"), "720px")
  assert.equal(root.style.getPropertyValue("--mt-zoom"), "1.25")
  applyLayout(root, DEFAULT_LAYOUT)
  assert.equal(root.style.getPropertyValue("--mt-max-width"), "", "back to the theme's width")
  assert.equal(root.style.getPropertyValue("--mt-zoom"), "1")
})

test("Settings has a Page layout row with a gear in line with the others, and its choices change the layout", () => {
  document.body.innerHTML = ""
  globalThis.location = window.location
  let value = { ...DEFAULT_LAYOUT }
  const changes = []
  mountToolbar({}, ["theme"], () => {}, null, null, null, { get value() { return value }, onChange: (n) => { value = normalizeLayout(n); changes.push(value) } })
  document.getElementById("mt-md-btn-settings").click()
  const row = document.getElementById("mt-md-layout-toggle").closest(".mt-md-settings-layout")
  assert.deepEqual([...row.children].map((c) => c.id || c.className), ["mt-md-layout-toggle", "mt-md-layout-gear", "mt-md-settings-pin"])
  const editor = document.querySelector(".mt-md-layout-editor")
  assert.ok(editor.hidden)
  document.getElementById("mt-md-layout-gear").click()
  assert.ok(!editor.hidden)
  assert.equal(document.getElementById("mt-md-layout-zoom").textContent, "100%")
  assert.ok(document.getElementById("mt-md-layout-reset").disabled, "nothing to restore yet")
  document.getElementById("mt-md-layout-larger").click()
  assert.equal(value.zoom, 110)
  assert.equal(document.getElementById("mt-md-layout-zoom").textContent, "110%")
  const width = document.getElementById("mt-md-layout-width")
  width.value = "wide"; width.dispatchEvent(new window.Event("change"))
  assert.equal(value.width, "wide")
  assert.ok(!document.getElementById("mt-md-layout-reset").disabled)
  document.getElementById("mt-md-layout-reset").click()
  assert.deepEqual(value, DEFAULT_LAYOUT)
  assert.equal(width.value, "")
})

test("the zoom and width keys exist, + also answers to = (no Shift needed), and 0 is not stolen", () => {
  setKeymap(null)
  const km = getKeymap()
  for (const id of ["zoomin", "zoomout", "zoomreset", "width"]) assert.ok(km[id], id)
  document.body.innerHTML = ""
  const calls = []
  const off = installKeys({ zoomin: () => calls.push("in"), zoomout: () => calls.push("out"), zoomreset: () => calls.push("reset"), width: () => calls.push("w") }, () => true)
  const press = (key, o = {}) => document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...o }))
  press("+", { shiftKey: true }); press("="); press("-"); press("0"); press("w")
  assert.deepEqual(calls, ["in", "in", "out", "reset", "w"])
  assert.deepEqual(getKeymap(), DEFAULT_KEYMAP)
  off()
})
