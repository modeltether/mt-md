import test from "node:test"
import assert from "node:assert/strict"

const asked = []
globalThis.chrome = { runtime: { sendMessage: async (m) => { asked.push(m); return globalThis.reply } } }
const { loadThemeOverride } = await import("../src/themeoverride.js")

test("a local page asks the background script for mt-md-theme.css and returns its text", async () => {
  globalThis.location = { protocol: "file:" }
  globalThis.reply = { ok: true, text: "h1{color:red}" }
  assert.equal(await loadThemeOverride(), "h1{color:red}")
  assert.deepEqual(asked, [{ type: "mt-md-theme-css" }])
})

test("a refused or failed request, or an http page, gives no override", async () => {
  globalThis.location = { protocol: "file:" }
  globalThis.reply = { ok: false, error: "not allowed" }
  assert.equal(await loadThemeOverride(), "")
  globalThis.chrome.runtime.sendMessage = async () => { throw new Error("no background") }
  assert.equal(await loadThemeOverride(), "")
  const before = asked.length
  globalThis.location = { protocol: "http:" }
  assert.equal(await loadThemeOverride(), "")
  assert.equal(asked.length, before)
})
