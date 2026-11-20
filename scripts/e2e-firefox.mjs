// A real-Firefox check of the Firefox build (build/firefox), driven over WebDriver BiDi (no geckodriver needed).
//   npm run e2e:firefox        needs `firefox` (or FIREFOX=/path) and a prior `npm run package`
// It installs the unpacked build as a temporary add-on and checks rendering over http, the default toolbar, the Files panel,
// the theme cycle, Edit greyed out on a web page, and auto-reload. For file: pages it runs twice: with Firefox's default (the
// extensions.webextensions.fileSchemeAccess.requireOptIn preference is on, so no extension runs on a local file until the person opts
// in, and mt-md must leave the page alone), and with that preference off, which stands in for the opt-in having been given (local
// rendering, the folder listing, auto-reload through the background script, Edit). It can NOT check the popup, the set-up page or the
// opt-in switch itself: BiDi cannot open moz-extension: pages or click the add-ons page.
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const ext = path.join(root, "build/firefox")
if (!existsSync(path.join(ext, "manifest.json"))) throw new Error("build/firefox missing: run `npm run package` first")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, what, ms = 15000) {
  const end = Date.now() + ms
  for (;;) {
    try { const v = await fn(); if (v) return v } catch { /* keep trying */ }
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(150)
  }
}

const docs = mkdtempSync(path.join(tmpdir(), "mt-md-ff-docs-"))
mkdirSync(path.join(docs, "sub"))
writeFileSync(path.join(docs, "a.md"), "# Alpha\n\n## Part\n\ntext\n")
writeFileSync(path.join(docs, "b.md"), "# Beta\n")
writeFileSync(path.join(docs, "sub", "c.md"), "# Gamma\n")
const server = spawn(process.execPath, [path.join(root, "playground/serve.mjs"), "--port", "0", "--root", docs], { stdio: ["ignore", "pipe", "ignore"] })
const base = await new Promise((resolve, reject) => {
  let out = ""
  server.stdout.on("data", (d) => { out += d; const m = /over http : (http:\/\/127\.0\.0\.1:\d+)/.exec(out); if (m) resolve(m[1]) })
  setTimeout(() => reject(new Error("the document server did not start")), 5000)
})


const results = []
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  (${detail})` : ""}`) }

// auto-reload takes its baseline when it starts; make sure it has before the file is changed
async function settleWatcher(ev) {
  await until(() => ev("document.getElementById('mt-md-btn-autoreload').getAttribute('aria-pressed') === 'true'"), "auto-reload to be on")
  await sleep(2500)
}

async function withFirefox(prefs, fn) {
  const profile = mkdtempSync(path.join(tmpdir(), "mt-md-ff-profile-"))
  writeFileSync(path.join(profile, "user.js"), 'user_pref("remote.active-protocols", 1);\nuser_pref("extensions.autoDisableScopes", 0);\nuser_pref("datareporting.policy.dataSubmissionEnabled", false);\n' + Object.entries(prefs).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});\n`).join(""))
  const port = 9400 + Math.floor(Math.random() * 400)
  const firefox = spawn(process.env.FIREFOX || "firefox", ["--headless", "--no-remote", "--profile", profile, `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" })
  firefox.on("error", (e) => { console.error(`cannot start firefox: ${e.message}`); process.exit(2) })
  let ws
  try {
    ws = await until(async () => { const w = new WebSocket(`ws://127.0.0.1:${port}/session`); await new Promise((res, rej) => { w.onopen = res; w.onerror = rej }); return w }, "Firefox", 30000)
    let id = 0
    const pend = new Map()
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } }
    const call = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
    await call("session.new", { capabilities: {} })
    const installed = await call("webExtension.install", { extensionData: { type: "path", path: ext } })
    check("the unpacked Firefox build installs", installed.result?.extension === "mt-md@browser-ext", JSON.stringify(installed.error || installed.result))
    // a fresh install opens the set-up page in front; close it so the tab under test is visible (a hidden tab pauses auto-reload)
    const contexts = async () => (await call("browsingContext.getTree", {})).result.contexts
    await until(async () => (await contexts()).some((c) => /welcome\.html/.test(c.url)), "the set-up page to open on install", 10000)
    for (const c of await contexts()) if (/welcome\.html/.test(c.url)) await call("browsingContext.close", { context: c.context })
    const ctx = (await contexts())[0].context
    await call("browsingContext.activate", { context: ctx })
    const ev = async (expression) => (await call("script.evaluate", { expression, target: { context: ctx }, awaitPromise: true, resultOwnership: "none" })).result?.result?.value
    const go = (url) => call("browsingContext.navigate", { context: ctx, url, wait: "complete" })
    const open = async (url) => { await go(url); await until(() => ev("!!document.getElementById('mt-md-root')"), `mt-md to render ${url}`) }
    await fn({ ev, go, open, click: (selector) => ev(`document.querySelector(${JSON.stringify(selector)}).click()`) })
  } catch (err) {
    check("Firefox end-to-end run", false, err.message)
  } finally {
    try { ws?.close() } catch { /* closed */ }
    firefox.kill()
    await sleep(500)
    rmSync(profile, { recursive: true, force: true })
  }
}

