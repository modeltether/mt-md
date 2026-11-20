// End-to-end check in a real Chromium with the built extension loaded (build/chrome-store, so no signing key needed).
//   npm run e2e          (CHROMIUM=/path/to/chromium to override the binary; needs a prior `npm run package`)
// It covers what jsdom cannot: content-script injection, the charset-less http case, the real Bundle button with the
// real folder picker, and rendering of the bundled file. Exit code 0 = all passed.
//   E2E_HEADED=1 npm run e2e   opens a visible window, shows each result as a banner on the page and pauses between steps
import { spawn, execFileSync } from "node:child_process"
import { createServer } from "node:http"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkgRoot = root
const ext = path.join(root, "build/chrome-store")
const supportFile = path.join(root, "support.json")
const demoDir = path.join(root, "test/bundle-demo")
const chromium = process.env.CHROMIUM || "chromium"
const HEADED = !!process.env.E2E_HEADED
const BEAT = Number(process.env.E2E_BEAT_MS || 1800)
if (!existsSync(path.join(ext, "manifest.json"))) throw new Error("build/chrome-store missing: run `npm run package` first")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, what, ms = 15000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(100)
  }
}

// --- a minimal CDP client over Node's built-in WebSocket
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    const listeners = []
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && pending.has(d.id)) { const { ok, bad } = pending.get(d.id); pending.delete(d.id); d.error ? bad(new Error(JSON.stringify(d.error))) : ok(d.result ?? {}) }
      else if (d.method) listeners.forEach((l) => l(d))
    }
    ws.onopen = () => resolve({
      call: (method, params = {}) => new Promise((ok, bad) => { const i = ++id; pending.set(i, { ok, bad }); ws.send(JSON.stringify({ id: i, method, params })) }),
      on: (fn) => listeners.push(fn),
      close: () => ws.close(),
    })
    ws.onerror = () => reject(new Error(`cannot connect to ${url}`))
  })
}

// --- fixtures: a server that sends .md as text/plain with NO charset, like a careless host
const UTF8_DOC = "# Café … ok\n\nSmart “quotes” and an ellipsis …\n"
const filler = Array.from({ length: 90 }, (_, i) => `Paragraph ${i} of filler text so the page can scroll.\n`).join("\n")
const liveDoc = (title) => `# ${title}\n\n${filler}\n## End\n`
let LIVE = liveDoc("Live one")
// about 2 MB of ordinary markdown: headings, tables, code and lists
const BIG_DOC = Array.from({ length: 1500 }, (_, i) => `## Section ${i}\n\nParagraph ${i} with *emphasis*, **strong**, `+"`code`"+` and a [link](https://example.com/${i}).\n\n| a | b | c |\n|---|---|---|\n| ${i} | x | y |\n\n- item one\n- item two\n\n`+"```js\nconst n = ${i}\n```\n").join("\n")
const MATH_DOC = "# Math\n\nInline $E = mc^2$.\n\n$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\quad\\int_0^1 x\\,dx$$\n"
// a draw.io label that carries an image whose onerror handler would run in the page the moment maxGraph writes it
const HOSTILE_DRAWIO = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="&lt;img src=&quot;/missing.png&quot; onerror=&quot;window.__mtPwned=1&quot;&gt;hi" style="html=1" vertex="1" parent="1"><mxGeometry x="10" y="10" width="160" height="60" as="geometry"/></mxCell></root></mxGraphModel>'
const server = createServer((req, res) => {
  if (req.url === "/docs/") { // an autoindex, like Apache, nginx or python -m http.server
    res.writeHead(200, { "content-type": "text/html" })
    return res.end('<html><body><a href="?C=N;O=D">Name</a><a href="../">Parent</a><a href="one.md">one.md</a><a href="two.md">two.md</a><a href="deep/">deep/</a><a href="pic.png">pic.png</a></body></html>')
  }
  if (req.url.startsWith("/docs/")) { res.writeHead(200, { "content-type": "text/plain" }); return res.end("# Doc " + req.url.slice(6) + "\n\n## Part\n") }
  if (req.url.startsWith("/typed")) { res.writeHead(200, { "content-type": "text/markdown; charset=utf-8" }); return res.end("# Typed markdown\n\nServed as text/markdown.\n") }
  if (req.url.startsWith("/framehost")) { res.writeHead(200, { "content-type": "text/html" }); return res.end('<html><body><form><input name="x"></form><iframe id="g" src="/guide.md" style="width:420px;height:300px"></iframe></body></html>') }
  if (req.url.startsWith("/hostileinfographic")) { res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); return res.end("# Hostile infographic\n\n```infographic\ninfographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label <img src=\"/missing.png\" onerror=\"window.__mtPwned=1\">Step\n      desc <img src=\"/missing.png\" onerror=\"window.__mtPwned=1\">Open\n```\n") }
  if (req.url.startsWith("/hostiledrawio")) { res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); return res.end("# Hostile label\n\n```drawio\n" + HOSTILE_DRAWIO + "\n```\n") }
  if (req.url.startsWith("/guide")) { res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); return res.end("# Guide\n\nSee [the site](https://example.com/) and [the steps](#steps).\n\n## Steps\n\nDo it.\n") }
  if (req.url.startsWith("/big")) { res.writeHead(200, { "content-type": "text/plain" }); return res.end(BIG_DOC) }
  if (req.url.startsWith("/mathfence")) { res.writeHead(200, { "content-type": "text/plain" }); return res.end("# Fence\n\n```math\na^2+b^2=c^2\n```\n\nInline $`x^2`$ and $y$.\n") }
  res.writeHead(200, { "content-type": "text/plain" })
  res.end(Buffer.from(req.url.startsWith("/math") ? MATH_DOC : req.url.startsWith("/live") ? LIVE : UTF8_DOC, "utf8"))
}).listen(0, "127.0.0.1")
await new Promise((r) => server.once("listening", r))
const httpUrl = `http://127.0.0.1:${server.address().port}/plain.md`

// a small folder tree for the Files panel
const tree = mkdtempSync(path.join(tmpdir(), "mt-md-e2e-tree-"))
mkdirSync(path.join(tree, "sub"))
writeFileSync(path.join(tree, "a.md"), "# Alpha\n\n## First\n\ntext\n")
writeFileSync(path.join(tree, "b.md"), "# Beta\n")
writeFileSync(path.join(tree, "notes.txt"), "not markdown")
writeFileSync(path.join(tree, "sub", "c.md"), "# Gamma\n")

const otherDir = mkdtempSync(path.join(tmpdir(), "mt-md-e2e-other-")) // a folder outside the "only these folders" list
writeFileSync(path.join(otherDir, "z.md"), "# Zed\n")

