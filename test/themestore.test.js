import test from "node:test"
import assert from "node:assert/strict"
import { loadCustomThemes, saveCustomThemes, setSyncEnabled, syncEnabled, syncAvailable, watchCustomThemes, SYNC_PREFIX } from "../src/themestore.js"
import { validateTheme, themeToJson, addCustom } from "../src/themes.js"

function area(listeners, name) {
  const data = {}
  return {
    data,
    async get(keys) {
      if (keys === null) return { ...data }
      const out = {}
      for (const k of [].concat(keys)) if (k in data) out[k] = data[k]
      return out
    },
    async set(obj) { const changes = {}; for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: data[k], newValue: v }; data[k] = v } listeners.forEach((l) => l(changes, name)) },
    async remove(keys) { const changes = {}; for (const k of [].concat(keys)) { changes[k] = { oldValue: data[k] }; delete data[k] } listeners.forEach((l) => l(changes, name)) }
  }
}
function browser({ withSync = true } = {}) {
  const listeners = []
  const b = { storage: { local: area(listeners, "local"), onChanged: { addListener: (l) => listeners.push(l) } } }
  if (withSync) b.storage.sync = area(listeners, "sync")
  return b
}
const theme = (name, extra = {}) => validateTheme(JSON.stringify({ name, light: { bg: "#ffffff", text: "#111111", accent: "#0044cc", border: "#dddddd", codeBg: "#f4f4f4" }, dark: { bg: "#101010", text: "#eeeeee", accent: "#66aaff", border: "#333333", codeBg: "#1a1a1a", ...extra } })).theme

test("themes are kept locally by default, and nothing goes to sync", async () => {
  globalThis.chrome = browser()
  await saveCustomThemes([theme("A")])
  assert.deepEqual((await loadCustomThemes()).map((t) => t.label), ["A"])
  assert.deepEqual(Object.keys(await chrome.storage.sync.get(null)), [])
  assert.equal(await syncEnabled(), false)
})

test("turning sync on merges with what is already synced, and the synced copy wins", async () => {
  const b = browser()
  globalThis.chrome = b
  await b.storage.sync.set({ [SYNC_PREFIX + "custom-b"]: { ...theme("B"), light: { ...theme("B").light, bg: "#eeeeee" } } })
  await saveCustomThemes([theme("A"), theme("B")])
  const r = await setSyncEnabled(true)
  assert.deepEqual(r.skipped, [])
  const list = await loadCustomThemes()
  assert.deepEqual(list.map((t) => t.label).sort(), ["A", "B"])
  assert.equal(list.find((t) => t.label === "B").light.bg, "#eeeeee")
  assert.deepEqual(Object.keys(await b.storage.sync.get(null)).sort(), [SYNC_PREFIX + "custom-a", SYNC_PREFIX + "custom-b"])
})

test("with sync on, the synced list is the one that counts: a removal reaches another device", async () => {
  const b = browser()
  globalThis.chrome = b
  await saveCustomThemes([theme("A"), theme("B")])
  await setSyncEnabled(true)
  // another device deletes B from sync; this device still has B in its local copy
  await b.storage.sync.remove(SYNC_PREFIX + "custom-b")
  assert.deepEqual((await loadCustomThemes()).map((t) => t.label), ["A"])
  // removing here removes it from sync too
  await saveCustomThemes([])
  assert.deepEqual(Object.keys(await b.storage.sync.get(null)), [])
})

test("turning sync off goes back to the local copy and leaves sync alone", async () => {
  const b = browser()
  globalThis.chrome = b
  await saveCustomThemes([theme("A")])
  await setSyncEnabled(true)
  await setSyncEnabled(false)
  assert.equal(await syncEnabled(), false)
  assert.deepEqual((await loadCustomThemes()).map((t) => t.label), ["A"])
  assert.equal(Object.keys(await b.storage.sync.get(null)).length, 1)
})

test("the largest theme the validator allows still fits in a sync item", async () => {
  const mode = {}
  for (const k of ["bg", "text", "accent", "border", "codeBg", "note", "warning", "tip", "important", "caution", "comment", "punctuation", "number", "string", "operator", "keyword", "function", "regex"]) mode[k] = "rgba(" + "255, ".repeat(11) + "1)"
  Object.assign(mode, { fontBody: "a".repeat(120), fontCode: "b".repeat(120), fontHeading: "c".repeat(120), maxWidth: "9999px" })
  const r = validateTheme(JSON.stringify({ name: "x".repeat(40), light: mode, dark: mode }))
  assert.ok(r.ok, JSON.stringify(r.errors))
  const b = browser()
  globalThis.chrome = b
  await saveCustomThemes([])
  await setSyncEnabled(true)
  const out = await saveCustomThemes([r.theme])
  assert.deepEqual(out.skipped, [])
  assert.equal((await loadCustomThemes()).length, 1)
})

test("without a sync area, the local list is used and sync can't be turned on", async () => {
  globalThis.chrome = browser({ withSync: false })
  assert.equal(syncAvailable(), false)
  await saveCustomThemes([theme("A")])
  assert.deepEqual((await loadCustomThemes()).map((t) => t.label), ["A"])
})

test("watchers hear about changes from this device and from sync", async () => {
  const b = browser()
  globalThis.chrome = b
  const seen = []
  watchCustomThemes((list) => seen.push(list.length))
  await saveCustomThemes([theme("A")])
  await setSyncEnabled(true)
  await b.storage.sync.set({ [SYNC_PREFIX + "custom-c"]: theme("C") })
  await new Promise((r) => setTimeout(r, 20))
  assert.ok(seen.length >= 2)
  assert.equal(seen.at(-1), 2)
})

test("Copy JSON gives a file that uploads back as the same theme, and Edit with the same name replaces it", () => {
  const t = theme("Mine")
  const again = validateTheme(themeToJson(t))
  assert.ok(again.ok)
  assert.deepEqual(again.theme, t)
  const edited = validateTheme(themeToJson({ ...t, light: { ...t.light, bg: "#fafafa" } })).theme
  const r = addCustom([t], edited)
  assert.equal(r.list.length, 1)
  assert.equal(r.list[0].light.bg, "#fafafa")
})
