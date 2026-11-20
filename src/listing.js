// Folder listings for the Files panel. A folder is read as the HTML page the browser or the server already shows for it:
// Chrome's own file: listing (addRow calls), or any page of links (Firefox's file: listing, Apache/nginx/Caddy autoindex,
// python -m http.server). Only .md files and sub-folders are kept.
const MD = /\.md$/i
const strip = (u) => u.split("#")[0]

export function dirOf(href) {
  return new URL("./", strip(href)).href
}

const unescapeJs = (s) => s.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, "$1")
const unescapeHtml = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")

// A direct child of dirUrl as {name, url, dir}, or null for the parent link, sort links, other hosts and deeper paths.
function child(href, dirUrl, isDir) {
  let dir, u
  try {
    dir = new URL(dirUrl)
    u = new URL(href, dir)
  } catch {
    return null
  }
  if (u.origin !== dir.origin || u.search || !u.pathname.startsWith(dir.pathname)) return null
  const rest = u.pathname.slice(dir.pathname.length)
  const m = /^([^/]+)(\/?)$/.exec(rest)
  if (!m) return null
  let name = m[1]
  try { name = decodeURIComponent(name) } catch { /* keep the encoded name */ }
  const dirLike = isDir ?? m[2] === "/"
  if (dirLike && !m[2]) u.pathname += "/"
  u.hash = ""
  return { name, url: u.href, dir: dirLike }
}

// Firefox lists a local folder as "application/http-index-format": a "200: filename content-length last-modified file-type"
// header, then one "201: <percent-encoded name> <size> <date> <FILE|DIRECTORY|SYMBOLIC-LINK>" line per entry.
function parseHttpIndex(text, dirUrl) {
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^201:\s+(\S+)\s+.*?\s(FILE|DIRECTORY|SYMBOLIC-LINK)\s*$/.exec(line)
    if (!m) continue
    let name = m[1]
    if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1)
    const e = child(name.endsWith("/") || m[2] !== "DIRECTORY" ? name : name + "/", dirUrl, m[2] === "DIRECTORY")
    if (e) out.push(e)
  }
  return out
}

// Every direct child the listing page shows, folders and files alike (so a caller can check the page is a real listing).
export function parseListing(html, dirUrl) {
  if (/^\s*(?:300|200):\s/m.test(html) && /^201:\s/m.test(html)) {
    const seen = new Map()
    for (const e of parseHttpIndex(html, dirUrl)) if (!seen.has(e.url)) seen.set(e.url, e)
    return [...seen.values()]
  }
  const out = new Map()
  const add = (e) => { if (e && !out.has(e.url)) out.set(e.url, e) }
  for (const m of html.matchAll(/addRow\("((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)",(\d)/g)) {
    add(child(unescapeJs(m[2]), dirUrl, m[3] === "1"))
  }
  if (!out.size) {
    for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const href = unescapeHtml(m[1] ?? m[2])
      if (!href || href[0] === "#" || href[0] === "?") continue
      add(child(href, dirUrl))
    }
  }
  return [...out.values()]
}

// A real listing names the document being read; an ordinary page that merely has links does not.
export function isListingOf(entries, currentUrl) {
  try {
    const here = decodeURIComponent(new URL(strip(currentUrl)).pathname.split("/").pop())
    return entries.some((e) => !e.dir && e.name === here)
  } catch {
    return false
  }
}

// What the panel shows: folders then .md files, hidden names left out.
export function visibleEntries(entries) {
  return entries
    .filter((e) => !e.name.startsWith(".") && (e.dir || MD.test(e.name)))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) : a.dir ? -1 : 1))
}

// Other .md documents the page links to, for sites that offer no listing.
export function linkedDocuments(article, currentUrl) {
  const here = new URL(strip(currentUrl))
  const seen = new Map()
  for (const a of article.querySelectorAll("a[href]")) {
    let u
    try { u = new URL(a.getAttribute("href"), here) } catch { continue }
    u.hash = ""
    u.search = ""
    if (u.origin !== here.origin || u.protocol !== here.protocol || !MD.test(u.pathname) || u.href === here.href) continue
    if (seen.has(u.href)) continue
    let name = u.pathname.split("/").pop()
    try { name = decodeURIComponent(name) } catch { /* keep */ }
    seen.set(u.href, { name, url: u.href, dir: false })
  }
  return [...seen.values()]
}

// The folder above a folder URL (the same URL at the top), and a folder's name for the panel's path line.
export function parentDirOf(dirUrl) {
  return new URL("../", dirUrl).href
}

export function folderName(dirUrl) {
  const u = new URL(dirUrl)
  const last = u.pathname.split("/").filter(Boolean).pop()
  if (!last) return u.protocol === "file:" ? "/" : u.host
  try { return decodeURIComponent(last) } catch { return last }
}

// A folder's full path for a tooltip: the file path, or the URL without its scheme noise for a site.
export function fullPath(dirUrl) {
  const u = new URL(dirUrl)
  let p = u.pathname
  try { p = decodeURIComponent(p) } catch { /* keep encoded */ }
  return u.protocol === "file:" ? p : `${u.host}${p}`
}

// Folders between `root` and `dir` (both folder URLs, dir at or below root), nearest the root first, `dir` included.
export function foldersBetween(root, dir) {
  if (!dir.startsWith(root)) return []
  const out = []
  let at = root
  for (const seg of dir.slice(root.length).split("/").filter(Boolean)) {
    at += seg + "/"
    out.push(at)
  }
  return out
}

// The background script lists file: folders (names only) for a .md page of ours; it never reads other file contents.
export function listingAllowed(dirUrl, senderUrl) {
  try {
    const dir = new URL(strip(dirUrl))
    const from = new URL(strip(senderUrl))
    return dir.protocol === "file:" && from.protocol === "file:" && MD.test(from.pathname) && dir.pathname.endsWith("/")
  } catch {
    return false
  }
}
