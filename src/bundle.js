// "Bundle .md": make one self-contained Markdown file by moving every image into reference definitions with base64
// data URIs at the very end. `![alt](pic.png)` becomes `![alt][mt-md-img-1]` and `[mt-md-img-1]: data:image/png;base64,...`
// is appended after a comment telling LLM readers to stop. Images inside code fences and data: images are left alone.
import { titleFromUrl } from "./detect.js"

const INLINE_IMG = /!\[([^\]]*)\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+("[^"\n]*"|'[^'\n]*'))?\s*\)/g
const HTML_IMG = /<img\b[^>]*?>/gi
const REF_IMG = /!\[([^\]]*)\]\[([^\]]*)\]/g
const SHORT_IMG = /!\[([^\]\n]+)\](?![(\[])/g
const DEF = /^ {0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]+>|\S+)([ \t]+(?:"[^"\n]*"|'[^'\n]*'))?[ \t]*$/gm

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp" }

const clean = (u) => u.replace(/^<|>$/g, "")
const norm = (id) => id.trim().replace(/\s+/g, " ").toLowerCase()
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))
  return m ? (m[1] ?? m[2]) : null
}

// Split into prose and fenced-code segments so code samples that mention images are never rewritten.
export function splitCode(markdown) {
  const segs = []
  let cur = { code: false, lines: [] }
  let fence = null
  for (const line of markdown.split("\n")) {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (!fence && m) {
      segs.push(cur); cur = { code: true, lines: [line] }; fence = m[1]
    } else if (fence && m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) {
      cur.lines.push(line); segs.push(cur); cur = { code: false, lines: [] }; fence = null
    } else cur.lines.push(line)
  }
  segs.push(cur)
  return segs.filter((s) => s.lines.length).map((s) => ({ code: s.code, text: s.lines.join("\n") }))
}