try {
  await withFirefox({}, async ({ ev, go, open, click }) => {
    await open(`${base}/a.md`)
    check("a .md page over http renders in Firefox", (await ev("document.querySelector('.mt-md-article h1')?.textContent")) === "Alpha")
    check("the menu starts with theme, TOC and download, Settings last", (await ev("[...document.querySelectorAll('#mt-md-toolbar button')].filter(b=>!b.hidden).map(b=>b.id.replace('mt-md-btn-','')).join(',')")) === "theme,toc,bundle,settings")
    await until(() => ev("!!document.querySelector('.mt-md-files a')"), "the Files panel")
    check("the Files panel lists the server's folder (folders first, .md only)", (await ev("[...document.querySelectorAll('.mt-md-files-body > ul > li')].map(l=>l.textContent.trim()).join('|')")) === "sub|a.md|b.md")
    check("Edit is greyed out on a web page, with the reason", (await ev("document.getElementById('mt-md-btn-edit').disabled")) === true && /local files only/.test(await ev("document.getElementById('mt-md-btn-edit').title")))
    await click("#mt-md-btn-theme"); await sleep(300)
    check("the theme circle reaches dark after one click (it starts on system)", (await ev("document.documentElement.classList.contains('mt-md-dark')")) === true)
    check("the page asks for dark scrollbars in dark and light in light", (await ev("getComputedStyle(document.documentElement).colorScheme")) === "dark")
    await click("#mt-md-btn-theme"); await sleep(300)
    check("and back to light", (await ev("getComputedStyle(document.documentElement).colorScheme")) === "light")
    await settleWatcher(ev)
    writeFileSync(path.join(docs, "a.md"), "# Alpha changed\n\n## Part\n\ntext\n")
    await until(async () => (await ev("document.querySelector('.mt-md-article h1')?.textContent")) === "Alpha changed", "auto-reload", 8000).catch(() => {})
    check("auto-reload picks up a change to the file served from localhost", (await ev("document.querySelector('.mt-md-article h1')?.textContent")) === "Alpha changed")
    await open(`${base}/b.md#nothing`)
    check("a link with a #fragment that does not exist still renders the document", (await ev("document.querySelector('.mt-md-article h1')?.textContent")) === "Beta")
    // Firefox's default: a local file gets no extension code until the person opts in, so the page must simply stay plain text
    await go(pathToFileURL(path.join(docs, "b.md")).href)
    await sleep(2500)
    check("with Firefox's default (no opt-in for local files) a local .md stays plain text, and nothing breaks", (await ev("!!document.getElementById('mt-md-root')")) === false && /# Beta/.test(await ev("document.body.innerText")))
    check("(isAllowedFileSchemeAccess is not asked here; see the unit tests for the badge and set-up page logic)", true)
  })

  await withFirefox({ "extensions.webextensions.fileSchemeAccess.requireOptIn": false }, async ({ ev, open, click }) => {
    const fileUrl = (name) => pathToFileURL(path.join(docs, name)).href
    await open(fileUrl("b.md"))
    check("once local files are allowed, a file: .md renders in Firefox", (await ev("document.querySelector('.mt-md-article h1')?.textContent")) === "Beta")
    await until(() => ev("!!document.querySelector('.mt-md-files a')"), "the folder listing from the background script", 20000).catch(() => {})
    check("the Files panel lists the local folder (read by the background script)", (await ev("[...document.querySelectorAll('.mt-md-files-body > ul > li')].map(l=>l.textContent.trim()).join('|')")) === "sub|a.md|b.md")
    check("Edit is available on a local file", (await ev("document.getElementById('mt-md-btn-edit').disabled")) === false)
    await settleWatcher(ev)
    writeFileSync(path.join(docs, "b.md"), "# Beta changed\n")
    await until(async () => (await ev("document.querySelector('.mt-md-article h1')?.textContent")) === "Beta changed", "auto-reload of a local file", 10000).catch(() => {})
    check("auto-reload picks up a change to a local file (read by the background script)", (await ev("document.querySelector('.mt-md-article h1')?.textContent")) === "Beta changed")
  })
} finally {
  server.kill()
  rmSync(docs, { recursive: true, force: true })
}
console.log(`\n${results.filter(Boolean).length}/${results.length} Firefox checks passed`)
process.exit(results.every(Boolean) ? 0 : 1)
