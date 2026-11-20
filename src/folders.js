// "Only these folders": an optional list of local folders. Empty means every local .md file, as before.
// A folder is kept as the path part of its file: URL, with a trailing slash ("/home/me/notes/", "/C:/Users/me/notes/"),
// and matches every document beneath it.
export const FOLDERS_KEY = "mt-md-folders"

// Accepts a path as people type it ("/home/me/notes", "C:\\Users\\me\\notes", "~/x" is not expanded) or a file: URL.
export function normalizeFolder(input) {
  let text = String(input || "").trim()
  if (!text) return ""
  if (/^file:/i.test(text)) {
    try { text = decodeURIComponent(new URL(text).pathname) } catch { return "" }
  } else {
    text = text.replace(/\\/g, "/")
    if (/^[A-Za-z]:\//.test(text)) text = "/" + text // Windows drive: C:/x -> /C:/x
    if (text.startsWith("~")) return "" // the browser cannot expand a home folder; ask for the full path
  }
  if (!text.startsWith("/")) return ""
  text = text.replace(/\/{2,}/g, "/")
  if (!text.endsWith("/")) text += "/"
  return text
}

export function parseFolderList(text) {
  const out = []
  const bad = []
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue
    const f = normalizeFolder(line)
    if (f) { if (!out.includes(f)) out.push(f) } else bad.push(line.trim())
  }
  return { folders: out, rejected: bad }
}

// The folder that holds a document ("file:///home/me/notes/a.md" -> "/home/me/notes/").
export function folderOfUrl(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== "file:") return ""
    return decodeURIComponent(u.pathname).replace(/[^/]*$/, "")
  } catch {
    return ""
  }
}

// Is this file: URL allowed? No list means everything is.
export function folderAllowed(url, folders) {
  if (!Array.isArray(folders) || !folders.length) return true
  const here = folderOfUrl(url)
  if (!here) return true // not a file: page; this setting is only about local files
  const sameCase = (a, b) => (/^\/[A-Za-z]:\//.test(a) ? a.toLowerCase().startsWith(b.toLowerCase()) : a.startsWith(b)) // drive paths are case-insensitive
  return folders.some((f) => sameCase(here, f))
}