// --- browser
const profile = mkdtempSync(path.join(tmpdir(), "mt-md-e2e-"))
const downloads = mkdtempSync(path.join(tmpdir(), "mt-md-e2e-dl-"))
const proc = spawn(chromium, [...(HEADED ? [] : ["--headless=new"]), "--no-sandbox", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" })
proc.on("error", (e) => { console.error(`cannot start ${chromium}: ${e.message}`); process.exit(2) })

const results = []
let showBanner = null
const check = async (name, ok, detail = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  (${detail})` : ""}`)
  if (HEADED) { await showBanner?.(`${ok ? "✔" : "✘"} ${name}`, ok).catch(() => {}); await sleep(BEAT) }
}

let browser, page
try {
  const port = (await until(() => existsSync(path.join(profile, "DevToolsActivePort")) && readFileSync(path.join(profile, "DevToolsActivePort"), "utf8"), "the browser")).split("\n")[0]
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
  browser = await connect(version.webSocketDebuggerUrl)
  await browser.call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads })
  // a fresh install opens the set-up page in front; close it so the tab under test is the visible one (a hidden tab pauses auto-reload)
  await until(async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).some((t) => /welcome\.html/.test(t.url)), "the set-up page to open on install", 10000)
  for (const t of (await (await fetch(`http://127.0.0.1:${port}/json`)).json())) if (t.type === "page" && /welcome\.html/.test(t.url)) await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`)
  // the closed set-up tab can linger in the list for a moment, so retry until a live page accepts the connection
  page = await until(async () => {
    const tab = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page" && !/welcome\.html/.test(t.url))
    return tab && (await connect(tab.webSocketDebuggerUrl))
  }, "a page to test in", 15000)
  const events = []
  page.on((e) => events.push(e))
  await page.call("Page.enable"); await page.call("Runtime.enable"); await page.call("DOM.enable"); await page.call("CSS.enable"); await page.call("Page.bringToFront")

  showBanner = (text, ok = true) => page.call("Runtime.evaluate", { expression: `(()=>{let b=document.getElementById('e2e-banner');if(!b){b=document.createElement('div');b.id='e2e-banner';b.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;border-radius:8px;font:600 15px system-ui;color:#fff;box-shadow:0 4px 18px #0006;max-width:80vw';document.documentElement.appendChild(b)}b.style.background=${JSON.stringify(ok)}?'#15803d':'#b91c1c';b.textContent=${JSON.stringify(text)}})()` })
  const ev = async (expression) => (await page.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value
  const open = async (url) => { await page.call("Page.navigate", { url }); await until(() => ev("!!document.getElementById('mt-md-root')"), `mt-md to render ${url}`) }
  const clickBundleLegacy = async () => {
    const [x, y] = await ev("(()=>{const r=document.getElementById('mt-md-btn-bundle').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
    await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: x - 4, y })
    await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
    for (const type of ["mousePressed", "mouseReleased"]) await page.call("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 })
  }
  const clickTool = async (id) => {
    const [x, y] = await ev(`(()=>{const r=document.getElementById('mt-md-btn-${id}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`)
    await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: x - 4, y })
    await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
    for (const type of ["mousePressed", "mouseReleased"]) await page.call("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 })
  }
  const headingNow = () => ev("document.querySelector('.mt-md-article h1')?.textContent")
  const toast = () => ev("document.getElementById('mt-md-toast')?.textContent || ''")

  // 1. a page with no charset must come out as UTF-8
  await open(httpUrl)
  const h1 = await ev("document.querySelector('.mt-md-article h1')?.textContent")
  const body = await ev("document.querySelector('.mt-md-article')?.textContent")
  await check("charset-less http .md is decoded as UTF-8", h1 === "Café … ok" && body.includes("“quotes”"), `h1=${JSON.stringify(h1)}`)
  const visibleTools = () => ev("[...document.querySelectorAll('#mt-md-toolbar button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.id.replace('mt-md-btn-','')).join(',')")
  await check("the menu starts with only theme, TOC and download, and Settings last", (await visibleTools()) === "theme,toc,bundle,settings", await visibleTools())

  // 1a. the theme starts on system, then cycles dark -> light -> system, turning so the active segment meets the dot
  const turn = () => ev("document.querySelector('#mt-md-btn-theme .mt-md-theme-svg').style.transform")
  const isDark = () => ev("document.documentElement.classList.contains('mt-md-dark')")
  await check("the theme starts on system (follows the browser, light here), the circle turned to the dot", (await turn()) === "rotate(240deg)" && /system/.test(await ev("document.getElementById('mt-md-btn-theme').title")) && !(await isDark()), await turn())
  await clickTool("theme"); await sleep(200)
  await check("next is dark, turning forward", (await turn()) === "rotate(360deg)" && (await isDark()), await turn())
  const scheme = () => ev("getComputedStyle(document.documentElement).colorScheme")
  await check("dark theme asks for dark scrollbars and controls", (await scheme()) === "dark", await scheme())
  await open(httpUrl)
  await check("the theme choice survives a reload, with the circle already turned", (await isDark()) && (await turn()) === "rotate(0deg)", await turn())
  await clickTool("theme"); await sleep(200)
  await check("then light", (await turn()) === "rotate(120deg)" && !(await isDark()), await turn())
  await check("light theme asks for light scrollbars and controls (the raw-text page's own dark/light hint is overridden)", (await scheme()) === "light", await scheme())

  // 1a'. the settings page: use a tool, and keep more tools on the menu
  await clickTool("settings"); await sleep(150)
  await check("Settings opens a list of every tool with a Menu column of boxes", (await ev("document.querySelectorAll('#mt-md-settings .mt-md-settings-row').length")) === 8 && (await ev("document.querySelectorAll('#mt-md-settings .mt-md-settings-row input:checked').length")) === 3)
  const offCentre = await ev("(()=>{const c=r=>r.x+r.width/2;const h=c(document.querySelector('#mt-md-settings .mt-md-settings-cols').getBoundingClientRect());return Math.max(...[...document.querySelectorAll('#mt-md-settings input[type=checkbox]')].map(i=>Math.abs(c(i.getBoundingClientRect())-h)))})()")
  const subRatio = await ev("(()=>{const e=document.querySelector('#mt-md-settings .mt-md-settings-sub');return e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).fontSize)})()")
  await check("the Settings subtitle fits on one line", subRatio > 0 && subRatio < 1.9, `height is ${subRatio} font sizes`)
  await check("every Menu checkbox is centred under the Menu heading", offCentre < 2, `off by ${offCentre}px`)
  await ev("document.querySelector('#mt-md-settings [data-mt-row=raw]').click()")
  await check("a tool can be used from the settings page without being on the menu", (await ev("!document.querySelector('.mt-md-raw-view').hidden")) === true)
  await ev("document.querySelector('#mt-md-settings [data-mt-row=raw]').click()")
  await ev("document.querySelector('#mt-md-settings [data-mt-row=autoreload]').closest('.mt-md-settings-row').querySelector('input').click()")
  await sleep(200)
  await check("ticking a tool's Menu box puts the tool on the toolbar, above Settings", (await visibleTools()) === "theme,toc,autoreload,bundle,settings", await visibleTools())
  await ev("document.getElementById('mt-md-btn-settings').click()")
  await open(httpUrl)
  await check("the choice is remembered after a reload", (await visibleTools()) === "theme,toc,autoreload,bundle,settings", await visibleTools())

  // 1b. equations use the bundled math font, not whatever the system happens to have
  await open(httpUrl.replace("plain.md", "math.md"))
  await until(() => ev("!!document.querySelector('.mt-md-math math')"), "the equations")
  await until(() => ev("document.fonts.check('16px \"MT Math\"')"), "the math font to load").catch(() => {})
  await sleep(300)
  const root = await page.call("DOM.getDocument", { depth: -1 })
  const used = []
  for (const sel of ["math mi", "math mo", "math mn"]) {
    const q = await page.call("DOM.querySelector", { nodeId: root.root.nodeId, selector: sel })
    const r = await page.call("CSS.getPlatformFontsForNode", { nodeId: q.nodeId })
    used.push(...r.fonts.map((f) => f.familyName))
  }
  await check("equations render with the bundled STIX Two Math", used.length > 0 && used.every((n) => /STIX Two Math|MT Math/i.test(n)), used.join(", "))

  // 1c. auto-reload: a local dev server, then a file: document (read by the background script), then pause and resume
  const liveTitle = async (want, what) => until(async () => (await headingNow()) === want, what, 10000)
  await open(httpUrl.replace("plain.md", "live.md"))
  await check("auto-reload is on by default for a local server", (await ev("document.getElementById('mt-md-btn-autoreload').getAttribute('aria-pressed')")) === "true")
  await ev("window.scrollTo(0, 600)"); await sleep(300)
  LIVE = liveDoc("Live two")
  await liveTitle("Live two", "the local page to reload").then(() => check("local server page re-renders when the file changes", true)).catch(() => check("local server page re-renders when the file changes", false, `h1=${"stale"}`))
  const keptY = await ev("Math.round(window.scrollY)")
  await check("scroll position survives a reload", Math.abs(keptY - 600) < 60, `scrollY=${keptY}`)

  await clickTool("autoreload"); await sleep(200)
  await check("the button pauses auto-reload", (await ev("document.getElementById('mt-md-btn-autoreload').getAttribute('aria-pressed')")) === "false")
  LIVE = liveDoc("Live three"); await sleep(3000)
  await check("a paused page does not reload", (await headingNow()) === "Live two")
  await clickTool("autoreload")
  await liveTitle("Live three", "the resumed page to catch up").then(() => check("resuming picks up the change made while paused", true)).catch(() => check("resuming picks up the change made while paused", false))

  const fileDoc = path.join(downloads, "live-file.md")
  writeFileSync(fileDoc, liveDoc("File one"))
  await open(pathToFileURL(fileDoc).href)
  await sleep(1500)
  writeFileSync(fileDoc, liveDoc("File two"))
  await liveTitle("File two", "the file: page to reload").then(() => check("a file: document re-renders when it is saved", true)).catch(() => check("a file: document re-renders when it is saved", false))
  rmSync(fileDoc, { force: true })

  // 1d. site access: a host that is neither file: nor localhost is not rendered until the person allows it
  const remoteUrl = `http://test.localhost:${server.address().port}/live.md`
  await page.call("Page.navigate", { url: remoteUrl }); await sleep(3000)
  await check("a non-local site is left raw until it is allowed", !(await ev("!!document.getElementById('mt-md-root')")) && (await ev("document.body.innerText")).includes("# Live"))

  // 1e. the toolbar popup, shown for a pretend active tab (a headless browser has no toolbar to click)
  const extId = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "service_worker")?.url.split("/")[2]
  const stub = (url, extra = "") => `${extra}chrome.tabs.query = async () => [{ id: 1, url: ${JSON.stringify(url)} }]`
  const popupFor = async (url, extra = "") => {
    const { identifier } = await page.call("Page.addScriptToEvaluateOnNewDocument", { source: stub(url, extra) })
    await page.call("Page.navigate", { url: `chrome-extension://${extId}/popup.html` })
    await until(() => ev("document.getElementById('view').children.length > 0"), "the popup")
    const text = await ev("document.body.innerText")
    await page.call("Page.removeScriptToEvaluateOnNewDocument", { identifier })
    return text
  }
  const allowText = await popupFor("https://docs.example.org/guide/readme.md")
  await check("popup offers Allow this site, Allow all sites and Render once on a remote .md page", /Allow this site/.test(allowText) && /Allow all sites/.test(allowText) && /Render once/.test(allowText) && /docs\.example\.org/.test(allowText), allowText.slice(0, 80))
  const localText = await popupFor("file:///home/a/x.md")
  await check("popup lists the built-in local pages as always on", /where mt-md works/i.test(allowText) && /Files on this computer/.test(allowText) && /localhost, 127\.0\.0\.1/.test(allowText) && /always on/.test(allowText), allowText.slice(-200))
  await check("the popup uses the viewer's theme system and the same Local files / Websites sections as the set-up page, with Themes last", await ev("(()=>{const h=[...document.querySelectorAll('main > section > h2, main > details > summary')].map(e=>e.textContent.replace(/\\s+/g,' ').trim().split(' ')[0]);return !!document.getElementById('mt-md-styles') && document.documentElement.classList.contains('mt-md-dark')===matchMedia('(prefers-color-scheme: dark)').matches && h.join(',')==='This,Local,Websites,Themes:'})()"))
  const popupVer = await ev("document.getElementById('ver').textContent")
  const manifestVer = JSON.parse(readFileSync(path.join(ext, "manifest.json"), "utf8")).version
  const iconPx = await ev("document.querySelector('h1 img').getBoundingClientRect().width")
  await check("the popup shows a large icon and the manifest's version after the name", popupVer === `v${manifestVer}` && iconPx >= 40 && (await ev("document.querySelector('h1').textContent.replace(/\\s+/g,' ').trim()")) === `mt-md ${popupVer}`, `${popupVer} ${manifestVer} ${iconPx}px`)
  await check("popup says local pages always work, and still offers Allow all sites", /always work/.test(localText) && /Allow all sites/.test(localText))
  const supportCfg = JSON.parse(readFileSync(supportFile, "utf8"))
  await check("the popup has one Feedback link to the issue page, with a tooltip that names where it goes", await ev("(async()=>{await new Promise(r=>setTimeout(r,300));const a=document.getElementById('feedback');return !a.hidden&&a.textContent==='Feedback'&&!document.getElementById('feedback-email')&&/\\/issues\\/new\\?/.test(a.href)&&a.target==='_blank'&&/issue page/.test(a.title)&&a.title.includes(new URL(a.href).host)})()"))
  // custom themes from the popup: paste, list, then remove
  const themeJson = JSON.stringify({ name: "E2E theme", light: { bg: "#fafafa", text: "#111111", accent: "#0044cc", border: "#dddddd", codeBg: "#f0f0f0" }, dark: { bg: "#101010", text: "#eeeeee", accent: "#66aaff", border: "#333333", codeBg: "#1a1a1a" } })
  await ev(`(()=>{const t=document.getElementById('paste');t.value=${JSON.stringify(themeJson)};document.getElementById('addtheme').click()})()`)
  await until(async () => /Added "E2E theme"/.test(await ev("document.getElementById('msg').textContent")), "the theme to be added")
  await check("a pasted theme is added and listed in the popup", /E2E theme/.test(await ev("document.getElementById('customlist').textContent")))
  await check("each custom theme has Edit, Copy JSON and Remove", (await ev("[...document.querySelectorAll('#customlist li button')].map(b=>b.textContent).join(',')")) === "Edit,Copy JSON,Remove")
  await ev("document.querySelector('#customlist li button').click()")
  await check("Edit puts the theme's JSON back in the box, ready to change", /"name": "E2E theme"/.test(await ev("document.getElementById('paste').value")) && (await ev("document.getElementById('themes').open")) === true)
  await ev("document.getElementById('paste').value=''")
  await check("the sync option is offered, and switching it on puts the themes in the browser's synced storage", await (async () => {
    if (await ev("document.getElementById('syncrow').hidden")) return false
    await ev("(()=>{const c=document.getElementById('sync');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))})()")
    await sleep(500)
    return /custom-e2e-theme/.test(await ev("chrome.storage.sync.get(null).then(d=>Object.keys(d).join(','))"))
  })())
  await ev("(()=>{const c=document.getElementById('sync');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}))})()")
  await sleep(300)
  await ev("document.getElementById('paste').value='{\"name\":\"x\",\"light\":{\"bg\":\"url(x)\"}}';document.getElementById('addtheme').click()")
  await until(async () => /Not added/.test(await ev("document.getElementById('msg').textContent")), "the refusal")
  await check("a theme with anything but colours is refused with a reason", /not an allowed colour/.test(await ev("document.getElementById('msg').textContent")))
  await check("Copy prompt is offered", await ev("!!document.getElementById('copyprompt')"))
  await check("popup explains what to do on other pages", /click here to allow that site/.test(await popupFor("https://example.com/index.html")))

  // 2. the demo on file://: images render, Bundle asks for the folder, then bundles
  await open(pathToFileURL(path.join(demoDir, "bundle-demo.md")).href)
  await check("demo renders with 6 loaded images (the SVG appears twice) and one broken link", (await ev("[...document.querySelectorAll('.mt-md-article img')].filter(i=>i.naturalWidth>0).length")) === 6)
  await page.call("Page.setInterceptFileChooserDialog", { enabled: true })
  await clickTool('bundle')
  await until(async () => /choose the folder/.test(await toast()), "the folder prompt")
  await check("first click on file:// asks for the folder", true)
  await clickTool('bundle')
  const chooser = await until(() => events.find((e) => e.method === "Page.fileChooserOpened"), "the folder picker")
  await page.call("DOM.setFileInputFiles", { files: [demoDir], backendNodeId: chooser.params.backendNodeId })
  const done = await until(async () => /^Bundled/.test(await toast()) && (await toast()), "the bundle toast")
  await check("toast reports 5 images bundled, 1 left as a link", /Bundled 5 images/.test(done) && /1 left as links/.test(done), done)
  const file = await until(() => readdirSync(downloads).find((f) => f === "bundle-demo.bundle.md"), "the downloaded file")
  await sleep(300)
  const bundled = readFileSync(path.join(downloads, file), "utf8")
  const defs = bundled.split("\n").filter((l) => /^\[[^\]]+\]: data:image\//.test(l))
  await check("bundle has 5 data-URI definitions, each its own paragraph", defs.length === 5 && !/data:image[^\n]*\n\[/.test(bundled))
  await check("bundle keeps code fences, inline code and the missing link as written",
    bundled.includes("![not bundled](img/one.png)") && bundled.includes("`![not bundled either](img/two photo.jpg)`") && bundled.includes("![does not exist](img/missing.png)"))
  await check("bundle ends with the LLM comment before the payload", bundled.indexOf("<!-- mt-md bundle") > bundled.indexOf("does not exist") && bundled.indexOf("<!-- mt-md bundle") < bundled.indexOf("data:image/"))

  // 2a. Edit: only on file: pages; it hands the editor's link to the browser
  await open(pathToFileURL(path.join(tree, "a.md")).href)
  await clickTool("settings"); await sleep(150)
  await check("a file: page's settings list eight tools, and the editor is VS Code by default", (await ev("document.querySelectorAll('#mt-md-settings .mt-md-settings-row').length")) === 8 && (await ev("document.getElementById('mt-md-editor-select').value")) === "vscode")
  const isShown = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});return !!e && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0})()`)
  await check("the editor choice is tucked away until the Edit row's gear is pressed", !(await isShown("#mt-md-editor-select")))
  await ev("document.getElementById('mt-md-editor-gear').click()"); await sleep(100)
  await check("the gear reveals the editor list just under the Edit row, VS Code chosen, no custom box", (await isShown("#mt-md-editor-select")) && !(await isShown("#mt-md-editor-custom")) && (await ev("document.getElementById('mt-md-editor-gear').closest('.mt-md-settings-row').nextElementSibling.contains(document.getElementById('mt-md-editor-select'))")))
  await ev("(()=>{const s=document.getElementById('mt-md-editor-select');s.value='custom';s.dispatchEvent(new Event('change'))})()"); await sleep(100)
  await check("the custom link box appears only when Custom is chosen", await isShown("#mt-md-editor-custom"))
  await ev("(()=>{const s=document.getElementById('mt-md-editor-select');s.value='vscode';s.dispatchEvent(new Event('change'))})()"); await sleep(100)
  await check("and goes away again for a named editor", !(await isShown("#mt-md-editor-custom")))
  await ev("document.querySelector('#mt-md-settings [data-mt-row=edit]').closest('.mt-md-settings-row').querySelector('input').click()")
  await sleep(150)
  await ev("document.getElementById('mt-md-btn-settings').click()")
  const navs = []
  page.on((e) => { if (e.method === "Page.frameRequestedNavigation") navs.push(e.params.url) })
  await clickTool("edit")
  await sleep(600)
  await check("Edit hands vscode://file/<path> to the browser", navs.some((u) => u === "vscode://file" + pathToFileURL(path.join(tree, "a.md")).pathname), navs.join(" "))
  await check("and says so", /Opening in VS Code/.test(await toast()), await toast())
  // theme styles: the gear next to Theme picks one, and it changes the page's colours
  const bgVar = () => ev("getComputedStyle(document.documentElement).getPropertyValue('--mt-color-bg').trim()")
  const bgBefore = await bgVar()
  await ev("document.getElementById('mt-md-btn-settings').click()")
  await sleep(150)
  await ev("document.getElementById('mt-md-theme-gear').click()")
  await check("the Theme row has a gear that reveals the style list, with the bundled styles and the uploaded one", (await ev("[...document.querySelectorAll('#mt-md-style-select option')].map(o=>o.value).join(',')")) .includes("catppuccin") && (await ev("document.getElementById('mt-md-style-select').closest('.mt-md-settings-editor').hidden")) === false, await ev("[...document.querySelectorAll('#mt-md-style-select option')].map(o=>o.value).join(',')"))
  await ev("(()=>{const s=document.getElementById('mt-md-style-select');s.value='solarized';s.dispatchEvent(new Event('change',{bubbles:true}))})()")
  await sleep(200)
  const bgSol = await bgVar()
  await check("choosing Solarized changes the page colours", bgSol !== bgBefore && /^#(fdf6e3|002b36)$/i.test(bgSol), `${bgBefore} -> ${bgSol}`)
  await ev("(()=>{const s=document.getElementById('mt-md-style-select');s.value='default';s.dispatchEvent(new Event('change',{bubbles:true}))})()")
  await sleep(200)
  await check("and choosing the default puts them back", (await bgVar()) === bgBefore, await bgVar())
  await ev("document.getElementById('mt-md-btn-settings').click()")
  await sleep(150)

  // 2a'. first-run set-up: local-file access (live), how to allow it, and "only these folders"
  const welcomeUrl = `chrome-extension://${extId}/welcome.html`
  const withStub = async (source, fn) => {
    const { identifier } = await page.call("Page.addScriptToEvaluateOnNewDocument", { source })
    try { return await fn() } finally { await page.call("Page.removeScriptToEvaluateOnNewDocument", { identifier }) }
  }
  await page.call("Page.navigate", { url: welcomeUrl })
  await until(() => ev("document.getElementById('status').textContent.length > 0"), "the set-up page")
  await check("the set-up page shows local files as allowed when the browser allows them, with the version", (await ev("document.getElementById('status').textContent")) === "allowed ✓" && (await ev("!document.getElementById('done').hidden && document.getElementById('fix').hidden")) && /^v\d/.test(await ev("document.getElementById('ver').textContent")))
  await check("the set-up page is a rendered document in the viewer's own style (built from welcome.md)", (await ev("!!document.querySelector('#mt-md-root .mt-md-article h2') && getComputedStyle(document.getElementById('mt-md-root')).fontSize==='16px' && !!document.getElementById('mt-md-styles')")))
  await check("the set-up page ends with a note that the extension was written by AI", /written by AI/.test(await ev("document.querySelector('.disclaimer')?.textContent || ''")))
  await check("the set-up page follows the saved theme (system here, so it matches the browser)", (await ev("document.documentElement.classList.contains('mt-md-dark') === matchMedia('(prefers-color-scheme: dark)').matches")))
  await withStub("chrome.extension.isAllowedFileSchemeAccess = async () => false", async () => {
    await page.call("Page.navigate", { url: welcomeUrl })
    await until(() => ev("document.getElementById('status').textContent.length > 0"), "the set-up page, access off")
    const steps = await ev("document.getElementById('steps').textContent")
    await check("without access the set-up page says so, gives the steps and a button to the settings page", (await ev("document.getElementById('status').textContent")) === "not allowed yet" && /Allow access to file URLs/.test(steps) && (await ev("!document.getElementById('open-settings').hidden")), steps)
    const popupNo = await popupFor("file:///home/a/x.md", "chrome.extension.isAllowedFileSchemeAccess = async () => false;")
    await check("and the popup on a local page explains the same, instead of saying local files always work", /can't read local files yet/.test(popupNo) && /Allow access to file URLs/.test(popupNo) && /Open settings/.test(popupNo) && !/always work/.test(popupNo), popupNo.slice(0, 160))
  })
  await page.call("Page.navigate", { url: welcomeUrl })
  await until(() => ev("document.getElementById('status').textContent.length > 0"), "the set-up page again")
  await ev(`(()=>{document.querySelector('input[name=mode][value=only]').click();document.getElementById('list').value=${JSON.stringify(tree)}+'\\n~/nope';document.getElementById('save').click()})()`)
  await until(() => ev("/Saved/.test(document.getElementById('foldermsg').textContent)"), "the folder list to save")
  await check("a folder list saves, and a line the browser can't use (~) is reported", /Saved: 1 folder/.test(await ev("document.getElementById('foldermsg').textContent")) && /~\/nope/.test(await ev("document.getElementById('foldermsg').textContent")))
  await open(pathToFileURL(path.join(tree, "a.md")).href)
  await check("a local file inside a chosen folder renders", (await headingNow()) === "Alpha")
  await page.call("Page.navigate", { url: pathToFileURL(path.join(otherDir, "z.md")).href })
  await sleep(2500)
  await check("a local file outside the chosen folders stays plain text", (await ev("!!document.getElementById('mt-md-root')")) === false && /# Zed/.test(await ev("document.body.innerText")))
  const popupOut = await popupFor(pathToFileURL(path.join(otherDir, "z.md")).href)
  await check("the popup offers to add that folder or render once", /isn't on your list/.test(popupOut) && /Add this folder/.test(popupOut) && /Render once/.test(popupOut), popupOut.slice(0, 200))
  await page.call("Page.navigate", { url: welcomeUrl })
  await until(() => ev("document.getElementById('status').textContent.length > 0"), "the set-up page, to undo")
  await ev("(()=>{document.querySelector('input[name=mode][value=all]').click();document.getElementById('save').click()})()")
  await until(() => ev("/every local/.test(document.getElementById('foldermsg').textContent)"), "the list to clear")
  await page.call("Page.navigate", { url: pathToFileURL(path.join(otherDir, "z.md")).href })
  await until(() => ev("!!document.getElementById('mt-md-root')"), "the file to render once the list is cleared")
  await check("choosing every local file again renders it", (await headingNow()) === "Zed")

  // 2b. the Files panel: the document's folder, above the contents
  await open(pathToFileURL(path.join(tree, "a.md")).href)
  await until(() => ev("!!document.querySelector('.mt-md-files a')"), "the Files panel")
  const names = await ev("[...document.querySelectorAll('.mt-md-files-body > ul > li')].map(li=>li.textContent.trim()).join('|')")
  await check("Files lists the folder: sub-folder first, then the .md files, no other types", names === "sub|a.md|b.md", names)
  await check("the open document is marked as current", (await ev("document.querySelector('.mt-md-files a.mt-md-current')?.textContent")) === "a.md")
  const stacked = await ev("(()=>{const f=document.querySelector('.mt-md-files').getBoundingClientRect(),t=document.querySelector('#mt-md-toc > ul').getBoundingClientRect();return f.bottom<=t.top+1&&t.height>0})()")
  await check("Files sits above the contents, and both are visible", stacked === true)
  await ev("document.querySelector('.mt-md-folder').click()")
  await until(() => ev("!!document.querySelector('.mt-md-files-sub a')"), "the sub-folder to open")
  await check("opening a folder lists its .md files in place", (await ev("document.querySelector('.mt-md-files-sub a')?.textContent")) === "c.md")
  await ev("[...document.querySelectorAll('.mt-md-files-body > ul > li > a')].find(a=>a.textContent==='b.md').click()")
  await until(async () => (await headingNow()) === "Beta", "the next document")
  await check("clicking a file opens it, rendered", true)
  await until(() => ev("!!document.querySelector('.mt-md-files-sub a')"), "the open folder to come back")
  await check("reading another document keeps the folders that were open", (await ev("document.querySelector('.mt-md-files-sub a')?.textContent")) === "c.md")
  await check("the top folder shows its full path as hover text", (await ev("document.querySelector('.mt-md-files-path').title")) === tree.replace(/\\/g, "/") + "/")
  await until(() => ev("!!document.querySelector('.mt-md-files-back') && !document.querySelector('.mt-md-files-back').disabled"), "Back to be offered")
  await check("Back is offered and names the document read before", /a\.md/.test(await ev("document.querySelector('.mt-md-files-back').title")))
  await ev("document.querySelector('.mt-md-files-back').click()")
  await until(async () => (await headingNow()) === "Alpha", "Back to the earlier document")
  await check("Back returns to the earlier document", true)
  await until(() => ev("!!document.querySelector('.mt-md-files a')"), "the panel again")
  await ev("document.querySelector('.mt-md-files-up').click()")
  const treeName = path.basename(tree)
  await until(async () => (await ev("document.querySelector('.mt-md-files-path').textContent")) === path.basename(path.dirname(tree)), "the parent folder")
  const parentList = await ev("[...document.querySelectorAll('.mt-md-files-body > ul > li > .mt-md-folder')].map(b=>b.textContent.trim())")
  await check("Up lists the parent folder in place, with the folder we came from", parentList.includes(treeName), parentList.join("|"))
  await open(pathToFileURL(path.join(tree, "sub", "c.md")).href)
  await until(() => ev("!!document.querySelector('.mt-md-files a')"), "the sub-folder's own panel")
  await until(() => ev("!!document.querySelector('.mt-md-files a.mt-md-current')"), "the current file to show in the tree")
  await check("a document in a sub-folder keeps the tree and marks itself, with its folder open", (await ev("document.querySelector('.mt-md-files a.mt-md-current')?.textContent")) === "c.md")
  await open(httpUrl.replace("plain.md", "docs/one.md"))
  await until(() => ev("!!document.querySelector('.mt-md-files a')"), "the autoindex panel")
  const idx = await ev("[...document.querySelectorAll('.mt-md-files-body > ul > li')].map(li=>li.textContent.trim()).join('|')")
  await check("an http autoindex is listed too (folders and .md only)", idx === "deep|one.md|two.md", idx)
  await open(httpUrl)
  await sleep(600)
  await check("a page whose folder has no listing shows no Files section", (await ev("document.querySelector('.mt-md-files')")) === null)

  const bl = bundled.split("\n")
  const nm = /ends at line (\d+)\. Lines (\d+) to (\d+) are base64/.exec(bl.find((l) => l.startsWith("<!-- mt-md note:")) || "")
  const [endsAt, fromLn, toLn] = nm ? nm.slice(1).map(Number) : [0, 0, 0]
  await check("the note near the top gives the right lines: text end, payload start, payload end",
    !!nm && bl[endsAt - 1]?.trim() !== "" && bl.slice(endsAt, fromLn - 1).every((l) => !l.trim()) && bl[fromLn - 1]?.startsWith("<!-- mt-md bundle:") && /^\[[^\]]+\]: data:image\//.test(bl[toLn - 1] || "") && !bl.slice(toLn).join("").trim(),
    `${endsAt}/${fromLn}/${toLn} of ${bl.length}`)

  // 2c. the playground: every document renders over file:// and over http, and only file:// has Edit
  const pg = spawn(process.execPath, [path.join(pkgRoot, "playground/serve.mjs"), "--port", "0"], { stdio: ["ignore", "pipe", "ignore"] })
  const pgBase = await new Promise((resolve, reject) => {
    let out = ""
    pg.stdout.on("data", (d) => { out += d; const m = /over http : (http:\/\/127\.0\.0\.1:\d+)/.exec(out); if (m) resolve(m[1]) })
    setTimeout(() => reject(new Error("playground server did not start")), 5000)
  })
  try {
    const pgDocs = path.join(pkgRoot, "playground/docs")
    const names = ["README.md", "01-basics.md", "02-code.md", "03-callouts-details.md", "04-math.md", "05-diagrams.md", "06-frontmatter.md", "07-unicode.md", "08-images.md", "09-long-document.md", "guides/getting-started.md", "themed/themed.md", "odd names/ünïcode & spaces.md"]
    const probe = "JSON.stringify({h1:!!document.querySelector('.mt-md-article h1'),diagrams:document.querySelectorAll('.mt-md-diagram svg').length,errors:document.querySelectorAll('.mt-md-diagram-error').length,math:document.querySelectorAll('.mt-md-math math').length,edit:!!document.getElementById('mt-md-btn-edit'),editOff:!!document.getElementById('mt-md-btn-edit')?.disabled,editHint:document.getElementById('mt-md-btn-edit')?.title||''})"
    const bad = []
    for (const name of names) {
      for (const [kind, url] of [["file", pathToFileURL(path.join(pgDocs, name)).href], ["http", `${pgBase}/${name.split("/").map(encodeURIComponent).join("/")}`]]) {
        await open(url)
        if (name === "05-diagrams.md") await until(async () => JSON.parse(await ev(probe)).diagrams >= 4, `${kind} diagrams`, 20000).catch(() => {})
        const r = JSON.parse(await ev(probe))
        if (!r.h1 || r.errors || (name === "05-diagrams.md" && r.diagrams < 4) || (name === "04-math.md" && !r.math) || !r.edit || r.editOff !== (kind === "http") || (kind === "http" && !/local files only/.test(r.editHint))) bad.push(`${kind} ${name} ${JSON.stringify(r)}`)
      }
    }
    await check("all 13 playground documents render over file:// and http, diagrams and math included, Edit enabled on file:// and greyed out with a reason on http", bad.length === 0, bad.join(" | "))
    // the render showcase: every page opens, and each diagram page draws what it promises (the deliberate mistakes show errors)
    const want = { "text.md": [0, 0], "code.md": [0, 0], "callouts.md": [0, 0], "math.md": [0, 0], "mermaid.md": [7, 1], "mindmap.md": [2, 0], "graphviz.md": [2, 0], "vega.md": [3, 1], "drawio.md": [2, 1], "canvas.md": [1, 1], "infographic.md": [3, 1], "images.md": [0, 0], "frontmatter.md": [0, 0], "keyboard.md": [0, 0], "README.md": [0, 0] }
    const rbad = []
    for (const [name, [svgs, errs]] of Object.entries(want)) {
      await open(`${pgBase}/render/${name}`)
      const got = () => ev("JSON.stringify([document.querySelectorAll('.mt-md-diagram.mt-md-rendered svg').length, document.querySelectorAll('.mt-md-diagram-error').length, !!document.querySelector('.mt-md-article h1')])")
      // diagrams draw as they scroll into view, so scroll through the page
      await ev("(async()=>{for(const d of document.querySelectorAll('.mt-md-diagram')){d.scrollIntoView();await new Promise(r=>setTimeout(r,150))}})()").catch(() => {})
      await until(async () => { const [a, b] = JSON.parse(await got()); return a >= svgs && b >= errs }, `${name} diagrams`, 30000).catch(() => {})
      const [a, b, h] = JSON.parse(await got())
      if (!h || a !== svgs || b !== errs) rbad.push(`${name} svg=${a}/${svgs} errors=${b}/${errs} h1=${h}`)
    }
    await check("the render showcase pages all draw: Mermaid, mind maps, timeline, Graphviz and Vega/Vega-Lite (the deliberate mistakes show errors)", rbad.length === 0, rbad.join(" | "))
    await open(`${pgBase}/render/vega.md`)
    await until(async () => (await ev("document.querySelectorAll('.mt-md-diagram-error').length")) >= 1 || false, "vega error", 30000).catch(() => {})
    await check("a Vega chart that points at a URL is refused with a reason", /External data is not loaded/.test(await ev("document.querySelector('.mt-md-diagram-error')?.textContent||''")))
    await open(`http://127.0.0.1:${server.address().port}/hostiledrawio.md`)
    await until(() => ev("document.querySelectorAll('.mt-md-diagram.mt-md-rendered svg').length >= 1"), "hostile draw.io chart").catch(() => {})
    await sleep(1000)
    await check("a draw.io label with an <img onerror> never runs its handler in the page", (await ev("String(window.__mtPwned)")) === "undefined" && (await ev("document.querySelectorAll('.mt-md-diagram [onerror]').length")) === 0)
    await open(`http://127.0.0.1:${server.address().port}/hostileinfographic.md`)
    await until(() => ev("document.querySelectorAll('.mt-md-diagram.mt-md-rendered svg').length >= 1 || document.querySelectorAll('.mt-md-diagram-error').length >= 1"), "hostile infographic").catch(() => {})
    await sleep(1500)
    await check("an infographic label with an <img onerror> never runs its handler in the page", (await ev("String(window.__mtPwned)")) === "undefined" && (await ev("document.querySelectorAll('.mt-md-diagram [onerror]').length")) === 0)
    let themed
    await open(pathToFileURL(path.join(pgDocs, "themed/themed.md")).href)
    await sleep(1500)
    await check("a local mt-md-theme.css next to the document is applied (headings turn green)", (themed = await ev("getComputedStyle(document.querySelector('#mt-md-root h1')).color")) === "rgb(21, 128, 61)", themed)
    await open(`${pgBase}/themed/themed.md`)
    await sleep(800)
    await check("over http the same page ignores mt-md-theme.css", (await ev("getComputedStyle(document.querySelector('#mt-md-root h1')).color")) !== "rgb(21, 128, 61)")
    await open(`${pgBase}/render/drawio.md`)
    await until(() => ev("document.querySelectorAll('.mt-md-diagram.mt-md-rendered svg').length >= 1"), "draw.io chart").catch(() => {})
    const dio = JSON.parse(await ev("JSON.stringify({tags:/<(br|b)>/.test(document.querySelector('.mt-md-diagram svg').textContent),fo:document.querySelectorAll('.mt-md-diagram svg foreignObject').length,yes:document.querySelector('.mt-md-diagram svg').textContent.includes('yes'),bold:!!document.querySelector('.mt-md-diagram svg b'),patch:[...document.querySelectorAll('.mt-md-diagram svg foreignObject div')].some(d=>/background-color/.test(d.getAttribute('style')||d.outerHTML)),scripts:document.querySelectorAll('.mt-md-diagram script,.mt-md-diagram [onerror]').length})"))
    await check("draw.io labels show formatted text, not HTML tags, and edge labels sit on a patch of the page colour", !dio.tags && dio.fo > 0 && dio.yes && dio.bold && dio.patch && !dio.scripts, JSON.stringify(dio))
    // dark theme: text on the page must be light, text on a coloured shape must stay dark
    await ev("document.getElementById('mt-md-btn-theme')?.click()").catch(() => {})
    for (let i = 0; i < 3 && (await ev("document.body.classList.contains('mt-md-dark')||document.documentElement.classList.contains('mt-md-dark')")) !== true; i++) { await ev("document.getElementById('mt-md-btn-theme')?.click()"); await sleep(300) }
    await sleep(1500)
    const dk = JSON.parse(await ev("JSON.stringify({bg:getComputedStyle(document.getElementById('mt-md-root')).backgroundColor,labels:[...document.querySelectorAll('.mt-md-diagram svg foreignObject div')].map(d=>({t:d.textContent,c:getComputedStyle(d).color,own:getComputedStyle(d.closest('svg').parentElement).color}))})"))
    const lum = (c) => { const [r, g, b] = (c.match(/\d+/g) || [0, 0, 0]).map(Number); return 0.299 * r + 0.587 * g + 0.114 * b }
    const yes = dk.labels.findLast((l) => l.t === "yes")
    const start = dk.labels.findLast((l) => l.t === "Start")
    await check("draw.io in the dark theme: edge labels are light on the dark page, text on pastel shapes stays dark", !!yes && !!start && lum(yes.c) > 150 && lum(start.c) < 100, JSON.stringify(dk))
    await open(`${pgBase}/render/infographic.md`)
    await ev("(async()=>{for(const d of document.querySelectorAll('.mt-md-diagram')){d.scrollIntoView();await new Promise(r=>setTimeout(r,300))}})()").catch(() => {})
    await until(() => ev("document.querySelectorAll('.mt-md-diagram.mt-md-rendered svg').length >= 3"), "infographics").catch(() => {})
    await sleep(800)
    const ig = JSON.parse(await ev("JSON.stringify([...document.querySelectorAll('.mt-md-diagram.mt-md-rendered')].map(d=>{const s=d.querySelector('svg');const r=s.getBoundingClientRect();return {hidden:getComputedStyle(s).visibility!=='visible',w:r.width|0,h:r.height|0,text:d.textContent.replace(/\\s+/g,' ').trim()}}))"))
    await check("infographics are visible and carry their words (Open a file, Notes, Rendered)", ig.length === 3 && ig.every((i) => !i.hidden && i.w > 200 && i.h > 60) && /Open a file/.test(ig[0].text) && /Notes/.test(ig[1].text) && /Rendered and themed/.test(ig[2].text), JSON.stringify(ig))
    await open(`${pgBase}/render/images.md`)
    await until(() => ev("document.querySelectorAll('img.mt-md-zoomable').length >= 5"), "zoomable images")
    await ev("document.querySelector('img.mt-md-zoomable').click()")
    const lb = () => ev("JSON.stringify({open:!!document.getElementById('mt-md-lightbox'),cap:document.querySelector('#mt-md-lightbox .mt-md-lb-caption')?.textContent||'',n:document.querySelector('#mt-md-lightbox .mt-md-lb-count')?.textContent||'',w:document.querySelector('#mt-md-lightbox .mt-md-lb-img')?.naturalWidth||0})")
    const l1 = JSON.parse(await lb())
    await check("clicking a picture opens the image viewer with its caption and position", l1.open && l1.cap === "A PNG" && /^1 \/ \d+$/.test(l1.n) && l1.w > 0, JSON.stringify(l1))
    const wide = () => ev("(async()=>{const p=document.querySelector('#mt-md-lightbox .mt-md-lb-img');await new Promise(r=>setTimeout(r,200));return Math.round(p.getBoundingClientRect().width)})()")
    const wFit = await wide()
    await ev("document.querySelector('#mt-md-lightbox .mt-md-lb-img').click()")
    const wFull = await wide()
    await check("clicking the picture in the viewer switches between filling the window and its own size (360 px)", wFit > 500 && wFull === 360, `${wFit} -> ${wFull}`)
    await ev("document.querySelector('#mt-md-lightbox .mt-md-lb-img').click()")
    await page.call("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 })
    await page.call("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 })
    await until(async () => JSON.parse(await lb()).cap === "A JPEG with a space in its name", "next image").catch(() => {})
    await check("the Right arrow moves to the next picture", JSON.parse(await lb()).cap === "A JPEG with a space in its name", await lb())
    await page.call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
    await page.call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
    await until(async () => !JSON.parse(await lb()).open, "viewer closed").catch(() => {})
    await check("Escape closes the viewer", !JSON.parse(await lb()).open)
    await check("an image that is a link is not turned into a viewer", await ev("(()=>{const i=[...document.querySelectorAll('img')].find(x=>x.closest('a'));return !!i && !i.classList.contains('mt-md-zoomable')})()"))
    await open(`${pgBase}/07-unicode.md`)
    await check("the playground's charset-less http document reads as UTF-8", /café/.test(await ev("document.querySelector('.mt-md-article').textContent")) && /日本語/.test(await ev("document.querySelector('.mt-md-article').textContent")))
    await open(`${pgBase}/guides/getting-started.md`)
    await until(() => ev("!!document.querySelector('.mt-md-files a')"), "the http Files panel")
    await check("over http the Files panel lists the server's folder", /advanced.*getting-started\.md.*setup\.md/.test(await ev("document.querySelector('.mt-md-files-body').textContent")), await ev("document.querySelector('.mt-md-files-body').textContent"))
    // keyboard: single keys run the toolbar's actions, "?" lists them, and the Files tree answers the arrow keys
    const key = async (k, extra = {}) => {
      const code = k.length === 1 && /[a-z]/i.test(k) ? `Key${k.toUpperCase()}` : k
      await page.call("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : extra.vk, ...extra })
      await page.call("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : extra.vk })
      await sleep(250)
    }
    await open(`${pgBase}/render/text.md`)
    await until(() => ev("!!document.getElementById('mt-md-btn-theme')"), "toolbar")
    const themeNow = () => ev("document.documentElement.classList.contains('mt-md-dark')")
    const t0 = await themeNow()
    await key("t")
    const t1 = await themeNow()
    await check("the T key cycles the theme like the Theme button", t0 !== t1 || (await ev("document.getElementById('mt-md-btn-theme').getAttribute('aria-label')")) !== null, `${t0} -> ${t1}`)
    await key("?", { modifiers: 8 })
    await check("? opens the shortcut list, listing every shortcut", (await ev("document.querySelectorAll('#mt-md-keys kbd').length")) === 15)
    await key("Escape", { vk: 27 })
    await check("Esc closes the shortcut list", !(await ev("!!document.getElementById('mt-md-keys')")))
    // page layout: width, text size and contents panel placement
    const docW = () => ev("Math.round(document.querySelector('.mt-md-doc').getBoundingClientRect().width)")
    const h2H = () => ev("document.querySelector('.mt-md-article h2').getBoundingClientRect().height")
    const sideToc = () => ev("document.documentElement.classList.contains('mt-md-toc-side')")
    const tocInline = () => ev("getComputedStyle(document.querySelector('.mt-md-toc-toggle')).display==='block'")
    const w0 = await docW(); const side0 = await sideToc()
    await key("w")
    const w1 = await docW(); const side1 = await sideToc()
    await check("W narrows the page (theme default 980, then Narrow 720, plus 48px of padding) and the contents stay in the side column while there is room", w0 === 1028 && w1 === 768 && side0 && side1, `${w0} -> ${w1}, side ${side0}/${side1}`)
    await key("w"); await key("w")
    const wW = await docW()
    await check("Wide (1240) leaves no room beside it, so the contents become the inline button", wW > 1100 && !(await sideToc()) && (await tocInline()), `${wW}`)
    const hA = await h2H()
    await key("+")
    const hB = await h2H()
    await check("+ makes the text larger (the article zooms; the toolbar and panels stay)", hB > hA * 1.05, `${hA} -> ${hB}`)
    await key("-"); await key("-")
    await check("- makes it smaller again", (await h2H()) < hA * 0.95)
    await open(`${pgBase}/render/text.md`)
    await until(() => ev("!!document.getElementById('mt-md-btn-theme')"), "toolbar")
    await check("the layout is remembered on the next page", (await docW()) > 1100 && !(await sideToc()))
    await key("0")
    await key("w"); await key("w") // Wide -> Full window -> back to the theme's width
    await check("0 restores the text size and W cycles back round to the theme's width", (await docW()) === w0 && Math.abs((await h2H()) - hA) < 1, `${await docW()}`)
    await ev("document.getElementById('mt-md-btn-settings').click()")
    await ev("document.getElementById('mt-md-layout-gear').click()")
    await ev("(()=>{const s=document.getElementById('mt-md-layout-font');s.value='serif';s.dispatchEvent(new Event('change'))})()")
    await check("the Page layout row's font choice changes the document's font", /Georgia|serif/i.test(await ev("getComputedStyle(document.querySelector('.mt-md-article p')).fontFamily")))
    await ev("document.getElementById('mt-md-layout-reset').click()")
    await ev("document.getElementById('mt-md-btn-settings').click()")
    await check("Restore the theme's layout puts everything back", (await docW()) === w0 && !/Georgia/.test(await ev("getComputedStyle(document.querySelector('.mt-md-article p')).fontFamily")))
    const y0 = await ev("Math.round(window.scrollY)")
    await key("j")
    await sleep(900)
    await check("J scrolls to the next heading", (await ev("Math.round(window.scrollY)")) > y0)
    await key("e")
    await check("E on http (no file to edit) says why instead of doing nothing", /local files only/.test(await ev("document.getElementById('mt-md-toast')?.textContent||''")))
    await key("r")
    await check("R shows the raw Markdown", await ev("!document.querySelector('.mt-md-raw-view').hidden"))
    await key("r")
    await ev("document.getElementById('mt-md-btn-settings').click()")
    await check("Settings has a Keyboard shortcuts row, highlighted while on, with no Menu checkbox and a gear", (await ev("document.getElementById('mt-md-keys-toggle').getAttribute('aria-pressed')")) === "true" && (await ev("!document.querySelector('.mt-md-settings-keys input[type=checkbox]') && !!document.getElementById('mt-md-keys-gear') && !!document.querySelector('#mt-md-keys-toggle svg')")))
    const gx = (id) => ev(`Math.round(document.getElementById('${id}').getBoundingClientRect().x)`)
    await check("the keyboard gear lines up with the other gears in Settings", (await gx("mt-md-keys-gear")) === (await gx("mt-md-theme-gear")), `${await gx("mt-md-keys-gear")} vs ${await gx("mt-md-theme-gear")}`)
    await ev("document.getElementById('mt-md-keys-gear').click()")
    await check("the gear lists every key", (await ev("document.querySelectorAll('.mt-md-keys-editor input').length")) === 15)
    await ev("(()=>{const i=document.querySelector('[data-mt-key-for=raw]');i.focus();i.value='x';i.dispatchEvent(new Event('input',{bubbles:true}))})()")
    await ev("document.body.focus();document.activeElement.blur()")
    await ev("(()=>{const i=document.querySelector('[data-mt-key-for=autoreload]');i.focus();i.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}))})()")
    await check("Backspace in a key box clears that shortcut", (await ev("document.querySelector('[data-mt-key-for=autoreload]').value")) === "" && !/\(A\)/.test(await ev("document.getElementById('mt-md-btn-autoreload').title")))
    await ev("document.getElementById('mt-md-btn-settings').click()")
    await key("r")
    const rawAfterOld = await ev("!document.querySelector('.mt-md-raw-view').hidden")
    await key("x")
    await check("a key changed in Settings takes over: the new key works and the old one no longer does", !rawAfterOld && (await ev("!document.querySelector('.mt-md-raw-view').hidden")))
    await key("x")
    await ev("document.getElementById('mt-md-btn-settings').click()")
    await ev("document.getElementById('mt-md-keys-reset').click()")
    await ev("document.getElementById('mt-md-keys-toggle').click()")
    await ev("document.getElementById('mt-md-btn-settings').click()")
    await key("r")
    await check("with Keyboard shortcuts switched off in Settings the keys do nothing", await ev("document.querySelector('.mt-md-raw-view').hidden"))
    await ev("(async()=>{const s=chrome.storage?.local;})()").catch(() => {})
    await open(`${pgBase}/guides/getting-started.md`)
    await until(() => ev("!!document.querySelector('.mt-md-files [role=treeitem]')"), "tree")
    await ev("document.querySelector('.mt-md-files [role=treeitem][tabindex=\"0\"]').focus()")
    const cur = () => ev("document.activeElement?.textContent||''")
    const before = await cur()
    await key("ArrowDown", { vk: 40 })
    const after = await cur()
    await check("in the Files tree the arrow keys move between rows", before !== after && after !== "", `${before} -> ${after}`)
    await ev("document.querySelector('.mt-md-files .mt-md-folder').focus()")
    await key("ArrowRight", { vk: 39 })
    await until(() => ev("document.querySelector('.mt-md-files .mt-md-folder').getAttribute('aria-expanded')==='true'"), "folder open").catch(() => {})
    await check("Right opens a folder in the Files tree", await ev("document.querySelector('.mt-md-files .mt-md-folder').getAttribute('aria-expanded')==='true'"))
    await key("ArrowLeft", { vk: 37 })
    await check("Left closes it again", await ev("document.querySelector('.mt-md-files .mt-md-folder').getAttribute('aria-expanded')==='false'"))
    await check("exactly one tree row is in the tab order", (await ev("document.querySelectorAll('.mt-md-files [role=treeitem][tabindex=\"0\"]').length")) === 1)
  } finally {
    pg.kill()
  }

  // 2d. problems other viewers' users report (from their reviews and issue trackers)
  const pgDocs2 = path.join(pkgRoot, "playground/docs")
  const pg2 = spawn(process.execPath, [path.join(pkgRoot, "playground/serve.mjs"), "--port", "0"], { stdio: ["ignore", "pipe", "ignore"] })
  const pg2Base = await new Promise((resolve, reject) => {
    let out = ""
    pg2.stdout.on("data", (d) => { out += d; const m = /over http : (http:\/\/127\.0\.0\.1:\d+)/.exec(out); if (m) resolve(m[1]) })
    setTimeout(() => reject(new Error("playground server did not start")), 5000)
  })
  try {
    const longName = "09-long-document.md"
    for (const [kind, base] of [["http", pg2Base + "/"], ["file", pathToFileURL(pgDocs2 + path.sep).href]]) {
      await open(base + longName)
      const id = await ev("document.querySelectorAll('.mt-md-article h2')[5].id")
      await open(base + "01-basics.md") // a fresh load of the other document, as when a link is clicked
      await ev(`location.href = ${JSON.stringify(`${base}${longName}#${id}`)}`)
      await until(async () => (await ev("document.querySelector('.mt-md-article h1')?.textContent")) !== "Basics" && (await ev("!!document.getElementById('mt-md-root')")), "the linked document")
      await sleep(1500)
      const top = await ev(`(()=>{const h=document.getElementById(${JSON.stringify(id)});return h?Math.round(h.getBoundingClientRect().top):null})()`)
      await check(`a link to another document's #section lands on that section (${kind})`, top !== null && top >= -5 && top < 150, `top=${top}`)
    }
    await open(`${pg2Base}/09-long-document.md`)
    await ev("window.scrollTo(0, 1800)"); await sleep(400)
    const before = await ev("Math.round(window.scrollY)")
    await ev("location.href = '01-basics.md'")
    await until(async () => (await headingNow()) === "Basics", "the next document")
    await ev("history.back()")
    await until(() => ev("!!document.getElementById('mt-md-root') && document.querySelector('.mt-md-article h1')?.textContent !== 'Basics'"), "the long document again")
    await sleep(1200)
    const after = await ev("Math.round(window.scrollY)")
    await check("going Back returns to where you were reading", Math.abs(after - before) < 120 && before > 1000, `before=${before} after=${after}`)
    // 2d'. Export: the gear's format / images / where, the button's wording, and each format's file (images.md has PNG, JPEG, SVG, WebP, GIF)
    await open(`${pg2Base}/render/images.md`)
    await until(() => ev("document.querySelectorAll('.mt-md-article img').length >= 5"), "the images page")
    const exportAs = async (format, images, where = "downloads", folder = "mt-md") => {
      await ev(`(()=>{if(!document.getElementById('mt-md-settings'))document.getElementById('mt-md-btn-settings').click();document.getElementById('mt-md-export-gear').click();const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};set('mt-md-export-format',${JSON.stringify(format)});set('mt-md-export-images',${JSON.stringify(images)});set('mt-md-export-where',${JSON.stringify(where)});set('mt-md-export-folder',${JSON.stringify(folder)});document.getElementById('mt-md-btn-settings').click()})()`)
    }
    const fresh = (name) => { rmSync(path.join(downloads, name), { force: true }) }
    const got = async (name) => { await until(() => existsSync(path.join(downloads, name)), `the exported ${name}`, 30000); await sleep(300); return path.join(downloads, name) }
    const unz = (file, flag) => execFileSync("unzip", [flag, file], { encoding: "utf8" })
    await check("the Export button says what it will do (default: Markdown, images embedded, Downloads)", /Export as Markdown.*images embedded.*Downloads folder/.test(await ev("document.getElementById('mt-md-btn-bundle').title")) && (await ev("document.getElementById('mt-md-btn-bundle').getAttribute('aria-label')")) === "Export as Markdown")
    await exportAs("html", "embed")
    await check("after choosing HTML (images embedded) the button's tooltip and name follow", /Export as an HTML page, images embedded/.test(await ev("document.getElementById('mt-md-btn-bundle').title")) && (await ev("document.getElementById('mt-md-btn-bundle').getAttribute('aria-label')")) === "Export as HTML")
    fresh("images.html"); await clickTool("bundle")
    const html1 = readFileSync(await got("images.html"), "utf8")
    await check("HTML export with images embedded is one self-contained file (data: pictures, the viewer's CSS, no toolbar)", (html1.match(/src="data:image\//g) || []).length >= 5 && /<style>[^<]*mt-md-article/.test(html1) && !/id="mt-md-toolbar"|<button|<script/.test(html1), `data=${(html1.match(/src="data:image\//g) || []).length} style=${/<style>[^<]*mt-md-article/.test(html1)} toolbar=${/id="mt-md-toolbar"/.test(html1)} button=${/<button/.test(html1)} script=${/<script/.test(html1)}`)
    await exportAs("html", "link"); fresh("images.html"); await clickTool("bundle")
    const html2 = readFileSync(await got("images.html"), "utf8")
    await check("HTML export with images linked keeps their addresses and embeds nothing", !/src="data:image\//.test(html2) && new RegExp(`src="${pg2Base}/images/one\\.png"`).test(html2))
    await exportAs("html", "omit"); fresh("images.html"); await clickTool("bundle")
    const html3 = readFileSync(await got("images.html"), "utf8")
    await check("HTML export with images left out has no <img> at all", !/<img/.test(html3))
    await exportAs("html", "files"); fresh("images.html.zip"); await clickTool("bundle")
    const zipPath = await got("images.html.zip")
    const zlist = unz(zipPath, "-Z1")
    await check("HTML export with images as files is a .zip holding the page and an images/ folder", /^images\.html$/m.test(zlist) && (zlist.match(/^images\/img-\d+\./gm) || []).length >= 5, zlist)
    for (const [fmt, name, picture, main] of [["docx", "images.docx", /word\/media\/image1\./, "word/document.xml"], ["odt", "images.odt", /Pictures\/img1\./, "content.xml"]]) {
      await exportAs(fmt, "embed"); fresh(name); await clickTool("bundle")
      const f = await got(name)
      const lst = unz(f, "-Z1")
      let bad = ""
      try { unz(f, "-tq") } catch (e) { bad = e.message }
      await check(`${fmt.toUpperCase()} export is a valid package with the pictures inside`, !bad && picture.test(lst), bad || lst)
      const xml = execFileSync("unzip", ["-p", f, main], { encoding: "utf8" })
      await check(`${fmt.toUpperCase()} export keeps the headings and text`, fmt === "docx" ? /Heading1/.test(xml) && /Images/.test(xml) : /text:outline-level="1"/.test(xml) && /Images/.test(xml))
    }
    await exportAs("doc", "embed"); fresh("images.doc"); await clickTool("bundle")
    const mht = readFileSync(await got("images.doc"), "utf8")
    await check("DOC export is a web archive: the page plus its pictures as parts", /^MIME-Version: 1\.0/.test(mht) && (mht.match(/Content-Type: image\//g) || []).length >= 5)
    await exportAs("epub", "embed"); fresh("images.epub"); await clickTool("bundle")
    const epub = await got("images.epub")
    let epubBad = ""
    try { unz(epub, "-tq") } catch (e) { epubBad = e.message }
    const elist = unz(epub, "-Z1")
    await check("EPUB export is a valid package: mimetype first, the chapter, a navigation list and the pictures", !epubBad && elist.split("\n")[0] === "mimetype" && /OEBPS\/chapter\.xhtml/.test(elist) && /OEBPS\/nav\.xhtml/.test(elist) && (elist.match(/OEBPS\/images\/img-\d+/g) || []).length >= 4, epubBad || elist)
    await exportAs("rtf", "embed"); fresh("images.rtf"); await clickTool("bundle")
    const rtf = readFileSync(await got("images.rtf"), "utf8")
    await check("RTF export is an RTF document with a heading and the pictures as hex", /^\{\\rtf1/.test(rtf) && /Images/.test(rtf) && /\\pngblip|\\jpegblip/.test(rtf))
    await exportAs("txt", "embed"); fresh("images.txt"); await clickTool("bundle")
    const txt = readFileSync(await got("images.txt"), "utf8")
    await check("plain text export has an underlined title and each picture's description", /^Images\n=+\n/.test(txt) && /\[image: A PNG\]|\[A PNG\]/.test(txt), txt.slice(0, 160))
    await open(`${pg2Base}/render/graphviz.md`)
    await exportAs("docx", "embed"); fresh("graphviz.docx"); await clickTool("bundle")
    const dg = await got("graphviz.docx")
    await check("a diagram that has not scrolled into view is drawn for the export, and lands in the Word file as a picture", /word\/media\/image1\.png/.test(unz(dg, "-Z1")))
    await exportAs("odt", "embed"); fresh("graphviz.odt"); await clickTool("bundle")
    const dodt = await got("graphviz.odt")
    const odtList = unz(dodt, "-Z1")
    await check("an ODT diagram is carried as SVG with a PNG fallback", /Pictures\/img1\.svg/.test(odtList) && /Pictures\/img1\.png/.test(odtList), odtList)
    await exportAs("epub", "embed"); fresh("graphviz.epub"); await clickTool("bundle")
    const depub = await got("graphviz.epub")
    const dch = execFileSync("unzip", ["-p", depub, "OEBPS/chapter.xhtml"], { encoding: "utf8" })
    await check("an EPUB diagram is its PNG as a plain <img> (no <picture>, no SVG file)", /<img src="images\/img-1\.png"/.test(dch) && !/<picture/.test(dch) && !/\.svg/.test(unz(depub, "-Z1")), unz(depub, "-Z1"))
    // a folder inside Downloads: goes through the extension's downloads permission. (The test browser's download override saves
    // every download it sees as download.<ext> in one directory, so the folder itself cannot be seen here; the toast reports the
    // path the extension asked for, and the unit tests cover the path cleaning.)
    await exportAs("html", "embed", "folder", "e2e-out/docs"); await clickTool("bundle")
    const folderToast = await until(async () => /^Exported .* to Downloads\//.test(await toast()) && (await toast()), "the folder export toast")
    const viaApi = await got("download.html")
    await check("with 'A folder inside Downloads' the export goes through the downloads permission to that folder, and the tooltip says so", folderToast === "Exported graphviz.html to Downloads/e2e-out/docs" && /<h1/.test(readFileSync(viaApi, "utf8")) && /saved to the "e2e-out\/docs" folder inside Downloads/.test(await ev("document.getElementById('mt-md-btn-bundle').title")), folderToast)
    await exportAs("html", "embed", "folder", "../../escape"); await clickTool("bundle")
    const escToast = await until(async () => /escape/.test(await toast()) && (await toast()), "the cleaned-folder toast")
    await check("a folder name that tries to climb out ('../../escape') is cleaned to a folder inside Downloads", escToast === "Exported graphviz.html to Downloads/escape", escToast)
    // Copy: the gear picks what goes on the clipboard; read it back through the real clipboard
    await browser.call("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
    await open(`${pg2Base}/01-basics.md`)
    const copyAs = (format) => ev(`(()=>{if(!document.getElementById('mt-md-settings'))document.getElementById('mt-md-btn-settings').click();if(!document.getElementById('mt-md-copy-format'))document.getElementById('mt-md-copy-gear').click();const e=document.getElementById('mt-md-copy-format');e.value=${JSON.stringify(format)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    let lastToast = ""
    const clip = async () => { await clickTool("copy"); await sleep(600); lastToast = await toast(); return ev(`(async()=>{const items=await navigator.clipboard.read();const out={};for(const it of items)for(const t of it.types)out[t]=await (await it.getType(t)).text();return out})()`) }
    await ev("(()=>{if(!document.getElementById('mt-md-settings'))document.getElementById('mt-md-btn-settings').click();const b=document.getElementById('mt-md-btn-copy');if(b.hidden)document.querySelector('#mt-md-settings [data-mt-row=copy]').closest('.mt-md-settings-row').querySelector('input').click()})()")
    await check("the Copy button says what it copies (default: the HTML code)", /Copy the page's HTML code/.test(await ev("document.getElementById('mt-md-btn-copy').title")) && (await ev("document.getElementById('mt-md-btn-copy').getAttribute('aria-label')")) === "Copy HTML code")
    await ev("document.getElementById('mt-md-btn-copy') && 0")
    const c1 = await clip()
    await check("Copy HTML code puts the page's HTML on the clipboard as text, without the Files column", /<h1/.test(c1["text/plain"] || "") && !/id="mt-md-toc"/.test(c1["text/plain"] || ""), JSON.stringify(c1).slice(0, 120) + " toast=" + lastToast)
    await copyAs("rich")
    const c2 = await clip()
    await check("Copy formatted puts HTML and plain text on the clipboard together", /<h1/.test(c2["text/html"] || "") && /Basics/.test(c2["text/plain"] || "") && !/<h1/.test(c2["text/plain"] || ""), JSON.stringify(c2).slice(0, 160))
    await check("after choosing formatted the Copy button's tooltip and name follow", /formatted page/.test(await ev("document.getElementById('mt-md-btn-copy').title")) && (await ev("document.getElementById('mt-md-btn-copy').getAttribute('aria-label')")) === "Copy formatted text")
    await copyAs("md")
    const c3 = await clip()
    await check("Copy Markdown source puts the original .md text on the clipboard", /^# Basics/m.test(c3["text/plain"] || ""), JSON.stringify(c3).slice(0, 120))
    await copyAs("txt")
    const c4 = await clip()
    await check("Copy plain text is readable text with no tags", /Basics/.test(c4["text/plain"] || "") && !/<[a-z]+[ >]/.test(c4["text/plain"] || ""), JSON.stringify(c4).slice(0, 120))
    // Feedback: one link, to the issue page by default (pre-filled with version, browser and kind of page only), whose tooltip names the destination
    const fb = await ev("(()=>{if(!document.getElementById('mt-md-settings'))document.getElementById('mt-md-btn-settings').click();const a=document.getElementById('mt-md-feedback');return a&&{href:a.href,target:a.target,title:a.title,text:a.textContent,extra:!!document.getElementById('mt-md-feedback-email')}})()")
    const fbUrl = fb && new URL(fb.href)
    const fbBody = fbUrl?.searchParams.get("issue[description]") || fbUrl?.searchParams.get("body") || ""
    await check("Settings has one Feedback link to the issue page, filled with version, browser and kind of page only", !!fb && fb.text === "Feedback" && !fb.extra && fb.target === "_blank" && /\/issues\/new$/.test(fbUrl.pathname) && /mt-md \d+\.\d+\.\d+ · Chrome \d+ · localhost/.test(fbBody) && !fbBody.includes(pg2Base) && !/127\.0\.0\.1/.test(fbBody), fb ? fbBody.slice(-120) : "no link")
    await check("the Feedback tooltip names where it goes", !!fb && /issue page/.test(fb.title) && fbUrl && fb.title.includes(fbUrl.host), fb?.title)
    // its gear sends it to the project's email instead, and the tooltip follows
    const fb2 = await ev("(()=>{document.getElementById('mt-md-feedback-gear').click();const s=document.getElementById('mt-md-feedback-choice');s.value='email';s.dispatchEvent(new Event('change'));const a=document.getElementById('mt-md-feedback');const r={href:a.href,target:a.target,title:a.title};s.value='issues';s.dispatchEvent(new Event('change'));return r})()")
    await check("Feedback can go to the project's email instead (a mailto with the same template, no page address), and the tooltip says so", /^mailto:[^?]+\?subject=mt-md%20feedback&body=/.test(fb2?.href || "") && /mt-md%20\d/.test(fb2.href) && !fb2.href.includes("127.0.0.1") && fb2.target === "" && /email to /.test(fb2.title), JSON.stringify(fb2))
    await page.call("Page.bringToFront")
    await exportAs("md", "embed", "downloads")
    await open(`http://127.0.0.1:${server.address().port}/typed.md`)
    await check("a server that sends text/markdown is rendered", (await headingNow()) === "Typed markdown")
    await page.call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/framehost.html` })
    const inFrame = (expr) => ev(`(()=>{const d=document.getElementById('g')?.contentDocument;return d?(${expr}):null})()`)
    await until(() => inFrame("!!d.getElementById('mt-md-root')"), "the guide rendered inside the iframe", 15000)
    const frameFacts = await inFrame("({h1:d.querySelector('.mt-md-article h1')?.textContent,embedded:d.getElementById('mt-md-root').classList.contains('mt-md-embedded'),toolbar:!!d.getElementById('mt-md-toolbar'),gear:!!d.getElementById('mt-md-btn-settings'),tocBtn:!!d.querySelector('#mt-md-btn-toc:not([hidden])'),reloadBtn:!!d.querySelector('#mt-md-btn-autoreload:not([hidden])'),toc:!!d.getElementById('mt-md-toc'),side:d.documentElement.classList.contains('mt-md-toc-side'),open:!!d.querySelector('#mt-md-toc.mt-md-toc-open'),files:!!d.querySelector('.mt-md-files'),out:d.querySelector('a[href^=\"https://example.com\"]').target,inpage:d.querySelector('a[href^=\"#\"]').target})")
    await check("a .md page inside an iframe renders compactly: keeps its toolbar, settings, auto-reload and a closed inline Contents button (no side column or Files panel), outside links open a new tab, #links stay", frameFacts?.h1 === "Guide" && frameFacts.embedded && frameFacts.toolbar && frameFacts.gear && frameFacts.tocBtn && frameFacts.reloadBtn && frameFacts.toc && !frameFacts.side && !frameFacts.open && !frameFacts.files && frameFacts.out === "_blank" && frameFacts.inpage === "", JSON.stringify(frameFacts))
    await inFrame("(d.getElementById('mt-md-btn-settings').click(),1)")
    await until(() => inFrame("!!d.getElementById('mt-md-settings')"), "the settings panel opened inside the iframe", 5000)
    await check("the settings panel opens inside the frame and fits it", await inFrame("(()=>{const r=d.getElementById('mt-md-settings').getBoundingClientRect();return r.width>0&&r.right<=d.defaultView.innerWidth+1})()"), JSON.stringify(await inFrame("d.getElementById('mt-md-settings').getBoundingClientRect().toJSON()")))
    await inFrame("(d.getElementById('mt-md-btn-settings').click(),1)")
    await check("the page that frames it is left alone (no mt-md in the top document)", !(await ev("!!document.getElementById('mt-md-root')")))
    {
      // the pointer rests on the toolbar inside the frame, then leaves the frame: the toolbar must still fade
      const fr = await ev("(()=>{const r=document.getElementById('g').getBoundingClientRect();return {x:r.x,y:r.y}})()")
      await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: fr.x + 100, y: fr.y + 150 })
      const bar = await inFrame("(()=>{const r=d.getElementById('mt-md-toolbar').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
      await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: fr.x + bar.x - 6, y: fr.y + bar.y })
      await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: fr.x + bar.x, y: fr.y + bar.y })
      await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: fr.x + bar.x + 10, y: fr.y + bar.y })
      await sleep(3200)
      await check("the toolbar stays while the pointer is on it inside a frame", !(await inFrame("d.getElementById('mt-md-toolbar').classList.contains('mt-md-hidden')")))
      await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: fr.x + bar.x + 300, y: Math.max(2, fr.y - 30) })
      await sleep(3200)
      await check("the toolbar fades once the pointer has left the frame", await inFrame("d.getElementById('mt-md-toolbar').classList.contains('mt-md-hidden')"), "hover on " + (await inFrame("d.getElementById('mt-md-toolbar').matches(':hover')")))
    }
    const t0 = Date.now()
    await page.call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/big.md` })
    await until(() => ev("!!document.querySelector('.mt-md-article h2')"), "the 2 MB document", 60000)
    const bigMs = Date.now() - t0
    await check("a 2 MB document renders in a reasonable time", bigMs < 20000, `${bigMs} ms`)
    await open(`http://127.0.0.1:${server.address().port}/mathfence.md`)
    await until(() => ev("document.querySelectorAll('.mt-md-math math').length >= 3"), "math from a ```math fence and $`x`$", 10000).catch(() => {})
    await check("a ```math fence and GitLab-style $`x`$ both render as math", (await ev("document.querySelectorAll('.mt-md-math math').length")) === 3, String(await ev("document.querySelectorAll('.mt-md-math math').length")))
  } finally {
    pg2.kill()
  }

  // 3. the bundled file renders by itself, all five images
  await open(pathToFileURL(path.join(downloads, file)).href)
  const shown = await ev("[...document.querySelectorAll('.mt-md-article img')].filter(i=>i.naturalWidth>0).length")
  await check("bundled file renders every embedded image (PNG, JPEG, GIF, WebP, SVG twice = 6)", shown === 6, `shown=${shown}`)
} catch (err) {
  await check("end-to-end run", false, err.message)
} finally {
  page?.close(); browser?.close()
  proc.kill()
  await sleep(300)
  rmSync(tree, { recursive: true, force: true }); rmSync(otherDir, { recursive: true, force: true }); rmSync(profile, { recursive: true, force: true })
  if (process.env.MT_MD_KEEP_DOWNLOADS) console.log(`downloads kept in ${downloads}`); else rmSync(downloads, { recursive: true, force: true })
}
// --- site access, part two: with the host granted (as host_permissions here, because a permission prompt cannot be clicked
// headless) the background registers the content script and the same page renders.
{
  const variant = mkdtempSync(path.join(tmpdir(), "mt-md-e2e-variant-"))
  cpSync(ext, variant, { recursive: true })
  const manifest = JSON.parse(readFileSync(path.join(variant, "manifest.json"), "utf8"))
  manifest.host_permissions = ["http://test.localhost/*", "http://*/*"]
  writeFileSync(path.join(variant, "manifest.json"), JSON.stringify(manifest))
  const profile2 = mkdtempSync(path.join(tmpdir(), "mt-md-e2e-p2-"))
  const proc2 = spawn(chromium, [...(HEADED ? [] : ["--headless=new"]), "--no-sandbox", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile2}`,
    `--disable-extensions-except=${variant}`, `--load-extension=${variant}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" })
  let page2
  try {
    const port2 = (await until(() => existsSync(path.join(profile2, "DevToolsActivePort")) && readFileSync(path.join(profile2, "DevToolsActivePort"), "utf8"), "the second browser")).split("\n")[0]
    await sleep(1500) // the background registers the granted sites when it starts
    const tab2 = (await (await fetch(`http://127.0.0.1:${port2}/json`)).json()).find((t) => t.type === "page")
    page2 = await connect(tab2.webSocketDebuggerUrl)
    await page2.call("Page.enable")
    await page2.call("Page.navigate", { url: `http://test.localhost:${server.address().port}/live.md` })
    const ok = await until(async () => (await page2.call("Runtime.evaluate", { expression: "!!document.getElementById('mt-md-root')", returnByValue: true })).result.value, "the granted site to render", 8000).then(() => true).catch(() => false)
    await check("an allowed site renders through the registered content script", ok)
    // with all sites granted, local pages (static script) must not be rendered a second time by the dynamic one
    await page2.call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/live.md` })
    await until(async () => (await page2.call("Runtime.evaluate", { expression: "!!document.getElementById('mt-md-root')", returnByValue: true })).result.value, "the local page to render", 8000)
    await sleep(1500)
    const counts = (await page2.call("Runtime.evaluate", { expression: "JSON.stringify([document.querySelectorAll('#mt-md-root').length, document.querySelectorAll('#mt-md-toolbar').length, document.querySelectorAll('.mt-md-article h1').length])", returnByValue: true })).result.value
    await check("with all sites allowed, a local page is rendered exactly once", counts === "[1,1,1]", counts)
  } catch (err) {
    await check("site access with a granted host", false, err.message)
  } finally {
    page2?.close(); proc2.kill(); await sleep(300)
    rmSync(variant, { recursive: true, force: true }); rmSync(profile2, { recursive: true, force: true })
  }
}

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} end-to-end checks passed`)
process.exit(failed ? 1 : 0)
