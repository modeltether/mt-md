// Reads a .md file for the page that is showing it, so auto-reload can watch file: documents (content scripts cannot).
// It answers only our own content scripts, only for file: URLs ending in .md, and only for the sender's own page.
import { decodeSource } from "./detect.js"
import { listingAllowed } from "./listing.js"

const api = globalThis.browser ?? globalThis.chrome
const strip = (u) => u.split("#")[0]

// Lists a folder (as the browser's own directory page) for the Files panel: any folder on this machine, names only, and only when asked by one of our own content scripts on a local .md page (Up needs the parent folder, and "Only these folders" does not limit it).
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "mt-md-list" || sender.id !== api.runtime.id) return false
  const url = String(msg.url || "")
  if (!listingAllowed(url, sender.url || sender.tab?.url || "")) { sendResponse({ ok: false, error: "not allowed" }); return false }
  fetch(url, { cache: "no-store" })
    .then((res) => res.text())
    .then((html) => sendResponse({ ok: true, html: html.slice(0, 2_000_000) }))
    .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }))
  return true
})

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "mt-md-read" || sender.id !== api.runtime.id) return false
  const url = strip(String(msg.url || ""))
  let ok = false
  try {
    const u = new URL(url)
    ok = u.protocol === "file:" && /\.md$/i.test(u.pathname) && strip(sender.url || sender.tab?.url || "") === url
  } catch { /* not a URL */ }
  if (!ok) { sendResponse({ ok: false, error: "not allowed" }); return false }
  fetch(url, { cache: "no-store" })
    .then((res) => res.arrayBuffer())
    .then((buf) => sendResponse({ ok: true, text: decodeSource(buf) }))
    .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }))
  return true // answer asynchronously
})

// The optional mt-md-theme.css that sits next to a local .md page (a content script cannot read file: URLs). Only the sender's own folder.
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "mt-md-theme-css" || sender.id !== api.runtime.id) return false
  let target = null
  try {
    const from = new URL(strip(sender.url || sender.tab?.url || ""))
    if (from.protocol === "file:" && /\.md$/i.test(from.pathname)) target = new URL("mt-md-theme.css", from).href
  } catch { /* not a URL */ }
  if (!target) { sendResponse({ ok: false, error: "not allowed" }); return false }
  fetch(target, { cache: "no-store" })
    .then((res) => (res.ok ? res.text() : ""))
    .then((text) => sendResponse({ ok: true, text: text.slice(0, 200_000) }))
    .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }))
  return true
})

// Export: saves a file the reader made into a folder inside Downloads, or through the Save as dialog (the `downloads` permission).
// Only our own content scripts can ask; the path is cleaned again here and never leaves the Downloads folder.
import { downloadPath } from "./savepath.js"
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "mt-md-save" || sender.id !== api.runtime.id || !api.downloads) return false
  const mime = /^[\w.+-]+\/[\w.+-]+(;charset=[\w-]+)?$/.test(String(msg.mime)) ? String(msg.mime) : "application/octet-stream"
  if (typeof msg.base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(msg.base64.slice(0, 1000))) { sendResponse({ ok: false, error: "bad data" }); return false }
  const where = msg.where === "ask" ? "ask" : "folder"
  api.downloads.download({
    url: `data:${mime};base64,${msg.base64}`,
    filename: downloadPath(msg.name, where, msg.folder),
    saveAs: where === "ask",
    conflictAction: "uniquify",
  }).then(() => sendResponse({ ok: true }), (err) => {
    const text = String(err?.message || err)
    sendResponse({ ok: false, cancelled: /cancel/i.test(text), error: text })
  })
  return true
})

// Keep the content script registered for exactly the sites the person has allowed.
import { syncSites, reloadUnlockedTabs } from "./sites.js"
const resync = () => syncSites(api).catch(() => {})
api.runtime.onInstalled.addListener(resync)
api.runtime.onStartup?.addListener(resync)
api.permissions.onAdded.addListener(async (added) => { await resync(); await reloadUnlockedTabs(api, added.origins).catch(() => {}) })
api.permissions.onRemoved.addListener(resync)
resync()

// A first-run set-up page, and a "!" on the toolbar button while the browser still keeps mt-md away from local files.
import { fileAccess } from "./fileaccess.js"
import { loadSetting } from "./settings.js"
const NOFILES_KEY = "mt-md-nofiles"
async function refreshBadge() {
  const needed = (await fileAccess(api)) === "no" && !(await loadSetting(NOFILES_KEY, false))
  await api.action.setBadgeText({ text: needed ? "!" : "" })
  if (needed) await api.action.setBadgeBackgroundColor({ color: "#d97706" })
  await api.action.setTitle({ title: needed ? "mt-md: local files need your OK. Click to see how." : "mt-md" })
}
const badge = () => refreshBadge().catch(() => {})
api.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") api.tabs.create({ url: api.runtime.getURL("welcome.html") })
  badge()
})
api.runtime.onStartup?.addListener(badge)
api.permissions.onAdded.addListener(badge)
api.permissions.onRemoved.addListener(badge)
api.storage?.onChanged?.addListener((changes) => { if (NOFILES_KEY in changes) badge() })
api.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "mt-md-badge" && sender.id === api.runtime.id) badge()
  return false
})
badge()
