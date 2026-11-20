import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import "./setup-window.js"
import { SHORTCUTS, DEFAULT_KEYMAP, keyFor, keyOf, setKeymap, getKeymap, normalizeKeymap, keyProblem, isShortcutEvent, installKeys, toggleHelp, closeHelp, headingTarget } from "../src/keys.js"
import { mountFiles } from "../src/filepanel.js"
import { mountToolbar } from "../src/toolbar.js"

const press = (key, opts = {}, target = document) => {
  const ev = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts })
  ;(target === document ? document.body : target).dispatchEvent(ev)
  return ev
}

test("every shortcut has a unique key and a label, and tools know their key", () => {
  assert.equal(new Set(SHORTCUTS.map((s) => s.key)).size, SHORTCUTS.length)
  assert.ok(SHORTCUTS.every((s) => s.label && s.id))
  assert.equal(keyFor("theme"), "T")
  assert.equal(keyFor("print"), "")
})

test("keys run their action; modifiers, typing and the image viewer are left alone", () => {
  document.body.innerHTML = '<input id="i"><div id="x"></div>'
  const calls = []
  let on = true
  const off = installKeys({ theme: () => calls.push("theme"), next: () => calls.push("next"), help: () => calls.push("help") }, () => on)
  press("t")
  press("T") // caps lock
  assert.deepEqual(calls, ["theme", "theme"])
  press("t", { ctrlKey: true }); press("t", { metaKey: true }); press("t", { altKey: true })
  assert.equal(calls.length, 2, "browser shortcuts are untouched")
  press("t", {}, document.getElementById("i"))
  assert.equal(calls.length, 2, "not while typing")
  press("T", { shiftKey: true })
  assert.equal(calls.length, 2, "shift+letter is not a shortcut")
  press("?", { shiftKey: true })
  assert.equal(calls.at(-1), "help", "? needs shift on most keyboards")
  press("x")
  press("s") // no action registered
  assert.equal(calls.length, 3)
  document.body.insertAdjacentHTML("beforeend", '<div id="mt-md-lightbox"></div>')
  press("t")
  assert.equal(calls.length, 3, "the image viewer has its own keys")
  document.getElementById("mt-md-lightbox").remove()
  on = false
  press("t")
  assert.equal(calls.length, 3, "switched off in Settings")
  off()
})

test("the cheat sheet lists every shortcut and closes with Esc", () => {
  document.body.innerHTML = ""
  const off = installKeys({}, () => true)
  toggleHelp()
  const sheet = document.getElementById("mt-md-keys")
  assert.ok(sheet)
  assert.equal(sheet.querySelectorAll("kbd").length, SHORTCUTS.length)
  press("Escape")
  assert.equal(document.getElementById("mt-md-keys"), null)
  toggleHelp(); toggleHelp()
  assert.equal(document.getElementById("mt-md-keys"), null)
  closeHelp()
  off()
})

test("headingTarget finds the next heading below, or the previous one above, the top of the window", () => {
  const at = (top) => ({ getBoundingClientRect: () => ({ top }) })
  const hs = [at(-300), at(-40), at(0), at(250), at(600)]
  assert.equal(headingTarget(hs, 1), hs[3])
  assert.equal(headingTarget(hs, -1), hs[1])
  assert.equal(headingTarget([at(100)], -1), null)
  assert.equal(headingTarget([at(-100)], 1), null)
})

test("keys can be changed: one printable character each, no two the same, bad saved values fall back", () => {
  assert.deepEqual(normalizeKeymap(undefined), DEFAULT_KEYMAP)
  const m = normalizeKeymap({ theme: "X", toc: "x", raw: null, edit: "ab", bundle: " ", files: 5 })
  assert.equal(m.theme, "x")
  assert.notEqual(m.toc, "x", "the second claim on x loses and gets a free key")
  assert.equal(m.raw, DEFAULT_KEYMAP.raw)
  assert.equal(m.edit, DEFAULT_KEYMAP.edit)
  assert.equal(new Set(Object.values(m)).size, SHORTCUTS.length, "still one key per action")
  assert.match(keyProblem("theme", "c"), /already used/)
  assert.equal(keyProblem("theme", "t"), "", "its own key is fine")
  assert.equal(keyProblem("theme", "z"), "")
  assert.match(keyProblem("theme", " "), /one key/)
  assert.match(keyProblem("theme", "ab"), /one key/)
})

