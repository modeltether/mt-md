// OpenDocument text (.odt) from the document model: opens in LibreOffice, OpenOffice, Word and Google Docs.
import { zipStore } from "./zip.js"
import { esc } from "./export-docx.js"

const PX_CM = 2.54 / 96
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/bmp": "bmp" }
const MAX_W = 16 // cm of the page's text width

export function buildOdt(blocks, { title = "Document" } = {}) {
  const pics = []
  let frame = 0

  const FLAGS = [["code", "Tcode"], ["bold", "Tb"], ["italic", "Ti"], ["strike", "Ts"], ["sup", "Tsup"], ["sub", "Tsub"]]
  const run = (r) => {
    if (r.br) return "<text:line-break/>"
    if (r.image) return image(r.image)
    let inner = esc(r.text).replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`)
    for (const [flag, style] of FLAGS) if (r[flag]) inner = `<text:span text:style-name="${style}">${inner}</text:span>`
    return r.link ? `<text:a xlink:type="simple" xlink:href="${esc(r.link)}">${inner}</text:a>` : inner
  }
  const image = (img) => {
    const ext = EXT[img.mime]
    if (!ext) return ""
    const n = pics.length + 1
    const name = `Pictures/img${n}.${ext}`
    pics.push({ name, mime: img.mime, bytes: img.bytes })
    let vector = ""
    if (img.svg) {
      // the drawing first, then the PNG: a program that cannot draw SVG uses the next one
      pics.push({ name: `Pictures/img${n}.svg`, mime: "image/svg+xml", bytes: new TextEncoder().encode(img.svg) })
      vector = `<draw:image xlink:href="Pictures/img${n}.svg" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>`
    }
    let w = (img.width || 300) * PX_CM
    let h = (img.height || 200) * PX_CM
    if (w > MAX_W) { h *= MAX_W / w; w = MAX_W }
    frame++
    return `<draw:frame draw:style-name="fr1" draw:name="Image${frame}" text:anchor-type="as-char" svg:width="${w.toFixed(2)}cm" svg:height="${h.toFixed(2)}cm">${vector}<draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/><svg:title>${esc(img.alt || "")}</svg:title></draw:frame>`
  }
  const para = (runs, style = "Text_20_body") => `<text:p text:style-name="${style}">${runs.map(run).join("")}</text:p>`

  const blockXml = (b, quote = false) => {
    switch (b.t) {
      case "h": return `<text:h text:style-name="Heading_20_${Math.min(b.level, 6)}" text:outline-level="${Math.min(b.level, 6)}">${b.runs.map(run).join("")}</text:h>`
      case "p": return para(b.runs, quote ? "Quotations" : "Text_20_body")
      case "code": return b.text.split("\n").map((l) => `<text:p text:style-name="Preformatted_20_Text">${esc(l).replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`).replace(/\t/g, "<text:tab/>")}</text:p>`).join("")
      case "hr": return '<text:p text:style-name="Horizontal_20_Line"/>'
      case "quote": return b.blocks.map((x) => blockXml(x, true)).join("")
      case "list": return `<text:list text:style-name="${b.ordered ? "LNum" : "LBullet"}">${b.items.map((item) => `<text:list-item>${item.map((x) => blockXml(x, quote)).join("") || "<text:p/>"}</text:list-item>`).join("")}</text:list>`
      case "table": {
        const cols = Math.max(...b.rows.map((r) => r.length))
        return `<table:table table:style-name="Tbl"><table:table-column table:number-columns-repeated="${cols}"/>${b.rows.map((row) => `<table:table-row>${row.map((c) => `<table:table-cell table:style-name="${c.header ? "TblHead" : "TblCell"}" office:value-type="string">${para(c.header ? c.runs.map((r) => ({ ...r, bold: true })) : c.runs, "Table_20_Contents")}</table:table-cell>`).join("")}${"<table:table-cell office:value-type=\"string\"><text:p/></table:table-cell>".repeat(cols - row.length)}</table:table-row>`).join("")}</table:table>`
      }
      default: return ""
    }
  }

  const body = blocks.map((b) => blockXml(b)).join("")
  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"'
  const tstyle = (name, props) => `<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`
  const textStyles = [
    ["Tb", 'fo:font-weight="bold"'], ["Ti", 'fo:font-style="italic"'], ["Ts", 'style:text-line-through-style="solid"'],
    ["Tsup", 'style:text-position="super 58%"'], ["Tsub", 'style:text-position="sub 58%"'], ["Tcode", 'style:font-name="Liberation Mono" fo:font-size="90%"'],
  ].map(([n, p]) => tstyle(n, p)).join("")
  const pstyle = (name, parent, para = "", text = "", extra = "") => `<style:style style:name="${name}" style:family="paragraph"${parent ? ` style:parent-style-name="${parent}"` : ""}${extra}>${para ? `<style:paragraph-properties ${para}/>` : ""}${text ? `<style:text-properties ${text}/>` : ""}</style:style>`
  const headings = [[1, "200%"], [2, "160%"], [3, "135%"], [4, "120%"], [5, "110%"], [6, "100%"]].map(([n, size]) => pstyle(`Heading_20_${n}`, "", 'fo:margin-top="0.4cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"', `fo:font-size="${size}" fo:font-weight="bold"`, ` style:display-name="Heading ${n}" style:default-outline-level="${n}"`)).join("")
  const common = `<style:style style:name="Standard" style:family="paragraph" style:class="text"/>${pstyle("Text_20_body", "Standard", 'fo:margin-bottom="0.2cm"', "", ' style:display-name="Text body"')}${headings}${pstyle("Preformatted_20_Text", "Standard", 'fo:background-color="#f3f4f6" fo:margin-top="0cm" fo:margin-bottom="0cm"', 'style:font-name="Liberation Mono" fo:font-size="90%"', ' style:display-name="Preformatted Text"')}${pstyle("Quotations", "Standard", 'fo:margin-left="0.6cm" fo:border-left="0.06cm solid #bbbbbb" fo:padding-left="0.3cm"', 'fo:color="#555555"')}${pstyle("Table_20_Contents", "Standard", "", "", ' style:display-name="Table Contents"')}${pstyle("Horizontal_20_Line", "Standard", 'fo:border-bottom="0.03cm solid #999999" fo:margin-bottom="0.2cm"', "", ' style:display-name="Horizontal Line"')}`
  const fonts = '<office:font-face-decls><style:font-face style:name="Liberation Mono" svg:font-family="\'Liberation Mono\', monospace" style:font-family-generic="modern"/></office:font-face-decls>'
  const bullets = Array.from({ length: 5 }, (_, i) => `<text:list-level-style-bullet text:level="${i + 1}" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="${(i + 1) * 0.8}cm" fo:text-indent="-0.5cm" fo:margin-left="${(i + 1) * 0.8}cm"/></style:list-level-properties></text:list-level-style-bullet>`).join("")
  const numbers = Array.from({ length: 5 }, (_, i) => `<text:list-level-style-number text:level="${i + 1}" style:num-suffix="." style:num-format="1"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="${(i + 1) * 0.8}cm" fo:text-indent="-0.6cm" fo:margin-left="${(i + 1) * 0.8}cm"/></style:list-level-properties></text:list-level-style-number>`).join("")
  const auto = `<office:automatic-styles><style:style style:name="fr1" style:family="graphic"><style:graphic-properties style:wrap="none" style:vertical-pos="top" style:vertical-rel="baseline"/></style:style><style:style style:name="Tbl" style:family="table"><style:table-properties style:width="17cm" table:align="left"/></style:style><style:style style:name="TblCell" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.02cm solid #bbbbbb"/></style:style><style:style style:name="TblHead" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.02cm solid #bbbbbb" fo:background-color="#eeeeee"/></style:style><text:list-style style:name="LBullet">${bullets}</text:list-style><text:list-style style:name="LNum">${numbers}</text:list-style></office:automatic-styles>`

  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.2">${fonts}${auto}<office:body><office:text>${body}</office:text></office:body></office:document-content>`
  const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} office:version="1.2">${fonts}<office:styles>${common}${textStyles}</office:styles><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`
  const meta = `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS} office:version="1.2"><office:meta><dc:title>${esc(title)}</dc:title><meta:generator>mt-md</meta:generator></office:meta></office:document-meta>`
  const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${pics.map((p) => `<manifest:file-entry manifest:full-path="${p.name}" manifest:media-type="${p.mime}"/>`).join("")}</manifest:manifest>`

  return zipStore([
    { name: "mimetype", data: "application/vnd.oasis.opendocument.text" }, // first and stored, as the format requires
    { name: "META-INF/manifest.xml", data: manifest },
    { name: "content.xml", data: content },
    { name: "styles.xml", data: styles },
    { name: "meta.xml", data: meta },
    ...pics.map((p) => ({ name: p.name, data: p.bytes })),
  ])
}
