import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { cleanFolder, cleanFileName, downloadPath, DEFAULT_FOLDER } from "../src/savepath.js"
import { normalizeExport, describeExport, saveBlob } from "../src/exporter.js"

test("folder and file names are cleaned so nothing can leave the Downloads folder", () => {
  assert.equal(cleanFolder("notes/exports"), "notes/exports")
  assert.equal(cleanFolder("../../etc"), "etc")
  assert.equal(cleanFolder("/abs/../x"), "abs/x")
  assert.equal(cleanFolder("C:\\\\Users\\\\me"), "C/Users/me", "a drive letter loses its colon, backslashes split")
  assert.equal(cleanFolder("a/b/c/d/e"), "a/b/c", "three levels at most")
  assert.equal(cleanFolder('x<>:"|?*y'), "xy")
  assert.equal(cleanFolder("..."), "")
  assert.equal(cleanFolder(null), "")
  assert.equal(cleanFileName("../../evil.html"), "_.._evil.html")
  assert.equal(cleanFileName(""), "document")
  assert.equal(downloadPath("a.html", "downloads", "x"), "a.html")
  assert.equal(downloadPath("a.html", "folder", "my docs"), "my docs/a.html")
  assert.equal(downloadPath("a.html", "folder", "../.."), `${DEFAULT_FOLDER}/a.html`)
})

test("export settings carry a cleaned folder and describe it", () => {
  assert.equal(normalizeExport({ where: "folder", folder: "../x/y" }).folder, "x/y")
  assert.equal(normalizeExport({ where: "folder" }).folder, DEFAULT_FOLDER)
  assert.match(describeExport({ format: "html", where: "folder", folder: "exports" }).title, /saved to the "exports" folder inside Downloads/)
  assert.match(describeExport({ where: "ask" }).title, /wherever you choose/)
})

test("a folder or Save as export goes through the background; Downloads and failures use a plain download", async () => {
  const sent = []
  let reply = { ok: true }
  const clicks = []
  globalThis.chrome = { runtime: { sendMessage: async (m) => { sent.push(m); return reply } } }
  const realCreate = URL.createObjectURL
  URL.createObjectURL = () => "blob:x"
  const realClick = window.HTMLAnchorElement.prototype.click
  window.HTMLAnchorElement.prototype.click = function () { clicks.push(this.download) }
  const fmt = { label: "HTML", mime: "text/html" }
  const blob = new Blob(["<p>hi</p>"], { type: "text/html" })
  try {
    assert.equal(await saveBlob(blob, "a.html", { where: "folder", folder: "docs" }, fmt), "saved")
    assert.equal(sent[0].type, "mt-md-save"); assert.equal(sent[0].where, "folder"); assert.equal(sent[0].folder, "docs")
    assert.equal(Buffer.from(sent[0].base64, "base64").toString(), "<p>hi</p>")
    reply = { ok: false, cancelled: true }
    assert.equal(await saveBlob(blob, "a.html", { where: "ask" }, fmt), "cancelled")
    reply = undefined // no background answer: the page downloads it itself
    assert.equal(await saveBlob(blob, "a.html", { where: "ask" }, fmt), "downloaded-fallback")
    assert.deepEqual(clicks, ["a.html"])
    sent.length = 0
    assert.equal(await saveBlob(blob, "b.html", { where: "downloads" }, fmt), "downloaded")
    assert.equal(sent.length, 0, "the default never needs the extension")
  } finally {
    URL.createObjectURL = realCreate
    window.HTMLAnchorElement.prototype.click = realClick
    delete globalThis.chrome
  }
})

test("the background saves only what its own content scripts send, below Downloads", async () => {
  const handlers = []
  const handler = (...a) => { for (const h of handlers) { const r = h(...a); if (r) return r } return false }
  const noop = { addListener() {} }
  const downloads = []
  globalThis.chrome = {
    runtime: { id: "me", onMessage: { addListener: (f) => handlers.push(f) }, onInstalled: noop, onStartup: noop },
    permissions: { onAdded: noop, onRemoved: noop, getAll: async () => ({ origins: [] }) },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    tabs: { query: async () => [], reload: async () => {} },
    scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => {}, updateContentScripts: async () => {}, unregisterContentScripts: async () => {} },
    downloads: { download: async (o) => { downloads.push(o); if (o.filename.includes("cancel")) throw new Error("Download canceled by the user") } },
  }
  try {
    await import("../src/background.js?save")
    const ask = (msg, sender = { id: "me" }) => new Promise((resolve) => { if (!handler(msg, sender, resolve)) resolve(undefined) })
    const base = { type: "mt-md-save", name: "../../a.html", mime: "text/html;charset=utf-8", base64: "aGk=", where: "folder", folder: "../x" }
    assert.deepEqual(await ask(base), { ok: true })
    assert.equal(downloads[0].filename, "x/_.._a.html", "the folder and the name are both cleaned again")
    assert.equal(downloads[0].url, "data:text/html;charset=utf-8;base64,aGk=")
    assert.equal(downloads[0].saveAs, false)
    assert.deepEqual(await ask({ ...base, where: "ask" }), { ok: true }); assert.equal(downloads[1].saveAs, true)
    assert.deepEqual((await ask({ ...base, name: "cancel.html" })), { ok: false, cancelled: true, error: "Download canceled by the user" })
    assert.equal(await ask(base, { id: "evil" }), undefined, "other extensions are ignored")
    assert.equal((await ask({ ...base, base64: "<script>" })).ok, false, "not base64")
    assert.equal(downloads.length, 3)
  } finally {
    delete globalThis.chrome
  }
})