test("a shortcut can be cleared on purpose: it keeps no key and nothing refills it", () => {
  const m = normalizeKeymap({ theme: "", toc: "t" })
  assert.equal(m.theme, "")
  assert.equal(m.toc, "t", "the freed key can be used by another action")
  assert.equal(normalizeKeymap({ theme: undefined }).theme, DEFAULT_KEYMAP.theme, "missing is not the same as cleared")
  document.body.innerHTML = ""
  const calls = []
  const off = installKeys({ theme: () => calls.push("theme"), raw: () => calls.push("raw") }, () => true)
  setKeymap({ theme: "" })
  press("t"); press("r")
  assert.deepEqual(calls, ["raw"], "a cleared shortcut does nothing, others still work")
  assert.equal(keyFor("theme"), "")
  setKeymap(null)
  off()
})

test("a changed key runs the action, the old key stops, and the list shows the new key", () => {
  document.body.innerHTML = ""
  const calls = []
  const off = installKeys({ theme: () => calls.push("theme") }, () => true)
  setKeymap({ theme: "z" })
  press("z"); press("t")
  assert.deepEqual(calls, ["theme"])
  assert.equal(keyFor("theme"), "Z")
  toggleHelp()
  assert.ok([...document.querySelectorAll("#mt-md-keys kbd")].some((k) => k.textContent === "z"))
  closeHelp()
  setKeymap(null)
  assert.deepEqual(getKeymap(), DEFAULT_KEYMAP)
  off()
})

function keysToolbar() {
  document.body.innerHTML = ""
  globalThis.location = window.location
  const state = { on: true, map: { ...DEFAULT_KEYMAP }, saved: [] }
  mountToolbar({}, ["theme", "toc"], () => {}, null, null, {
    get on() { return state.on }, onChange: (v) => { state.on = v },
    get map() { return getKeymap() }, onMap: (m) => { state.saved.push(m); setKeymap(m) }
  })
  document.getElementById("mt-md-btn-settings").click()
  return state
}

test("Settings has a Keyboard shortcuts row like Auto-reload: pressed while on, no Menu box, a gear for the keys", () => {
  setKeymap(null)
  const state = keysToolbar()
  const toggle = document.getElementById("mt-md-keys-toggle")
  assert.equal(toggle.getAttribute("aria-pressed"), "true")
  assert.ok(toggle.querySelector("svg"), "has an icon")
  assert.equal(toggle.closest(".mt-md-settings-keys").querySelector('input[type="checkbox"]'), null, "no Menu checkbox")
  const cells = [...toggle.closest(".mt-md-settings-keys").children]
  assert.deepEqual(cells.map((c) => c.id || c.className), ["mt-md-keys-toggle", "mt-md-keys-gear", "mt-md-settings-pin"], "a spacer takes the Menu column, so the gear lines up with the others")
  assert.match(document.getElementById("mt-md-btn-theme").title, /\(T\)$/)
  toggle.click()
  assert.equal(state.on, false)
  assert.equal(toggle.getAttribute("aria-pressed"), "false")
  assert.ok(!/\(T\)/.test(document.getElementById("mt-md-btn-theme").title), "the hint goes while off")
  toggle.click()
  assert.equal(toggle.getAttribute("aria-pressed"), "true")
})

test("the gear reveals every key; typing a free key changes it, a taken key is refused, and Restore brings the defaults back", () => {
  setKeymap(null)
  const state = keysToolbar()
  const gear = document.getElementById("mt-md-keys-gear")
  const editor = document.querySelector(".mt-md-keys-editor")
  assert.ok(editor.hidden)
  gear.click()
  assert.ok(!editor.hidden)
  const input = (id) => editor.querySelector(`[data-mt-key-for="${id}"]`)
  assert.equal(editor.querySelectorAll("input").length, SHORTCUTS.length)
  assert.equal(input("theme").value, "t")
  const type = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })) }
  type(input("theme"), "z")
  assert.equal(keyOf("theme"), "z")
  assert.match(document.getElementById("mt-md-btn-theme").title, /\(Z\)$/, "tooltips follow")
  type(input("raw"), "z")
  assert.equal(keyOf("raw"), "r", "a key in use is refused")
  assert.match(document.querySelector(".mt-md-keys-msg").textContent, /already used/)
  assert.equal(input("raw").value, "r")
  assert.ok(state.saved.length >= 1)
  const t = input("theme")
  t.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }))
  assert.equal(keyOf("theme"), "", "Backspace clears the shortcut")
  assert.equal(t.value, "")
  assert.ok(!/\(Z\)|\(T\)/.test(document.getElementById("mt-md-btn-theme").title), "no key in the tooltip")
  type(input("raw"), "t")
  assert.equal(keyOf("raw"), "t", "a cleared shortcut's old key is free")
  document.getElementById("mt-md-keys-reset").click()
  assert.deepEqual(getKeymap(), DEFAULT_KEYMAP)
  assert.equal(input("theme").value, "t")
})

