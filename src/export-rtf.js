// Rich Text Format (.rtf) from the document model: opens in Word, LibreOffice, WordPad, TextEdit and most editors.
const hex = (bytes) => { let s = ""; for (const b of bytes) s += b.toString(16).padStart(2, "0"); return s }

// RTF is 7-bit: backslash, braces and everything outside ASCII are escaped (\uN? with a signed 16-bit value)
export function rtfEscape(text) {
  let out = ""
  for (const ch of text) {
    const c = ch.codePointAt(0)
    if (ch === "\\" || ch === "{" || ch === "}") out += "\\" + ch
    else if (ch === "\n") out += "\\line "
    else if (ch === "\t") out += "\\tab "
    else if (c >= 32 && c < 127) out += ch
    else if (c < 32) continue
    else if (c <= 0xffff) out += `\\u${c > 32767 ? c - 65536 : c}?`
    else { const v = c - 0x10000; for (const u of [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)]) out += `\\u${u - 65536}?` }
  }
  return out
}

export function buildRtf(blocks, { title = "Document" } = {}) {
  const TW = 15 // twips per CSS pixel
  const MAX_W = 6 * 96
  const run = (r) => {
    if (r.br) return "\\line "
    if (r.image) return image(r.image)
    let t = rtfEscape(r.text)
    if (r.code) t = `{\\f1\\fs19 ${t}}`
    if (r.bold) t = `{\\b ${t}}`
    if (r.italic) t = `{\\i ${t}}`
    if (r.strike) t = `{\\strike ${t}}`
    if (r.sup) t = `{\\super ${t}}`
    if (r.sub) t = `{\\sub ${t}}`
    if (r.link) t = `{\\field{\\*\\fldinst HYPERLINK "${r.link.replace(/["\\{}]/g, "")}"}{\\fldrslt {\\cf1\\ul ${t}}}}`
    return t
  }
  const image = (img) => {
    const kind = img.mime === "image/png" ? "pngblip" : img.mime === "image/jpeg" ? "jpegblip" : null
    if (!kind) return ""
    const w = Math.min(img.width || 300, MAX_W)
    const h = Math.round((img.height || 200) * (w / (img.width || 300)))
    return `{\\pict\\${kind}\\picw${img.width || 300}\\pich${img.height || 200}\\picwgoal${w * TW}\\pichgoal${h * TW} ${hex(img.bytes)}}`
  }
  const para = (runs, props = "") => `\\pard${props} ${runs.map(run).join("")}\\par\n`

  const block = (b, ctx = {}) => {
    switch (b.t) {
      case "h": return `\\pard\\keepn\\sb${b.level === 1 ? 360 : 240}\\sa120\\b\\fs${[44, 34, 28, 26, 24, 22][Math.min(b.level, 6) - 1]} ${b.runs.map(run).join("")}\\b0\\fs22\\par\n`
      case "p": return para(b.runs, ctx.list ? `\\fi-360\\li${720 + 360 * ctx.list.level}` : ctx.quote ? "\\li720\\i" : "\\sa120")
      case "code": return b.text.split("\n").map((l) => `\\pard\\li0\\sa0\\cbpat2\\f1\\fs19 ${rtfEscape(l)}\\f0\\fs22\\par\n`).join("") + "\\pard\\sa120\\par\n"
      case "hr": return "\\pard\\brdrb\\brdrs\\brdrw10\\brsp20\\sa120\\par\n"
      case "quote": return b.blocks.map((x) => block(x, { ...ctx, quote: true })).join("")
      case "list": {
        const level = (ctx.list?.level ?? -1) + 1
        return b.items.map((item, n) => item.map((x, i) => {
          if (x.t === "p" && i === 0) return para([{ text: b.ordered ? `${n + 1}.` : "•" }, { text: "\t" }, ...x.runs], `\\fi-360\\li${720 + 360 * level}\\tx${720 + 360 * level}`)
          return block(x, { ...ctx, list: { level } })
        }).join("")).join("")
      }
      case "table": {
        const cols = Math.max(...b.rows.map((r) => r.length))
        const w = Math.floor(9000 / cols)
        const border = "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10"
        return b.rows.map((row) => `\\trowd\\trgaph108${row.map((c, i) => `${c.header ? "\\clcbpat3" : ""}${border}\\cellx${w * (i + 1)}`).join("")}\n${row.map((c) => `\\pard\\intbl ${(c.header ? c.runs.map((r) => ({ ...r, bold: true })) : c.runs).map(run).join("")}\\cell\n`).join("")}\\row\n`).join("") + "\\pard\\sa120\\par\n"
      }
      default: return ""
    }
  }
  const body = blocks.map((b) => block(b)).join("")
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Calibri;}{\\f1\\fmodern Courier New;}}{\\colortbl;\\red5\\green99\\blue193;\\red243\\green244\\blue246;\\red238\\green238\\blue238;}{\\info{\\title ${rtfEscape(title)}}{\\author mt-md}}\\paperw11906\\paperh16838\\margl1134\\margr1134\\margt1134\\margb1134\\f0\\fs22\n${body}}\n`
}
