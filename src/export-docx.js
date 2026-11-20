// Word (.docx, Office Open XML) from the document model. Plain, standard styles so Word, LibreOffice and Google Docs open it.
import { zipStore } from "./zip.js"

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
const EMU = 9525 // per CSS pixel
const MAX_W = 6 * 96 // six inches of the page, in px
const EXT = { "image/png": "png", "image/jpeg": "jpeg", "image/gif": "gif", "image/bmp": "bmp" }

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

export function buildDocx(blocks, { title = "Document" } = {}) {
  const media = []
  const links = []
  let nextId = 1
  const rel = () => `rId${100 + nextId++}`

  const run = (r) => {
    if (r.br) return "<w:r><w:br/></w:r>"
    if (r.image) return image(r.image)
    const props = [
      r.code && '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>',
      r.bold && "<w:b/>", r.italic && "<w:i/>", r.strike && "<w:strike/>",
      r.sup && '<w:vertAlign w:val="superscript"/>', r.sub && '<w:vertAlign w:val="subscript"/>',
      r.link && '<w:color w:val="0563C1"/><w:u w:val="single"/>',
    ].filter(Boolean).join("")
    const body = `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`
    if (!r.link) return body
    const id = rel()
    links.push({ id, href: r.link })
    return `<w:hyperlink r:id="${id}">${body}</w:hyperlink>`
  }

  const image = (img) => {
    const ext = EXT[img.mime]
    if (!ext) return ""
    const id = rel()
    const name = `image${media.length + 1}.${ext}`
    media.push({ id, name, bytes: img.bytes })
    const w = Math.min(img.width || 300, MAX_W)
    const h = Math.round((img.height || 200) * (w / (img.width || 300)))
    const n = media.length
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${Math.round(w * EMU)}" cy="${Math.round(h * EMU)}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${esc(img.alt || "")}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(w * EMU)}" cy="${Math.round(h * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  }

  const para = (runs, style, extra = "") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>${runs.map(run).join("")}</w:p>`

  const blockXml = (b, ctx = {}) => {
    switch (b.t) {
      case "h": return para(b.runs, `Heading${Math.min(b.level, 6)}`)
      case "p": return para(b.runs, ctx.quote ? "Quote" : "", ctx.list ? `<w:numPr><w:ilvl w:val="${ctx.list.level}"/><w:numId w:val="${ctx.list.ordered ? 2 : 1}"/></w:numPr>` : "")
      case "code": return b.text.split("\n").map((line) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`).join("")
      case "hr": return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>'
      case "quote": return b.blocks.map((x) => blockXml(x, { ...ctx, quote: true })).join("")
      case "list": {
        const level = (ctx.list?.level ?? -1) + 1
        const inner = { ...ctx, list: { level: Math.min(level, 8), ordered: b.ordered } }
        return b.items.map((item) => item.map((x) => blockXml(x, inner)).join("")).join("")
      }
      case "table": return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/>`).join("")}</w:tblBorders></w:tblPr>${b.rows.map((row) => `<w:tr>${row.map((c) => `<w:tc><w:tcPr>${c.header ? '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>' : ""}</w:tcPr>${para(c.header ? c.runs.map((r) => ({ ...r, bold: true })) : c.runs, "")}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl><w:p/>`
      default: return ""
    }
  }

  const body = blocks.map((b) => blockXml(b)).join("")
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`

  const heading = (n, size) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${[[1, 40], [2, 32], [3, 28], [4, 26], [5, 24], [6, 22]].map(([n, s]) => heading(n, s)).join("")}<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BBBBBB"/></w:pBdr><w:ind w:left="360"/></w:pPr><w:rPr><w:color w:val="555555"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`

  const lvl = (i, fmt, text) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + i * 360}" w:hanging="360"/></w:pPr></w:lvl>`
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0">${Array.from({ length: 9 }, (_, i) => lvl(i, "bullet", "•")).join("")}</w:abstractNum><w:abstractNum w:abstractNumId="1">${Array.from({ length: 9 }, (_, i) => lvl(i, "decimal", `%${i + 1}.`)).join("")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${media.map((m) => `<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join("")}${links.map((l) => `<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l.href)}" TargetMode="External"/>`).join("")}</Relationships>`

  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
  const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>mt-md</dc:creator></cp:coreProperties>`

  return zipStore([
    { name: "[Content_Types].xml", data: types },
    { name: "_rels/.rels", data: root },
    { name: "word/document.xml", data: document },
    { name: "word/_rels/document.xml.rels", data: rels },
    { name: "word/styles.xml", data: styles },
    { name: "word/numbering.xml", data: numbering },
    { name: "docProps/core.xml", data: core },
    ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.bytes })),
  ])
}
