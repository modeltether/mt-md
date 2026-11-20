import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { TOOLS, mountToolbar, setThemeState, THEME_ORDER } from "../src/toolbar.js"
import { DEFAULT_PINNED, normalizePinned } from "../src/menu.js"
import { nextPreference, resolveTheme } from "../src/themepref.js"

const ids = TOOLS.map((t) => t.id)

function page(url = "https://example.test/x.md") {
  const { window } = new JSDOM("<body></body>", { url })
  globalThis.location = window.location
  globalThis.document = window.document
  return window
}

test("toolbar tools, in order (Edit is for file: pages only)", () => {
  assert.deepEqual(ids, ["theme", "toc", "print", "raw", "edit", "copy", "autoreload", "bundle"])
  for (const t of TOOLS) {
    assert.ok(t.label)
    assert.ok(t.title)
  }
})

test("only theme, TOC and Download are on the menu to begin with", () => {
  assert.deepEqual(DEFAULT_PINNED, ["theme", "toc", "bundle"])
  assert.deepEqual(normalizePinned(null, ids), ["theme", "toc", "bundle"])
  assert.deepEqual(normalizePinned(["raw", "nope", "theme"], ids), ["theme", "raw"])
  assert.deepEqual(normalizePinned([], ids), [])
})

test("the toolbar shows the pinned tools and keeps Settings last", () => {
  const w = page()
  const bar = mountToolbar({}, DEFAULT_PINNED)
  const shown = [...bar.querySelectorAll("button")].filter((b) => !b.hidden).map((b) => b.id)
  assert.deepEqual(shown, ["mt-md-btn-theme", "mt-md-btn-toc", "mt-md-btn-bundle", "mt-md-btn-settings"])
  assert.equal(bar.lastElementChild.id, "mt-md-btn-settings")
  w.close()
})

test("the settings page runs a tool and pins or unpins it", () => {
  const w = page()
  const ran = []
  const saved = []
  const bar = mountToolbar({ raw: () => ran.push("raw") }, DEFAULT_PINNED, (v) => saved.push(v))
  bar.querySelector("#mt-md-btn-settings").click()
  const panel = document.getElementById("mt-md-settings")
  assert.equal(panel.querySelectorAll(".mt-md-settings-row").length, 8)
  assert.equal(panel.querySelectorAll("input:checked").length, 3)
  panel.querySelector('[data-mt-row="raw"]').click()
  assert.deepEqual(ran, ["raw"])
  const box = panel.querySelector('[data-mt-row="raw"]').closest(".mt-md-settings-row").querySelector("input")
  box.checked = true
  box.dispatchEvent(new w.Event("change"))
  assert.equal(bar.querySelector("#mt-md-btn-raw").hidden, false)
  assert.deepEqual(saved.at(-1), ["theme", "toc", "raw", "bundle"])
  const toc = panel.querySelector('[data-mt-row="toc"]').closest(".mt-md-settings-row").querySelector("input")
  toc.checked = false
  toc.dispatchEvent(new w.Event("change"))
  assert.equal(bar.querySelector("#mt-md-btn-toc").hidden, true)
  bar.querySelector("#mt-md-btn-settings").click()
  assert.equal(document.getElementById("mt-md-settings"), null)
  w.close()
})

test("the theme circle turns clockwise to line up the active segment with the dot", () => {
  const w = page()
  mountToolbar({}, DEFAULT_PINNED)
  const svg = () => document.querySelector("#mt-md-btn-theme .mt-md-theme-svg")
  assert.ok(document.querySelector("#mt-md-btn-theme .mt-md-theme-dot"))
  assert.deepEqual([...svg().querySelectorAll("path")].map((p) => p.getAttribute("class")), ["s-dark", "s-light", "s-system", "s-rim", "s-spoke"])
  assert.ok(!svg().querySelector(".s-spoke").getAttribute("d").includes("4.206"), "no line between dark and light")
  assert.ok(svg().querySelector("circle.s-sysdot"), "grey dot marks system")
  assert.deepEqual(THEME_ORDER, ["dark", "light", "system"])
  setThemeState("light")
  assert.equal(svg().style.transform, "rotate(120deg)")
  setThemeState("system")
  assert.equal(svg().style.transform, "rotate(240deg)")
  setThemeState("dark") // wraps round: keeps turning the same way
  assert.equal(svg().style.transform, "rotate(360deg)")
  setThemeState("light")
  assert.equal(svg().style.transform, "rotate(480deg)")
  assert.match(document.getElementById("mt-md-btn-theme").title, /light.*system/)
  w.close()
})

test("the theme cycles dark, light, system and system follows the browser", () => {
  assert.equal(nextPreference("dark"), "light")
  assert.equal(nextPreference("light"), "system")
  assert.equal(nextPreference("system"), "dark")
  assert.equal(resolveTheme("dark"), "dark")
  assert.equal(resolveTheme("light"), "light")
  assert.equal(resolveTheme("system"), "light") // no matchMedia here: the light default
})

test("Edit is disabled, with the reason, on web pages and enabled on file: pages; the editor gear is on its row either way", () => {
  const options = [{ id: "vscode", label: "VS Code" }, { id: "custom", label: "Custom" }]
  let w = page()
  let bar = mountToolbar({}, ["theme", "edit"], () => {}, { choice: { id: "vscode", custom: "" }, options, onChange() {} })
  const btn = bar.querySelector("#mt-md-btn-edit")
  assert.equal(btn.disabled, true)
  assert.equal(btn.title, "Edit works on local files only (file://).")
  bar.querySelector("#mt-md-btn-settings").click()
  assert.equal(document.querySelectorAll("#mt-md-settings .mt-md-settings-row").length, 8)
  const row = document.querySelector('#mt-md-settings [data-mt-row="edit"]')
  assert.equal(row.disabled, true)
  assert.match(row.title, /local files only/)
  assert.ok(document.getElementById("mt-md-editor-gear"))
  w.close()
  w = page("file:///home/a/x.md")
  const chosen = []
  bar = mountToolbar({}, ["theme", "edit"], () => {}, { choice: { id: "vscode", custom: "" }, options, onChange: (c) => chosen.push(c) })
  assert.equal(bar.querySelector("#mt-md-btn-edit").disabled, false)
  assert.equal(bar.querySelector("#mt-md-btn-edit").title, "Open this file in your editor")
  bar.querySelector("#mt-md-btn-settings").click()
  assert.equal(document.querySelectorAll("#mt-md-settings .mt-md-settings-row").length, 8)
  assert.equal(document.querySelector('#mt-md-settings [data-mt-row="edit"]').disabled, false)
  const gearEl = document.getElementById("mt-md-editor-gear")
  const select = document.getElementById("mt-md-editor-select")
  assert.equal(select.closest(".mt-md-settings-editor").hidden, true)
  assert.equal(gearEl.closest(".mt-md-settings-row").nextElementSibling, select.closest(".mt-md-settings-editor"))
  gearEl.click()
  assert.equal(select.closest(".mt-md-settings-editor").hidden, false)
  assert.equal(document.getElementById("mt-md-editor-custom").hidden, true)
  select.value = "custom"
  select.dispatchEvent(new w.Event("change"))
  assert.deepEqual(chosen.at(-1), { id: "custom", custom: "" })
  assert.equal(document.getElementById("mt-md-editor-custom").hidden, false)
  w.close()
})
