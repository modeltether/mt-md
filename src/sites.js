// Which sites mt-md may render. `file:` documents and localhost always work (static content-script matches).
// Every other site is an optional host permission the person grants from the toolbar popup; granted sites get a
// dynamically registered content script, so adding or removing one never needs a new manifest or a store review.
import { isMarkdownUrl } from "./detect.js"

export const SCRIPT_ID = "mt-md-sites"
export const SCRIPT_FILES = ["mt-md-mermaid.js", "mt-md-graphviz.js", "mt-md-vega.js", "mt-md-infographic.js", "mt-md-drawio.js", "mt-md.js"]
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"]
export const ALL_ORIGINS = ["http://*/*", "https://*/*"]
// local pages already have the static content script; the dynamic one must not run on them a second time
const EXCLUDE_LOCAL = ["file:///*", "http://localhost/*", "http://127.0.0.1/*", "http://[::1]/*"]

// "https://example.com/page.md" -> "https://example.com/*" (match patterns ignore ports, so one grant covers the host)
export function hostPattern(url) {
  const u = new URL(url)
  return `${u.protocol}//${u.hostname}/*`
}

export function isLocalUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === "file:" || LOCAL_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

const isWeb = (origin) => /^https?:\/\//.test(origin) && !LOCAL_HOSTS.some((h) => origin.includes(`//${h}/`))

// Granted origin patterns -> the .md-only match patterns for the dynamic content script.
export function markdownMatches(origins) {
  return [...new Set(origins.filter(isWeb).map((o) => o.replace(/\/\*$/, "/*.md")))]
}

export function allowedSites(origins) {
  return [...new Set(origins.filter(isWeb))].sort()
}

// How a granted pattern reads in the popup's list.
export function siteLabel(origin) {
  if (origin === "https://*/*") return "All websites (https)"
  if (origin === "http://*/*") return "All websites (http)"
  return origin.replace(/^https?:\/\//, "").replace(/\/\*$/, "")
}

// What the popup should offer for the active tab.
export function siteState(tabUrl, grantedOrigins) {
  let u
  try { u = new URL(tabUrl) } catch { return { kind: "other" } }
  if (isLocalUrl(tabUrl)) return { kind: "local", host: u.hostname || "this computer" }
  if (!/^https?:$/.test(u.protocol)) return { kind: "other" }
  const pattern = hostPattern(tabUrl)
  if (grantedOrigins.includes(`${u.protocol}//*/*`)) return { kind: "all", host: u.hostname, pattern }
  if (grantedOrigins.includes(pattern)) return { kind: "allowed", host: u.hostname, pattern }
  return isMarkdownUrl(tabUrl) ? { kind: "allow", host: u.hostname, pattern } : { kind: "other", host: u.hostname, pattern }
}

// Make the registered content script match exactly the granted sites. Safe to call at any time, from anywhere.
export async function syncSites(api = globalThis.browser ?? globalThis.chrome) {
  const { origins = [] } = await api.permissions.getAll()
  const matches = markdownMatches(origins)
  const existing = await api.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })
  if (!matches.length) {
    if (existing.length) await api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] })
    return matches
  }
  const script = { id: SCRIPT_ID, matches, excludeMatches: EXCLUDE_LOCAL, js: SCRIPT_FILES, runAt: "document_idle", persistAcrossSessions: true }
  try {
    if (existing.length) await api.scripting.updateContentScripts([script])
    else await api.scripting.registerContentScripts([script])
  } catch (err) {
    // the background and the popup can race to register the same id; the loser retries as an update
    await api.scripting.updateContentScripts([script])
  }
  return matches
}

// After a grant, tabs already open on those sites still show raw text. Reload them so the grant takes effect at once.
// This lives in the background script: the popup closes the moment the browser's permission prompt appears, so code
// in the popup that waits for the answer never runs.
export async function reloadUnlockedTabs(api, origins) {
  const matches = markdownMatches(origins || [])
  if (!matches.length) return []
  const tabs = await api.tabs.query({ url: matches }).catch(() => [])
  await Promise.all(tabs.map((t) => api.tabs.reload(t.id).catch(() => {})))
  return tabs.map((t) => t.id)
}
