import test from "node:test"
import assert from "node:assert/strict"
import { createAutoReload, readSource } from "../src/autoreload.js"
import { canAutoReload, decodeSource } from "../src/detect.js"

function harness(texts) {
  const doc = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} }
  const changes = []
  let i = 0
  const timers = []
  const watcher = createAutoReload({
    read: async () => { const t = texts[Math.min(i++, texts.length - 1)]; if (t instanceof Error) throw t; return t },
    onChange: (t) => changes.push(t),
    doc,
    setTimer: (fn) => { timers.push(fn); return timers.length },
    clearTimer: () => { timers.length = 0 },
  })
  return { watcher, changes, doc, timers }
}

test("the first read is a baseline; only a later difference fires, once", async () => {
  const { watcher, changes } = harness(["a", "a", "b", "b", "c"])
  assert.equal(await watcher.check(), false) // baseline
  assert.equal(await watcher.check(), false) // same
  assert.equal(await watcher.check(), true)  // a -> b
  assert.equal(await watcher.check(), false) // same
  assert.equal(await watcher.check(), true)  // b -> c
  assert.deepEqual(changes, ["b", "c"])
})

test("a failed read is ignored and the next one carries on", async () => {
  const { watcher, changes } = harness(["a", new Error("file briefly missing"), "b"])
  await watcher.check(); await watcher.check()
  assert.equal(await watcher.check(), true)
  assert.deepEqual(changes, ["b"])
})

test("a hidden tab is not polled", async () => {
  const { watcher, doc, changes } = harness(["a", "b"])
  await watcher.check()
  doc.visibilityState = "hidden"
  assert.equal(await watcher.check(), false)
  doc.visibilityState = "visible"
  assert.equal(await watcher.check(), true)
  assert.deepEqual(changes, ["b"])
})

test("start and stop manage one timer", () => {
  const { watcher, timers } = harness(["a"])
  assert.equal(watcher.running, false)
  watcher.start(); watcher.start()
  assert.equal(timers.length, 1)
  assert.equal(watcher.running, true)
  watcher.stop()
  assert.equal(watcher.running, false)
})

test("only file: documents and local servers are watched", () => {
  assert.equal(canAutoReload("file:///home/a/x.md"), true)
  assert.equal(canAutoReload("http://localhost:3000/x.md"), true)
  assert.equal(canAutoReload("http://127.0.0.1:8080/x.md"), true)
  assert.equal(canAutoReload("https://raw.githubusercontent.com/a/b/main/x.md"), false)
  assert.equal(canAutoReload("https://example.com/x.md"), false)
})

test("decodeSource handles a BOM and the trailing newline like the page text", () => {
  const bytes = new TextEncoder().encode("﻿# Café\n")
  assert.equal(decodeSource(bytes.buffer), "# Café")
})

test("readSource asks the background for file: URLs", async () => {
  const sent = []
  const api = { runtime: { sendMessage: async (m) => { sent.push(m); return { ok: true, text: "# hi" } } } }
  assert.equal(await readSource("file:///a/b.md", () => "", api), "# hi")
  assert.deepEqual(sent, [{ type: "mt-md-read", url: "file:///a/b.md" }])
  const bad = { runtime: { sendMessage: async () => ({ ok: false, error: "not allowed" }) } }
  await assert.rejects(readSource("file:///a/b.md", () => "", bad), /not allowed/)
})

