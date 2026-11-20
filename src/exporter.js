// Export: the one tool that replaces "Download". It makes the current document as a Markdown bundle, HTML, Word or OpenDocument
// file, or hands it to the print dialog for PDF. Where the file goes and the format are remembered (Settings, gear on the Export row).
import { bundleFileName } from "./bundle.js"
import { titleFromUrl } from "./detect.js"
import { domToModel } from "./docmodel.js"
import { buildDocx, esc as escapeHtml } from "./export-docx.js"
import { buildOdt } from "./export-odt.js"
import { buildRtf } from "./export-rtf.js"
import { buildEpub } from "./export-epub.js"
import { buildText } from "./export-text.js"
import { zipStore } from "./zip.js"
import { DEFAULT_FOLDER, cleanFolder, MAX_SAVE_BYTES } from "./savepath.js"

export const EXPORT_KEY = "mt-md-export"

export const FORMATS = [
  { id: "md", label: "Markdown, images embedded (.md)", short: "Markdown (.md) with images embedded", mime: "text/markdown", ext: "md" },
  { id: "html", label: "HTML page (.html)", short: "an HTML page", mime: "text/html", ext: "html" },
  { id: "docx", label: "Word (.docx)", short: "a Word document (.docx)", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  { id: "odt", label: "OpenDocument text (.odt)", short: "an OpenDocument text file (.odt)", mime: "application/vnd.oasis.opendocument.text", ext: "odt" },
  { id: "doc", label: "Word 97-2003 (.doc)", short: "a Word 97-2003 document (.doc)", mime: "application/msword", ext: "doc" },
  { id: "rtf", label: "Rich Text (.rtf)", short: "a Rich Text document (.rtf)", mime: "application/rtf", ext: "rtf" },
  { id: "epub", label: "EPUB e-book (.epub)", short: "an EPUB e-book (.epub)", mime: "application/epub+zip", ext: "epub" },
  { id: "txt", label: "Plain text (.txt)", short: "a plain text file (.txt)", mime: "text/plain", ext: "txt" },
  { id: "pdf", label: "PDF (through the print dialog)", short: "a PDF through the print dialog", mime: "application/pdf", ext: "pdf" },
]
export const IMAGE_MODES = [
  { id: "embed", label: "Embedded in the page", short: "images embedded" },
  { id: "link", label: "Linked, using their original addresses", short: "images linked" },
  { id: "files", label: "Separate files, zipped with the page", short: "images as separate files in a .zip" },
  { id: "omit", label: "Left out (text only)", short: "no images" },
]
export const WHERE = [
  { id: "downloads", label: "Downloads folder", short: "your Downloads folder" },
  { id: "folder", label: "A folder inside Downloads", short: "a folder inside Downloads" },
  { id: "ask", label: "Ask me each time", short: "wherever you choose" },
]
const NAMES = { md: "Markdown", txt: "plain text" }
export const DEFAULT_EXPORT = { format: "md", images: "embed", where: "downloads", folder: DEFAULT_FOLDER }

const pick = (list, id, fallback) => (list.some((x) => x.id === id) ? id : fallback)
export function normalizeExport(v) {
  const o = v && typeof v === "object" ? v : {}
  return { format: pick(FORMATS, o.format, DEFAULT_EXPORT.format), images: pick(IMAGE_MODES, o.images, DEFAULT_EXPORT.images), where: pick(WHERE, o.where, DEFAULT_EXPORT.where), folder: cleanFolder(o.folder) || DEFAULT_FOLDER }
}
export const isDefaultExport = (s) => JSON.stringify(normalizeExport(s)) === JSON.stringify(DEFAULT_EXPORT)

// The words for the button's tooltip and accessible name, so both say what a click will do.
export function describeExport(settings) {
  const s = normalizeExport(settings)
  const f = FORMATS.find((x) => x.id === s.format)
  if (s.format === "pdf") return { label: "Export as PDF", title: "Export as a PDF: opens the print dialog, where you choose Save as PDF" }
  const images = s.format === "html" ? `, ${IMAGE_MODES.find((x) => x.id === s.images).short}` : ""
  const where = s.where === "folder" ? `the "${s.folder}" folder inside Downloads` : WHERE.find((x) => x.id === s.where).short
  return { label: `Export as ${NAMES[f.id] || f.id.toUpperCase()}`, title: `Export as ${f.short}${images}, saved to ${where}` }
}

export function exportFileName(settings, href) {
  const s = normalizeExport(settings)
  if (s.format === "md") return bundleFileName(href)
  const base = (titleFromUrl(href) || "document").replace(/\.(bundle\.)?(md|markdown|mdown|mkd)$/i, "")
  if (s.format === "html" && s.images === "files") return `${base}.html.zip`
  return `${base}.${FORMATS.find((x) => x.id === s.format).ext}`
}

// ---- images ------------------------------------------------------------------------------------------------------------------

export function toBase64(bytes) {
  let s = ""
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromDataUri = (uri) => {
  const m = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/s.exec(uri)
  if (!m) return null
  const bytes = /;base64/i.test(m[2]) ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]))
  return { mime: m[1].toLowerCase(), bytes }
}
const IMG_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif", "image/bmp": "bmp" }

