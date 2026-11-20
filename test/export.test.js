import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import "./setup-window.js"
import { zipStore, crc32 } from "../src/zip.js"
import { produce, svgText, FORMATS, normalizeExport, describeExport, exportFileName, DEFAULT_EXPORT, buildHtml, buildMhtml, isDefaultExport } from "../src/exporter.js"
import { domToModel } from "../src/docmodel.js"
import { buildDocx } from "../src/export-docx.js"
import { buildOdt } from "../src/export-odt.js"
import { buildRtf, rtfEscape } from "../src/export-rtf.js"
import { buildEpub } from "../src/export-epub.js"
import { buildText } from "../src/export-text.js"
import { markdownToHtml } from "../src/render.js"
import { mountToolbar } from "../src/toolbar.js"
import { JSDOM } from "jsdom"
function page() { const { window } = new JSDOM("<body></body>", { url: "https://example.test/x.md" }); globalThis.location = window.location; globalThis.document = window.document; return window }

// a 1x1 transparent PNG
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0))
const DATA = "data:image/png;base64," + Buffer.from(PNG).toString("base64")
const SAMPLE = `# Title

Some **bold**, *italic*, \`code\` and a [link](https://example.org/x?a=1&b=2).

- one
- two
  - nested

1. first
2. second

> quoted

| A | B |
|---|---|
| 1 | 2 |

\`\`\`js
const a = 1
  indented()
\`\`\`

![pic](${DATA})
`

function docFrom(md) {
  const doc = document.createElement("div")
  doc.className = "mt-md-doc"
  doc.innerHTML = `<div class="mt-md-article">${markdownToHtml(md)}</div>`
  document.body.replaceChildren(doc)
  return doc
}
const image = async (el) => (el.tagName === "IMG" ? { bytes: PNG, mime: "image/png", width: 1, height: 1 } : null)

function unzip(bytes) {
  const dir = mkdtempSync(path.join(tmpdir(), "mt-md-zip-"))
  const file = path.join(dir, "x.zip")
  writeFileSync(file, bytes)
  try {
    execFileSync("unzip", ["-tq", file], { stdio: "pipe" }) // fails on a bad CRC or directory
    const list = execFileSync("unzip", ["-Z1", file]).toString().trim().split("\n")
    const files = Object.fromEntries(list.map((n) => [n, execFileSync("unzip", ["-p", file, n.replace(/[\[\]]/g, "\\$&")]).toString("utf8")]))
    return { list, read: (n) => files[n] }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}
const wellFormed = (xml, what) => {
  const d = new window.DOMParser().parseFromString(xml, "application/xml")
  assert.equal(d.getElementsByTagName("parsererror").length, 0, `${what} is well-formed XML: ${d.getElementsByTagName("parsererror")[0]?.textContent}`)
  return d
}

test("crc32 matches the standard check value", () => assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926))

test("zipStore writes an archive the unzip tool accepts, in order, with binary intact", () => {
  const z = zipStore([{ name: "mimetype", data: "x" }, { name: "dir/a.txt", data: "héllo" }, { name: "b.bin", data: PNG }])
  const { list, read } = unzip(z)
  assert.deepEqual(list, ["mimetype", "dir/a.txt", "b.bin"])
  assert.equal(read("dir/a.txt"), "héllo")
})

test("export settings: defaults, validation, names and the words for the button", () => {
  assert.deepEqual(normalizeExport(null), DEFAULT_EXPORT)
  assert.deepEqual(DEFAULT_EXPORT, { format: "md", images: "embed", where: "downloads", folder: "mt-md" })
  assert.deepEqual(normalizeExport({ format: "exe", images: "x", where: "/etc" }), DEFAULT_EXPORT)
  assert.ok(isDefaultExport(undefined) && !isDefaultExport({ format: "html" }))
  assert.deepEqual(FORMATS.map((f) => f.id), ["md", "html", "docx", "odt", "doc", "rtf", "epub", "txt", "pdf"])
  assert.match(describeExport(null).title, /Markdown.*images embedded.*Downloads folder/)
  assert.equal(describeExport(null).label, "Export as Markdown")
  assert.match(describeExport({ format: "html", images: "files", where: "ask" }).title, /HTML page, images as separate files in a \.zip, saved to wherever you choose/)
  assert.match(describeExport({ format: "docx" }).title, /Word document \(\.docx\), saved to your Downloads/)
  assert.match(describeExport({ format: "pdf" }).title, /print dialog/)
  assert.equal(describeExport({ format: "txt" }).label, "Export as plain text")
  assert.equal(describeExport({ format: "epub" }).label, "Export as EPUB")
  assert.match(describeExport({ format: "rtf" }).title, /Rich Text document \(\.rtf\), saved to your Downloads/)
  assert.equal(exportFileName({ format: "epub" }, "https://x.test/notes.md"), "notes.epub")
  assert.equal(exportFileName({ format: "txt" }, "https://x.test/notes.md"), "notes.txt")
  assert.equal(exportFileName(null, "https://x.test/a/notes.md"), "notes.bundle.md")
  assert.equal(exportFileName({ format: "html" }, "https://x.test/a/notes.md"), "notes.html")
  assert.equal(exportFileName({ format: "html", images: "files" }, "https://x.test/a/notes.md"), "notes.html.zip")
  assert.equal(exportFileName({ format: "odt" }, "https://x.test/notes.md"), "notes.odt")
})