const DIR = "file:///d/"
function tree() {
  const { window: w } = new JSDOM("<body></body>")
  const doc = w.document
  const panel = mountFiles({
    title: "Files", currentUrl: DIR + "beta.md", doc, dirUrl: DIR,
    entries: [{ name: "alpha", url: DIR + "alpha/", dir: true }, { name: "beta.md", url: DIR + "beta.md", dir: false }, { name: "gamma.md", url: DIR + "gamma.md", dir: false }],
    list: async (u) => [{ name: "inner.md", url: u + "inner.md", dir: false }]
  })
  doc.body.appendChild(panel)
  const k = async (el, key) => { el.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 5)) }
  return { panel, doc, k, active: () => doc.activeElement?.textContent }
}

test("the Files tree is a tree: one item in the tab order, the current document", () => {
  const { panel } = tree()
  const items = [...panel.querySelectorAll('[role="treeitem"]')]
  assert.equal(panel.querySelector('[role="tree"]')?.tagName, "UL")
  assert.deepEqual(items.map((i) => i.tabIndex), [-1, 0, -1])
  assert.ok(items.every((i) => i.getAttribute("aria-level") === "1"))
})

test("arrows move through the tree, Right opens and enters a folder, Left closes it or goes to the parent", async () => {
  const { panel, doc, k, active } = tree()
  const [alpha, beta, gamma] = panel.querySelectorAll('[role="treeitem"]')
  doc.body.appendChild(Object.assign(doc.createElement("div"))) // focus needs the tree attached
  beta.focus()
  assert.equal(active(), "beta.md")
  await k(beta, "ArrowDown"); assert.equal(active(), "gamma.md")
  await k(gamma, "ArrowDown"); assert.equal(active(), "gamma.md", "stops at the end")
  await k(gamma, "ArrowUp"); assert.equal(active(), "beta.md")
  await k(beta, "Home"); assert.equal(active(), "alpha")
  await k(alpha, "End"); assert.equal(active(), "gamma.md")
  alpha.focus()
  await k(alpha, "ArrowRight")
  assert.equal(alpha.getAttribute("aria-expanded"), "true")
  assert.equal(active(), "alpha", "the first Right opens it")
  await k(alpha, "ArrowRight")
  assert.equal(active(), "inner.md", "the second Right enters it")
  const inner = doc.activeElement
  assert.equal(inner.getAttribute("aria-level"), "2")
  await k(inner, "ArrowDown"); assert.equal(active(), "beta.md", "rows below the open folder follow")
  inner.focus()
  await k(inner, "ArrowLeft"); assert.equal(active(), "alpha", "Left on a document goes to its folder")
  await k(alpha, "ArrowLeft")
  assert.equal(alpha.getAttribute("aria-expanded"), "false")
  await k(alpha, "ArrowDown"); assert.equal(active(), "beta.md", "a closed folder's rows are skipped")
  assert.equal(panel.querySelectorAll('[tabindex="0"]').length, 1, "still exactly one tab stop")
})

test("typing a letter jumps to the next name that starts with it, and Esc leaves the tree", async () => {
  const { panel, doc, k, active } = tree()
  const [alpha, beta] = panel.querySelectorAll('[role="treeitem"]')
  alpha.focus()
  await k(alpha, "g"); assert.equal(active(), "gamma.md")
  await k(doc.activeElement, "a"); assert.equal(active(), "gamma.md", "quick letters build one prefix (ga), which matches only gamma")
  await new Promise((r) => setTimeout(r, 850))
  await k(doc.activeElement, "a"); assert.equal(active(), "alpha", "a new letter starts again and wraps round")
  beta.focus()
  await k(beta, "Escape")
  assert.notEqual(doc.activeElement, beta)
})