// bytes of one image, from a data: address or through `load(url)` (which may throw); null when it cannot be read
async function readImage(url, load, failed) {
  if (url.startsWith("data:")) return fromDataUri(url)
  try { return await load(url) } catch { failed?.push(url); return null }
}

// A standalone copy of an inline <svg> (with the page's background behind it, so it reads the same as its PNG), or null when it
// uses <foreignObject> (HTML inside the drawing), which readers and Word-style programs cannot draw.
export function svgText(el, backdrop) {
  const copy = el.cloneNode(true)
  if (copy.querySelector("foreignObject")) return null
  const box = el.getBoundingClientRect?.() || {}
  const w = Math.round(box.width || 0), h = Math.round(box.height || 0)
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  if (w && h) { copy.setAttribute("width", w); copy.setAttribute("height", h) }
  copy.style.color = getComputedStyle(el).color
  const rect = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect")
  rect.setAttribute("width", "100%"); rect.setAttribute("height", "100%"); rect.setAttribute("fill", backdrop || "#ffffff")
  copy.insertBefore(rect, copy.firstChild)
  return new XMLSerializer().serializeToString(copy)
}

// <img> and inline <svg> to a PNG the Word-style writers can place; null in places without a canvas (tests, odd pages)
async function rasterize(el, backdrop, scale = 2) {
  try {
    const box = el.getBoundingClientRect?.() || {}
    const w = Math.round(box.width || el.naturalWidth || 0), h = Math.round(box.height || el.naturalHeight || 0)
    if (!w || !h) return null
    let source = el
    if (el.tagName === "svg") {
      const copy = el.cloneNode(true)
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg")
      copy.setAttribute("width", w); copy.setAttribute("height", h)
      copy.style.color = getComputedStyle(el).color
      const img = new Image()
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy))
      await img.decode()
      source = img
    }
    const canvas = document.createElement("canvas")
    canvas.width = w * scale; canvas.height = h * scale
    const g = canvas.getContext("2d")
    g.fillStyle = backdrop || "#ffffff"
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"))
    return { mime: "image/png", bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h }
  } catch {
    return null
  }
}

// ---- HTML --------------------------------------------------------------------------------------------------------------------