test("the toolbar's Export button names what a click will do, and the gear changes it", () => {
  const window2 = page()
  let settings = normalizeExport(null)
  const bar = mountToolbar({}, ["bundle"], () => {}, null, null, null, null, { get settings() { return settings }, onChange: (n) => { settings = n } })
  const btn = document.getElementById("mt-md-btn-bundle")
  assert.match(btn.title, /Export as Markdown/)
  assert.equal(btn.getAttribute("aria-label"), "Export as Markdown")
  document.getElementById("mt-md-btn-settings").click()
  const gear = document.getElementById("mt-md-export-gear")
  assert.ok(gear, "the Export row has a gear")
  gear.click()
  const fmt = document.getElementById("mt-md-export-format")
  assert.deepEqual([...fmt.options].map((o) => o.value), ["md", "html", "docx", "odt", "doc", "rtf", "epub", "txt", "pdf"])
  assert.equal(document.getElementById("mt-md-export-images").closest("label").hidden, true, "images only matter for HTML")
  fmt.value = "html"; fmt.dispatchEvent(new window2.Event("change"))
  assert.equal(document.getElementById("mt-md-export-images").closest("label").hidden, false)
  assert.equal(settings.format, "html")
  assert.match(btn.title, /Export as an HTML page, images embedded/)
  assert.equal(btn.getAttribute("aria-label"), "Export as HTML")
  const where = document.getElementById("mt-md-export-where")
  where.value = "ask"; where.dispatchEvent(new window2.Event("change"))
  assert.match(document.getElementById("mt-md-btn-bundle").title, /saved to wherever you choose/)
  bar.remove()
})