test("the background only reads the sender's own .md file", async () => {
  const handlers = []
  const handler = (...args) => { for (const h of handlers) { const r = h(...args); if (r) return r } return false } // first listener that takes the message
  const noop = { addListener() {} }
  globalThis.chrome = {
    runtime: { id: "me", onMessage: { addListener: (fn) => handlers.push(fn) }, onInstalled: noop, onStartup: noop },
    permissions: { onAdded: noop, onRemoved: noop, getAll: async () => ({ origins: [] }) },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    tabs: { query: async () => [], reload: async () => {} },
    scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => {}, updateContentScripts: async () => {}, unregisterContentScripts: async () => {} },
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => ({ arrayBuffer: async () => new TextEncoder().encode("# disk\n").buffer })
  try {
    await import("../src/background.js")
    const ask = (msg, sender) => new Promise((resolve) => { const async_ = handler(msg, sender, resolve); if (!async_) return })
    const own = { id: "me", url: "file:///a/b.md" }
    assert.deepEqual(await ask({ type: "mt-md-read", url: "file:///a/b.md" }, own), { ok: true, text: "# disk" })
    assert.deepEqual(await ask({ type: "mt-md-read", url: "file:///a/b.md#top" }, own), { ok: true, text: "# disk" }, "hash ignored")
    assert.equal((await ask({ type: "mt-md-read", url: "file:///etc/passwd" }, { id: "me", url: "file:///etc/passwd" })).ok, false, "not .md")
    assert.equal((await ask({ type: "mt-md-read", url: "file:///a/other.md" }, own)).ok, false, "not the sender's page")
    assert.equal((await ask({ type: "mt-md-read", url: "http://x/y.md" }, { id: "me", url: "http://x/y.md" })).ok, false, "not file:")
    assert.equal(handler({ type: "mt-md-read", url: "file:///a/b.md" }, { id: "evil", url: "file:///a/b.md" }, () => {}), false, "other extensions ignored")
  } finally {
    globalThis.fetch = realFetch
    delete globalThis.chrome
  }
})

test("the background opens the set-up page on install and puts a ! on the button while local files are not allowed", async () => {
  const calls = { tabs: [], badge: [] }
  const installed = []
  const noop = { addListener() {} }
  globalThis.chrome = {
    runtime: { id: "me", getURL: (p) => `chrome-extension://me/${p}`, onMessage: { addListener() {} }, onInstalled: { addListener: (f) => installed.push(f) }, onStartup: noop },
    permissions: { onAdded: noop, onRemoved: noop, getAll: async () => ({ origins: [] }) },
    extension: { isAllowedFileSchemeAccess: async () => false },
    action: { setBadgeText: async (a) => calls.badge.push(a.text), setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    storage: { onChanged: noop, local: { get: async () => ({}) } },
    tabs: { query: async () => [], reload: async () => {}, create: async (a) => calls.tabs.push(a.url) },
    scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => {}, updateContentScripts: async () => {}, unregisterContentScripts: async () => {} },
  }
  try {
    await import("../src/background.js?badge")
    await new Promise((r) => setTimeout(r, 20))
    assert.ok(calls.badge.includes("!"), "badge shown while file access is off")
    installed.at(-1)({ reason: "install" })
    installed.at(-1)({ reason: "update" })
    assert.deepEqual(calls.tabs, ["chrome-extension://me/welcome.html"], "the set-up page opens on a fresh install only")
    await new Promise((r) => setTimeout(r, 20)) // let those finish before the setting changes
    globalThis.chrome.extension.isAllowedFileSchemeAccess = async () => true
    calls.badge.length = 0
    installed.at(-1)({ reason: "update" })
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(calls.badge.at(-1), "", "badge cleared once access is on")
  } finally {
    delete globalThis.chrome
  }
})

test("a file: page reads its own file directly when the browser allows it (Firefox), and asks the background when not (Chrome)", async () => {
  const realFetch = globalThis.fetch
  const asked = []
  const api = { runtime: { sendMessage: async (m) => { asked.push(m.type); return { ok: true, text: "# from background" } } } }
  try {
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode("# direct\n").buffer })
    assert.equal(await readSource("file:///a/b.md", decodeSource, api), "# direct")
    assert.deepEqual(asked, [])
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch") }
    assert.equal(await readSource("file:///a/b.md", decodeSource, api), "# from background")
    assert.deepEqual(asked, ["mt-md-read"])
  } finally {
    globalThis.fetch = realFetch
  }
})