const SIMPLE_CSS = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4;color:#1a1a2e}
h1{font-size:22pt}h2{font-size:17pt}h3{font-size:14pt}h4,h5,h6{font-size:12pt}
pre,code{font-family:Consolas,'Courier New',monospace;font-size:9.5pt;background:#f3f4f6}
pre{padding:6pt;white-space:pre-wrap}
blockquote{margin-left:12pt;padding-left:8pt;border-left:3pt solid #bbbbbb;color:#555555}
table{border-collapse:collapse}td,th{border:1pt solid #bbbbbb;padding:3pt 6pt}th{background:#eeeeee}
img{max-width:100%}`


// The rendered document (`doc` is the .mt-md-doc element) as one page. images: embed | link | files | omit.
// Returns { html, files } where files are { name, bytes } for the "files" mode (and for the Word-style package).
export async function buildHtml({ doc, title, css, dark = false, rootStyle = "", images = "embed", load, failed, rasterizeSvg = null }) {
  const live = [...doc.querySelectorAll("img")]
  const clone = doc.cloneNode(true)
  for (const b of clone.querySelectorAll(".mt-md-copy, button, script, #mt-md-toc")) b.remove() // the contents/files column is page furniture
  const files = []
  const used = new Set()
  const cloneImgs = [...clone.querySelectorAll("img")]
  for (let i = 0; i < cloneImgs.length; i++) {
    const img = cloneImgs[i]
    const url = live[i]?.src || img.src
    if (images === "omit") {
      const alt = img.getAttribute("alt")
      img.replaceWith(Object.assign(clone.ownerDocument.createElement("span"), { textContent: alt ? `[${alt}]` : "" }))
    } else if (images === "link") {
      if (!url.startsWith("data:")) img.setAttribute("src", url)
    } else {
      const got = await readImage(url, load, failed)
      if (!got) { if (!url.startsWith("data:")) img.setAttribute("src", url); continue }
      if (images === "embed") img.setAttribute("src", `data:${got.mime};base64,${toBase64(got.bytes)}`)
      else {
        const ext = IMG_EXT[got.mime] || "img"
        const name = `images/img-${files.length + 1}.${ext}`
        files.push({ name, bytes: got.bytes })
        img.setAttribute("src", name)
      }
      img.removeAttribute("srcset")
    }
  }
  if (rasterizeSvg) {
    // Word-style pages cannot show inline <svg>: swap each for a PNG
    const liveSvgs = [...doc.querySelectorAll("svg")]
    const cloneSvgs = [...clone.querySelectorAll("svg")]
    for (let i = 0; i < cloneSvgs.length; i++) {
      const got = await rasterizeSvg(liveSvgs[i])
      if (!got) { cloneSvgs[i].remove(); continue }
      const name = `images/diagram-${files.length + 1}.png`
      files.push({ name, bytes: got.bytes })
      const img = clone.ownerDocument.createElement("img")
      img.setAttribute("src", name); img.setAttribute("width", got.width); img.setAttribute("height", got.height); img.setAttribute("alt", "diagram")
      cloneSvgs[i].replaceWith(img)
    }
  }
  const body = `<div id="mt-md-root"${rootStyle ? ` style="${escapeHtml(rootStyle)}"` : ""}>${clone.outerHTML}</div>`
  const html = `<!doctype html>\n<html lang="en"${dark ? ' class="mt-md-dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="mt-md"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${body}</body></html>\n`
  return { html, files }
}

// Word and LibreOffice open a web archive (MHTML) named .doc: the page and its pictures in one file.
export function buildMhtml(html, files) {
  const wrap = (b64) => b64.replace(/.{1,76}/g, "$&\r\n")
  const boundary = "----=_mt_md_" + Math.random().toString(36).slice(2)
  const word = html.replace("<html ", '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" ')
  const parts = [`Content-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: document.htm\r\n\r\n${wrap(toBase64(new TextEncoder().encode(word)))}`]
  for (const f of files) {
    const mime = Object.entries(IMG_EXT).find(([, e]) => f.name.endsWith("." + e))?.[0] || "application/octet-stream"
    parts.push(`Content-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${f.name}\r\n\r\n${wrap(toBase64(f.bytes))}`)
  }
  return `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${boundary}"; type="text/html"\r\n\r\n` + parts.map((p) => `--${boundary}\r\n${p}`).join("\r\n") + `\r\n--${boundary}--\r\n`
}

// ---- the file ----------------------------------------------------------------------------------------------------------------

// env: { doc, title, css, dark, rootStyle, load(url), failed: [], backdrop }  ->  { blob, name }
export async function produce(settings, env) {
  const s = normalizeExport(settings)
  const fmt = FORMATS.find((x) => x.id === s.format)
  const name = exportFileName(s, env.href)
  if (s.format === "html") {
    const { html, files } = await buildHtml({ doc: env.doc, title: env.title, css: env.css, dark: env.dark, rootStyle: env.rootStyle, images: s.images, load: env.load, failed: env.failed })
    if (s.images === "files") return { name, blob: new Blob([zipStore([{ name: name.replace(/\.zip$/, ""), data: html }, ...files.map((f) => ({ name: f.name, data: f.bytes }))])], { type: "application/zip" }) }
    return { name, blob: new Blob([html], { type: "text/html;charset=utf-8" }) }
  }
  if (s.format === "doc") {
    const { html, files } = await buildHtml({ doc: env.doc, title: env.title, css: SIMPLE_CSS, images: "files", load: env.load, failed: env.failed, rasterizeSvg: (svg) => rasterize(svg, env.backdrop) })
    return { name, blob: new Blob([buildMhtml(html, files)], { type: "application/msword" }) }
  }
  // the other formats go through the document model, with every picture as bytes
  const vectorFormat = s.format === "odt" || s.format === "epub" // these carry the drawing itself, with a PNG for readers that cannot show it
  const image = async (el) => {
    if (s.format === "txt") return null // no pictures in plain text: the alt text stands in
    if (el.tagName === "svg") {
      const png = await rasterize(el, env.backdrop)
      const svg = vectorFormat ? svgText(el, env.backdrop) : null
      return png ? (svg ? { ...png, svg } : png) : null
    }
    const got = await readImage(el.src, env.load, env.failed)
    if (!got) return null
    const size = { width: el.naturalWidth || el.width || 300, height: el.naturalHeight || el.height || 200 }
    if (got.mime === "image/svg+xml" && vectorFormat) {
      const png = await rasterize(el, env.backdrop)
      const svg = new TextDecoder().decode(got.bytes)
      if (png) return { ...png, svg }
      return s.format === "epub" ? { ...got, ...size } : null // an e-reader can still show the SVG on its own
    }
    const direct = s.format === "epub" ? ["image/png", "image/jpeg", "image/gif"] : s.format === "rtf" ? ["image/png", "image/jpeg"] : ["image/png", "image/jpeg", "image/gif", "image/bmp"]
    if (direct.includes(got.mime)) return { ...got, ...size }
    return rasterize(el, env.backdrop) // webp, avif, svg for the others: a PNG redrawn from the page's own copy
  }
  const blocks = await domToModel(env.doc, { image })
  const opts = { title: env.title }
  const out = { docx: () => buildDocx(blocks, opts), odt: () => buildOdt(blocks, opts), rtf: () => buildRtf(blocks, opts), epub: () => buildEpub(blocks, opts), txt: () => buildText(blocks) }[s.format]()
  return { name, blob: new Blob([out], { type: s.format === "txt" ? "text/plain;charset=utf-8" : fmt.mime }) }
}

// Saves the file. "Downloads folder" is an ordinary download from the page. A folder inside Downloads, or the Save as dialog, go
// through the extension's downloads permission (the background script), and fall back to an ordinary download if that is unavailable.
export async function saveBlob(blob, name, settings, fmt) {
  const s = normalizeExport(settings)
  const api = globalThis.browser ?? globalThis.chrome
  if (s.where !== "downloads" && api?.runtime?.sendMessage && blob.size <= MAX_SAVE_BYTES) {
    try {
      const base64 = toBase64(new Uint8Array(await blob.arrayBuffer()))
      const r = await api.runtime.sendMessage({ type: "mt-md-save", name, mime: blob.type || fmt.mime, base64, where: s.where, folder: s.folder })
      if (r?.ok) return "saved"
      if (r?.cancelled) return "cancelled"
    } catch { /* fall through to a plain download */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return s.where === "downloads" ? "downloaded" : "downloaded-fallback"
}