test(".docx has the parts Word needs and keeps headings, lists, tables, links and the picture", async () => {
  const blocks = await domToModel(docFrom(SAMPLE), { image })
  const z = unzip(buildDocx(blocks, { title: "T & <x>" }))
  for (const n of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/numbering.xml", "word/_rels/document.xml.rels", "word/media/image1.png"]) assert.ok(z.list.includes(n), n)
  const doc = z.read("word/document.xml")
  wellFormed(doc, "document.xml"); wellFormed(z.read("word/styles.xml"), "styles.xml"); wellFormed(z.read("word/_rels/document.xml.rels"), "rels"); wellFormed(z.read("[Content_Types].xml"), "types"); wellFormed(z.read("word/numbering.xml"), "numbering")
  assert.match(doc, /w:pStyle w:val="Heading1"/)
  assert.match(doc, /<w:b\/>[^]*?bold/)
  assert.match(doc, /<w:hyperlink r:id="rId\d+"/)
  assert.match(z.read("word/_rels/document.xml.rels"), /Target="https:\/\/example\.org\/x\?a=1&amp;b=2" TargetMode="External"/)
  assert.match(doc, /<w:tbl>/); assert.match(doc, /w:pStyle w:val="Code"/); assert.match(doc, /<w:drawing>/)
  assert.match(doc, /w:numId w:val="1"/); assert.match(doc, /w:numId w:val="2"/); assert.match(doc, /w:ilvl w:val="1"/)
  assert.match(z.read("docProps/core.xml"), /T &amp; &lt;x&gt;/)
})

test(".odt starts with its stored mimetype and holds the same content", async () => {
  const blocks = await domToModel(docFrom(SAMPLE), { image })
  const bytes = buildOdt(blocks, { title: "T" })
  assert.equal(new TextDecoder().decode(bytes.subarray(30, 38)), "mimetype", "mimetype is the first entry")
  const z = unzip(bytes)
  assert.equal(z.read("mimetype"), "application/vnd.oasis.opendocument.text")
  for (const n of ["content.xml", "styles.xml", "meta.xml", "META-INF/manifest.xml", "Pictures/img1.png"]) assert.ok(z.list.includes(n), n)
  const content = z.read("content.xml")
  for (const n of ["content.xml", "styles.xml", "meta.xml", "META-INF/manifest.xml"]) wellFormed(z.read(n), n)
  assert.match(content, /<text:h [^>]*text:outline-level="1">/)
  assert.match(content, /<text:a [^>]*xlink:href="https:\/\/example\.org\/x\?a=1&amp;b=2"/)
  assert.match(content, /<text:list text:style-name="LBullet">/); assert.match(content, /<text:list text:style-name="LNum">/)
  assert.match(content, /<table:table /); assert.match(content, /<draw:image xlink:href="Pictures\/img1\.png"/)
  assert.match(content, /Preformatted_20_Text/)
})

test("HTML export: images embedded, linked, as files, or left out", async () => {
  const mk = () => {
    const doc = docFrom("# T\n\n![one](https://img.test/a.png) and ![two](" + DATA + ")\n")
    return doc
  }
  const load = async () => ({ mime: "image/png", bytes: PNG })
  const base = { title: "T", css: "body{}", load }
  const embed = await buildHtml({ ...base, doc: mk(), images: "embed" })
  assert.equal((embed.html.match(/src="data:image\/png;base64,/g) || []).length, 2)
  assert.match(embed.html, /<style>body\{\}<\/style>/); assert.deepEqual(embed.files, [])
  const link = await buildHtml({ ...base, doc: mk(), images: "link" })
  assert.match(link.html, /src="https:\/\/img\.test\/a\.png"/)
  const files = await buildHtml({ ...base, doc: mk(), images: "files" })
  assert.deepEqual(files.files.map((f) => f.name), ["images/img-1.png", "images/img-2.png"])
  assert.match(files.html, /src="images\/img-1\.png"/); assert.ok(!/data:image/.test(files.html))
  const omit = await buildHtml({ ...base, doc: mk(), images: "omit" })
  assert.ok(!/<img/.test(omit.html)); assert.match(omit.html, /\[one\]/)
  const failed = []
  const broken = await buildHtml({ ...base, doc: mk(), images: "embed", load: async () => { throw new Error("no") }, failed })
  assert.match(broken.html, /src="https:\/\/img\.test\/a\.png"/, "an unreadable image keeps its address"); assert.deepEqual(failed, ["https://img.test/a.png"])
  assert.ok(!/<button|<script/.test(embed.html))
})

test("the Word 97-2003 file is a web archive with the page and its pictures", () => {
  const mht = buildMhtml('<!doctype html>\n<html lang="en"><head></head><body><img src="images/img-1.png"></body></html>', [{ name: "images/img-1.png", bytes: PNG }])
  assert.match(mht, /^MIME-Version: 1\.0\r\nContent-Type: multipart\/related; boundary="/)
  assert.match(mht, /Content-Type: image\/png\r\nContent-Transfer-Encoding: base64\r\nContent-Location: images\/img-1\.png/)
  assert.match(mht, /--\r\n$/)
})

test("HTML with images as files comes out as a zip holding the page and the pictures", async () => {
  const doc = docFrom("# T\n\n![one](https://img.test/a.png)\n")
  const { blob, name } = await produce({ format: "html", images: "files" }, { doc, title: "T", css: "", href: "https://x.test/notes.md", load: async () => ({ mime: "image/png", bytes: PNG }), failed: [] })
  assert.equal(name, "notes.html.zip")
  const z = unzip(new Uint8Array(await blob.arrayBuffer()))
  assert.deepEqual(z.list, ["notes.html", "images/img-1.png"])
  assert.match(z.read("notes.html"), /src="images\/img-1\.png"/)
})

test("plain text: underlined headings, list and quote marks, indented code, aligned tables, pictures as their alt text", async () => {
  const blocks = await domToModel(docFrom(SAMPLE), { image: async () => null })
  const t = buildText(blocks)
  assert.match(t, /^Title\n=====\n/)
  assert.match(t, /Some bold, italic, code and a link \(https:\/\/example\.org\/x\?a=1&b=2\)\./)
  assert.match(t, /^- one\n- two\n {2}- nested/m)
  assert.match(t, /^1\. first\n2\. second/m)
  assert.match(t, /^> quoted/m)
  assert.match(t, /^A {2}B\n1 {2}2/m)
  assert.match(t, /^ {4}const a = 1\n {4} {2}indented\(\)/m)
  assert.match(t, /\[pic\]/)
  assert.ok(t.endsWith("\n") && !t.endsWith("\n\n"))
})

test("rtf: escapes what RTF cannot hold, keeps structure, and puts the picture in as hex", async () => {
  assert.equal(rtfEscape("a\\b{c}é€😀"), "a\\\\b\\{c\\}\\u233?\\u8364?\\u-10179?\\u-8704?")
  const rtf = buildRtf(await domToModel(docFrom(SAMPLE), { image }), { title: "Ünï" })
  assert.match(rtf, /^\{\\rtf1\\ansi/)
  assert.ok(rtf.trimEnd().endsWith("}"))
  const depth = [...rtf.replace(/\\[\\{}]/g, "")].reduce((d, c) => (c === "{" ? d + 1 : c === "}" ? d - 1 : d), 0)
  assert.equal(depth, 0, "braces balance")
  assert.match(rtf, /\{\\b bold\}/); assert.match(rtf, /HYPERLINK "https:\/\/example\.org/)
  assert.match(rtf, /\\trowd/); assert.match(rtf, /\\pngblip\\picw1\\pich1/); assert.match(rtf, /\\f1\\fs19 const a = 1/)
  assert.match(rtf, /\\title \\u220\?n\\u239\?\}/)
})

test("epub: mimetype first, a well-formed chapter and navigation list, every picture listed in the manifest", async () => {
  const blocks = await domToModel(docFrom(SAMPLE + "\n## Second\n\n### Third\n"), { image })
  const bytes = buildEpub(blocks, { title: "T & U", id: "urn:uuid:test", now: new Date("2026-01-02T03:04:05.678Z") })
  assert.equal(new TextDecoder().decode(bytes.subarray(30, 38)), "mimetype")
  const z = unzip(bytes)
  assert.equal(z.read("mimetype"), "application/epub+zip")
  for (const n of ["META-INF/container.xml", "OEBPS/content.opf", "OEBPS/nav.xhtml", "OEBPS/chapter.xhtml", "OEBPS/style.css", "OEBPS/images/img-1.png"]) assert.ok(z.list.includes(n), n)
  for (const n of ["META-INF/container.xml", "OEBPS/content.opf", "OEBPS/nav.xhtml", "OEBPS/chapter.xhtml"]) wellFormed(z.read(n), n)
  const opf = z.read("OEBPS/content.opf")
  assert.match(opf, /<dc:title>T &amp; U<\/dc:title>/); assert.match(opf, /dcterms:modified">2026-01-02T03:04:05Z</); assert.match(opf, /href="images\/img-1\.png" media-type="image\/png"/)
  assert.match(opf, /properties="nav"/)
  const nav = z.read("OEBPS/nav.xhtml")
  assert.match(nav, /<li><a href="chapter\.xhtml#h1">Title<\/a><ol><li><a href="chapter\.xhtml#h2">Second<\/a><ol><li><a href="chapter\.xhtml#h3">Third/)
  const ch = z.read("OEBPS/chapter.xhtml")
  assert.match(ch, /<h1 id="h1">Title<\/h1>/); assert.match(ch, /<a href="https:\/\/example\.org\/x\?a=1&amp;b=2">link<\/a>/); assert.match(ch, /<img src="images\/img-1\.png"/); assert.match(ch, /<br\/>|<pre>/)
})

test("the contents and Files column is left out of every export", async () => {
  const doc = docFrom("# T\n\ntext\n")
  doc.insertBefore(Object.assign(document.createElement("nav"), { id: "mt-md-toc", innerHTML: "<ul><li>Files</li><li>README.md (http://x)</li></ul>" }), doc.firstChild)
  assert.ok(!/README/.test(buildText(await domToModel(doc, { image: async () => null }))))
  assert.ok(!/README/.test((await buildHtml({ doc, title: "T", css: "", images: "embed", load: async () => null })).html))
})

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
const vectorBlocks = [{ t: "p", runs: [{ image: { bytes: PNG, mime: "image/png", width: 10, height: 10, alt: "diagram", svg: SVG } }] }]

test("odt: a drawing is carried as SVG with the PNG behind it as the fallback", () => {
  const z = unzip(buildOdt(vectorBlocks, { title: "T" }))
  assert.ok(z.list.includes("Pictures/img1.svg") && z.list.includes("Pictures/img1.png"))
  assert.equal(z.read("Pictures/img1.svg"), SVG)
  const content = z.read("content.xml")
  wellFormed(content, "content.xml")
  assert.match(content, /<draw:image xlink:href="Pictures\/img1\.svg"[^>]*\/><draw:image xlink:href="Pictures\/img1\.png"/, "SVG first, PNG second")
  const manifest = z.read("META-INF/manifest.xml")
  wellFormed(manifest, "manifest")
  assert.match(manifest, /full-path="Pictures\/img1\.svg" manifest:media-type="image\/svg\+xml"/); assert.match(manifest, /full-path="Pictures\/img1\.png" manifest:media-type="image\/png"/)
})

test("epub: a drawing is its PNG as a plain <img> (no <picture>, no SVG file: readers such as Calibre break on it)", () => {
  const z = unzip(buildEpub(vectorBlocks, { title: "T", id: "urn:uuid:t" }))
  assert.ok(z.list.includes("OEBPS/images/img-1.png") && !z.list.some((f) => f.endsWith(".svg")))
  const ch = z.read("OEBPS/chapter.xhtml")
  wellFormed(ch, "chapter")
  assert.match(ch, /<img src="images\/img-1\.png" alt="diagram"\/>/)
  assert.doesNotMatch(ch, /<picture/)
  assert.match(z.read("OEBPS/content.opf"), /href="images\/img-1\.png" media-type="image\/png"/)
})

test("a standalone SVG copy gets the page background behind it, and drawings with HTML inside are not copied", () => {
  globalThis.getComputedStyle = (el) => window.getComputedStyle(el)
  globalThis.XMLSerializer = window.XMLSerializer
  document.body.innerHTML = SVG
  const out = svgText(document.querySelector("svg"), "rgb(26, 26, 46)")
  assert.match(out, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(out, /<rect width="100%" height="100%" fill="rgb\(26, 26, 46\)"\/><circle/)
  document.body.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">html</div></foreignObject></svg>'
  assert.equal(svgText(document.querySelector("svg")), null)
})

test("Copy: four clipboard choices, named on the button, and each makes the right text", async () => {
  const { COPY_FORMATS, normalizeCopy, describeCopy, copyPayload } = await import("../src/copier.js")
  assert.deepEqual(COPY_FORMATS.map((f) => f.id), ["html", "rich", "md", "txt"])
  assert.equal(normalizeCopy({ format: "docx" }).format, "html", "anything else falls back to HTML code")
  assert.equal(describeCopy(null).title, "Copy the page's HTML code to the clipboard")
  assert.equal(describeCopy({ format: "md" }).label, "Copy Markdown")
  const window2 = page()
  const rendered = document.createElement("div")
  rendered.innerHTML = '<nav id="mt-md-toc">Files</nav><h1>Hi</h1><p>one <strong>two</strong> <img alt="pic" src="x.png"></p>'
  const source = "# Hi\n\none **two**\n"
  const html = await copyPayload("html", { rendered, source })
  assert.match(html.text, /<h1>Hi<\/h1>/); assert.doesNotMatch(html.text, /Files/); assert.equal(html.html, undefined)
  const rich = await copyPayload("rich", { rendered, source })
  assert.match(rich.html, /<strong>two<\/strong>/); assert.match(rich.text, /one two/); assert.doesNotMatch(rich.html, /Files/)
  assert.equal((await copyPayload("md", { rendered, source })).text, source)
  const txt = await copyPayload("txt", { rendered, source })
  assert.equal(txt.html, undefined); assert.match(txt.text, /Hi/); assert.match(txt.text, /\[pic\]/)
  void window2
})

test("the toolbar's Copy button names what a click copies, and its gear changes it", () => {
  const window2 = page()
  let settings = { format: "html" }
  const bar = mountToolbar({}, ["copy"], () => {}, null, null, null, null, null, { get settings() { return settings }, onChange: (n) => { settings = n } })
  const btn = document.getElementById("mt-md-btn-copy")
  assert.match(btn.title, /Copy the page's HTML code/)
  document.getElementById("mt-md-btn-settings").click()
  document.getElementById("mt-md-copy-gear").click()
  const sel = document.getElementById("mt-md-copy-format")
  assert.equal(sel.options.length, 4)
  sel.value = "txt"; sel.dispatchEvent(new window2.Event("change"))
  assert.equal(settings.format, "txt")
  assert.equal(btn.getAttribute("aria-label"), "Copy plain text")
  assert.match(btn.title, /Copy plain text to the clipboard/)
  bar.remove()
})
