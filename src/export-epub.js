// EPUB 3 from the document model: one XHTML chapter with a navigation list built from the headings, plus its pictures.
import { zipStore } from "./zip.js"
import { esc } from "./export-docx.js"

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/svg+xml": "svg" }

export function buildEpub(blocks, { title = "Document", language = "en", id = "urn:uuid:" + crypto.randomUUID(), now = new Date() } = {}) {
  const images = []
  const headings = []

  const run = (r) => {
    if (r.br) return "<br/>"
    if (r.image) {
      const ext = EXT[r.image.mime]
      if (!ext) return ""
      const n = images.length + 1
      const name = `images/img-${n}.${ext}`
      images.push({ name, mime: r.image.mime, bytes: r.image.bytes })
      // a drawing is its PNG only: readers such as Calibre show <picture> as a broken image, even its fallback
      return `<img src="${name}" alt="${esc(r.image.alt || "")}"/>`
    }
    let t = esc(r.text)
    if (r.code) t = `<code>${t}</code>`
    if (r.bold) t = `<strong>${t}</strong>`
    if (r.italic) t = `<em>${t}</em>`
    if (r.strike) t = `<del>${t}</del>`
    if (r.sup) t = `<sup>${t}</sup>`
    if (r.sub) t = `<sub>${t}</sub>`
    if (r.link) t = `<a href="${esc(r.link)}">${t}</a>`
    return t
  }
  const runs = (rs) => rs.map(run).join("")
  const block = (b) => {
    switch (b.t) {
      case "h": {
        const level = Math.min(b.level, 6)
        const hid = `h${headings.length + 1}`
        headings.push({ id: hid, level, text: b.runs.map((r) => r.text || "").join("") })
        return `<h${level} id="${hid}">${runs(b.runs)}</h${level}>`
      }
      case "p": return `<p>${runs(b.runs)}</p>`
      case "code": return `<pre><code>${esc(b.text)}</code></pre>`
      case "hr": return "<hr/>"
      case "quote": return `<blockquote>${b.blocks.map(block).join("")}</blockquote>`
      case "list": return `<${b.ordered ? "ol" : "ul"}>${b.items.map((item) => `<li>${item.map((x) => (x.t === "p" && item.length === 1 ? runs(x.runs) : block(x))).join("")}</li>`).join("")}</${b.ordered ? "ol" : "ul"}>`
      case "table": return `<table>${b.rows.map((row) => `<tr>${row.map((c) => `<${c.header ? "th" : "td"}>${runs(c.runs)}</${c.header ? "th" : "td"}>`).join("")}</tr>`).join("")}</table>`
      default: return ""
    }
  }
  const body = blocks.map(block).join("\n")
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}"><head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>\n${body}\n</body></html>`
  const css = "body{line-height:1.5}pre{white-space:pre-wrap;font-size:.85em;background:#f3f4f6;padding:.5em}code{font-family:monospace}blockquote{margin-left:1em;padding-left:.8em;border-left:3px solid #bbb;color:#555}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.2em .5em}th{background:#eee}img{max-width:100%}"

  // the navigation list nests by heading level
  const tree = { children: [] }
  const stack = [{ level: 0, node: tree }]
  for (const h of headings) {
    while (stack.at(-1).level >= h.level) stack.pop()
    const node = { h, children: [] }
    stack.at(-1).node.children.push(node)
    stack.push({ level: h.level, node })
  }
  const list = (n) => (n.children.length ? `<ol>${n.children.map((c) => `<li><a href="chapter.xhtml#${c.h.id}">${esc(c.h.text)}</a>${list(c)}</li>`).join("")}</ol>` : "")
  const nav = list(tree) || `<ol><li><a href="chapter.xhtml">${esc(title)}</a></li></ol>`
  const navDoc = `<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}"><head><meta charset="utf-8"/><title>${esc(title)}</title></head><body><nav epub:type="toc" id="toc"><h1>${esc(title)}</h1>${nav}</nav></body></html>`
  const stamp = now.toISOString().replace(/\.\d+Z$/, "Z")
  const opf = `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${language}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${esc(id)}</dc:identifier><dc:title>${esc(title)}</dc:title><dc:language>${language}</dc:language><dc:creator>mt-md</dc:creator><meta property="dcterms:modified">${stamp}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/>${images.map((im, i) => `<item id="img${i + 1}" href="${im.name}" media-type="${im.mime}"/>`).join("")}</manifest><spine><itemref idref="chapter"/></spine></package>`
  const container = `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  return zipStore([
    { name: "mimetype", data: "application/epub+zip" }, // first and stored
    { name: "META-INF/container.xml", data: container },
    { name: "OEBPS/content.opf", data: opf },
    { name: "OEBPS/nav.xhtml", data: navDoc },
    { name: "OEBPS/chapter.xhtml", data: xhtml },
    { name: "OEBPS/style.css", data: css },
    ...images.map((im) => ({ name: `OEBPS/${im.name}`, data: im.bytes })),
  ])
}