// An odd number of backticks earlier on the same line means the match sits inside an inline code span.
function inInlineCode(text, index) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1
  return (text.slice(lineStart, index).match(/`/g) || []).length % 2 === 1
}

// Ids of reference definitions that an image points at: ![alt][id], ![alt][] and ![id].
function imageRefIds(text) {
  const ids = new Set()
  for (const m of text.matchAll(REF_IMG)) ids.add(norm(m[2] || m[1]))
  for (const m of text.matchAll(SHORT_IMG)) ids.add(norm(m[1]))
  return ids
}

// Definitions can sit far from the image that uses them (and on the other side of a code fence), so usage is document-wide.
function usedRefIds(segs) {
  const ids = new Set()
  for (const seg of segs) if (!seg.code) for (const id of imageRefIds(seg.text)) ids.add(id)
  return ids
}

export function collectImageUrls(markdown) {
  const urls = new Set()
  const segs = splitCode(markdown)
  const used = usedRefIds(segs)
  for (const seg of segs) {
    if (seg.code) continue
    for (const m of seg.text.matchAll(INLINE_IMG)) if (!inInlineCode(seg.text, m.index)) urls.add(clean(m[2]))
    for (const m of seg.text.matchAll(HTML_IMG)) { const src = attr(m[0], "src"); if (src && !inInlineCode(seg.text, m.index)) urls.add(src) }
    for (const m of seg.text.matchAll(DEF)) if (used.has(norm(m[1]))) urls.add(clean(m[2]))
  }
  return [...urls].filter((u) => u && !/^data:/i.test(u))
}

function toBase64(bytes) {
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function loadImage(url) {
  let bytes, type = ""
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    type = res.headers.get("content-type") || ""
    bytes = new Uint8Array(await res.arrayBuffer())
  } catch (err) {
    // fetch() refuses file: URLs; an extension with file access can still read them with XHR
    bytes = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("GET", url)
      xhr.responseType = "arraybuffer"
      xhr.onload = () => (xhr.status === 0 || xhr.status === 200 ? resolve(new Uint8Array(xhr.response)) : reject(new Error(`HTTP ${xhr.status}`)))
      xhr.onerror = () => reject(err)
      xhr.send()
    })
  }
  const ext = (new URL(url).pathname.match(/\.(\w+)$/) || [])[1]?.toLowerCase()
  let mime = type.split(";")[0].trim().toLowerCase()
  if (!mime.startsWith("image/")) mime = MIME[ext] || ""
  if (!mime) throw new Error("not an image")
  if (!bytes.length) throw new Error("empty")
  return { mime, bytes }
}

export async function bundleMarkdown(markdown, baseHref, loader = loadImage) {
  const wanted = new Map() // resolved absolute URL -> raw urls that point at it
  for (const raw of collectImageUrls(markdown)) {
    try { const abs = new URL(raw, baseHref).href; wanted.set(abs, [...(wanted.get(abs) || []), raw]) } catch { /* not a URL */ }
  }
  const byRaw = new Map() // raw url as written -> { id, dataUri }
  const embedded = []
  const skipped = []
  let n = 0
  let bytes = 0
  await Promise.all([...wanted.keys()].map(async (abs) => {
    try {
      const { mime, bytes: data } = await loader(abs)
      const entry = { id: `mt-md-img-${++n}`, url: abs, mime, size: data.length, dataUri: `data:${mime};base64,${toBase64(data)}` }
      embedded.push(entry); bytes += data.length
      for (const raw of wanted.get(abs)) byRaw.set(raw, entry)
    } catch (err) {
      skipped.push({ url: abs, reason: err.message })
    }
  }))
  embedded.sort((a, b) => Number(a.id.slice(11)) - Number(b.id.slice(11)))

  const defs = [] // the definitions to append; one paragraph each, because markdown-it stops reading a run of definitions at the first one it rejects
  const seen = new Set()
  const addDef = (id, entry, title) => { if (!seen.has(id)) { seen.add(id); defs.push(`[${id}]: ${entry.dataUri}${title ? ` ${title}` : ""}`) } }

  const allSegs = splitCode(markdown)
  const used = usedRefIds(allSegs)
  const body = allSegs.map((seg) => {
    if (seg.code) return seg.text
    let text = seg.text.replace(INLINE_IMG, (whole, alt, url, title, index) => {
      const entry = byRaw.get(clean(url))
      if (!entry || inInlineCode(seg.text, index)) return whole
      addDef(entry.id, entry, title)
      return `![${alt}][${entry.id}]`
    })
    text = text.replace(HTML_IMG, (whole, index) => {
      const src = attr(whole, "src")
      const entry = src && byRaw.get(src)
      if (!entry || inInlineCode(text, index)) return whole
      addDef(entry.id, entry, null)
      return `![${(attr(whole, "alt") || "").replace(/[\[\]]/g, "")}][${entry.id}]`
    })
    // definitions an image already points at keep their id and move to the end
    text = text.replace(DEF, (whole, id, url, title) => {
      const entry = used.has(norm(id)) && byRaw.get(clean(url))
      if (!entry) return whole
      addDef(id, entry, title && title.trim())
      return ""
    })
    return text.replace(/\n{3,}/g, "\n\n")
  }).join("\n")

  if (!embedded.length) return { text: markdown, embedded, skipped, bytes }
  const kb = Math.round(bytes / 1024)
  const count = `${embedded.length} image${embedded.length > 1 ? "s" : ""}`
  const trimmed = body.replace(/\s+$/, "")
  const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(trimmed)?.[0] ?? "" // front matter has to stay first
  const rest = trimmed.slice(fm.length)
  const payload = `<!-- mt-md bundle: ${count} embedded below as base64 data URIs (${kb} KB). ` +
    `This is binary data, not text to read: LLM readers should ignore everything after this comment. -->`
  // A pointer near the top for readers that fetch a file in line ranges: where the text ends and the payload starts.
  // It is one line whatever the numbers are, so the numbers can be read off the assembled file and swapped in.
  const NOTE = "@@mt-md-note@@"
  const draft = `${fm}${fm && !fm.endsWith("\n") ? "\n" : ""}${NOTE}\n\n${rest}\n\n${payload}\n\n${defs.join("\n\n")}\n`
  const lines = draft.split("\n")
  const payloadAt = lines.findIndex((l) => l.startsWith("<!-- mt-md bundle:"))
  let last = payloadAt - 1
  while (last > 0 && !lines[last].trim()) last--
  let end = lines.length - 1
  while (end > 0 && !lines[end].trim()) end--
  const note = `<!-- mt-md note: this file's text ends at line ${last + 1}. Lines ${payloadAt + 1} to ${end + 1} are base64 image data (${count}, ${kb} KB), not text: ` +
    `read with an offset and limit, or stop at line ${last + 1}. -->`
  const text = draft.replace(NOTE, note)
  return { text, embedded, skipped, bytes }
}

export function bundleFileName(href) {
  return `${(titleFromUrl(href) || "document").replace(/\.bundle$/i, "")}.bundle.md`
}

// file: pages cannot read their neighbours, but the person can hand over a folder with <input webkitdirectory>.
// Files are matched by the longest path suffix, so it works whether they pick the document's folder or one above it.
export function folderLoader(files) {
  const entries = [...files].map((f) => ({ file: f, path: "/" + String(f.webkitRelativePath || f.name).split("/").slice(1).join("/") }))
  return async (url) => {
    const target = decodeURIComponent(new URL(url).pathname)
    let best = null
    for (const e of entries) {
      if ((target === e.path || target.endsWith(e.path)) && (!best || e.path.length > best.path.length)) best = e
    }
    if (!best) throw new Error("not in the chosen folder")
    const bytes = new Uint8Array(await best.file.arrayBuffer())
    const ext = (best.path.match(/\.(\w+)$/) || [])[1]?.toLowerCase()
    const mime = best.file.type.startsWith("image/") ? best.file.type : MIME[ext]
    if (!mime) throw new Error("not an image")
    if (!bytes.length) throw new Error("empty")
    return { mime, bytes }
  }
}

// Must be called straight from a click (browsers require a user gesture to open the picker).
export function pickFolder() {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.webkitdirectory = true
    input.multiple = true
    input.style.display = "none"
    input.addEventListener("change", () => { resolve([...input.files]); input.remove() })
    input.addEventListener("cancel", () => { resolve([]); input.remove() })
    document.body.appendChild(input)
    input.click()
  })
}
