// The rendered document as a small, format-neutral model that the .docx and .odt writers turn into files.
//   block: { t:"h", level, runs } | { t:"p", runs } | { t:"list", ordered, items:[block[]] } | { t:"code", text }
//        | { t:"quote", blocks } | { t:"table", rows:[[{ runs, header }]] } | { t:"hr" }
//   run:   { text, bold, italic, code, strike, sup, sub, link } | { br:true } | { image:{ bytes, mime, width, height, alt } }
// `image(el)` (supplied by the caller) turns an <img> or inline <svg> into { bytes, mime, width, height } or null.

const SKIP = new Set(["SCRIPT", "STYLE", "BUTTON", "TEMPLATE", "NOSCRIPT"])
const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "PRE", "BLOCKQUOTE", "TABLE", "HR", "DIV", "SECTION", "DETAILS", "FIGURE", "DL", "ASIDE", "HEADER", "FOOTER", "ARTICLE", "MAIN", "LI", "DD", "DT", "FIGCAPTION"])
const STYLE_TAGS = { STRONG: "bold", B: "bold", EM: "italic", I: "italic", CODE: "code", KBD: "code", SAMP: "code", DEL: "strike", S: "strike", SUP: "sup", SUB: "sub", MARK: "bold" }

const isBlock = (el) => BLOCK_TAGS.has(el.tagName) || el.classList?.contains("mt-md-diagram") || el.classList?.contains("mt-md-math-display")

async function inlineOne(n, st, runs, ctx) {
  if (n.nodeType === 3) {
    const text = n.nodeValue.replace(/\s+/g, " ")
    if (text) runs.push({ text, ...st })
    return
  }
  if (n.nodeType !== 1 || SKIP.has(n.tagName)) return
  if (n.classList.contains("mt-md-copy") || n.classList.contains("mt-md-lang") || n.id === "mt-md-toc") return // page furniture, not content
  const tag = n.tagName
  if (tag === "BR") return void runs.push({ br: true })
  if (tag === "INPUT") return void (n.type === "checkbox" && runs.push({ text: n.checked ? "☑ " : "☐ ", ...st }))
  if (tag === "IMG" || tag === "svg") {
    const image = await ctx.image(n)
    if (image) runs.push({ image: { ...image, alt: n.getAttribute?.("alt") || "" } })
    else if (tag === "IMG" && n.getAttribute("alt")) runs.push({ text: `[${n.getAttribute("alt")}]`, ...st })
    return
  }
  if (n.classList.contains("mt-md-math")) {
    const note = n.querySelector("annotation")?.textContent
    return void runs.push({ text: (note || n.textContent).trim(), ...st, italic: true })
  }
  const next = { ...st }
  if (STYLE_TAGS[tag]) next[STYLE_TAGS[tag]] = true
  if (tag === "A" && n.getAttribute("href")) next.link = n.href || n.getAttribute("href")
  for (const c of n.childNodes) await inlineOne(c, next, runs, ctx)
}

function tidy(runs) {
  const out = runs.map((r) => ({ ...r }))
  const first = out.find((r) => !r.br)
  if (first?.text) first.text = first.text.replace(/^\s+/, "")
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].br) continue
    if (out[i].text !== undefined) out[i].text = out[i].text.replace(/\s+$/, "")
    break
  }
  return out.filter((r) => r.br || r.image || r.text)
}

const textOf = (el) => (el.textContent || "").replace(/\s+/g, " ").trim()

async function cellRuns(cell, ctx) {
  const runs = []
  for (const c of cell.childNodes) await inlineOne(c, {}, runs, ctx)
  return tidy(runs)
}

export async function domToModel(root, ctx) {
  return walk(root, ctx)
}

async function walk(parent, ctx) {
  const out = []
  let runs = []
  const flush = () => {
    const t = tidy(runs)
    if (t.length) out.push({ t: "p", runs: t })
    runs = []
  }
  for (const n of parent.childNodes) {
    if (n.nodeType === 3 || (n.nodeType === 1 && !isBlock(n) && !n.classList.contains("mt-md-codeblock") && !n.classList.contains("mt-admonition"))) {
      await inlineOne(n, {}, runs, ctx)
      continue
    }
    if (n.nodeType !== 1 || SKIP.has(n.tagName) || n.id === "mt-md-toc") continue
    flush()
    const tag = n.tagName
    if (/^H[1-6]$/.test(tag)) {
      const r = []
      for (const c of n.childNodes) await inlineOne(c, {}, r, ctx)
      out.push({ t: "h", level: +tag[1], runs: tidy(r) })
    } else if (tag === "P" || tag === "FIGCAPTION" || tag === "DT") {
      const r = []
      for (const c of n.childNodes) await inlineOne(c, tag === "DT" ? { bold: true } : {}, r, ctx)
      const t = tidy(r)
      if (t.length) out.push({ t: "p", runs: t })
    } else if (tag === "UL" || tag === "OL") {
      const items = []
      for (const li of n.children) if (li.tagName === "LI") items.push(await walk(li, ctx))
      out.push({ t: "list", ordered: tag === "OL", items })
    } else if (tag === "PRE" || n.classList.contains("mt-md-codeblock")) {
      const pre = tag === "PRE" ? n : n.querySelector("pre")
      if (pre) out.push({ t: "code", text: pre.textContent.replace(/\n$/, "") })
    } else if (tag === "BLOCKQUOTE") {
      out.push({ t: "quote", blocks: await walk(n, ctx) })
    } else if (n.classList.contains("mt-admonition")) {
      const title = n.querySelector(".mt-admonition-title")
      const body = n.querySelector(".mt-admonition-content") || n
      const blocks = await walk(body, ctx)
      if (title) blocks.unshift({ t: "p", runs: [{ text: textOf(title), bold: true }] })
      out.push({ t: "quote", blocks })
    } else if (tag === "TABLE") {
      const rows = []
      for (const tr of n.querySelectorAll("tr")) {
        const cells = []
        for (const c of tr.children) if (c.tagName === "TD" || c.tagName === "TH") cells.push({ runs: await cellRuns(c, ctx), header: c.tagName === "TH" })
        if (cells.length) rows.push(cells)
      }
      if (rows.length) out.push({ t: "table", rows })
    } else if (tag === "HR") {
      out.push({ t: "hr" })
    } else if (tag === "DETAILS") {
      const summary = n.querySelector(":scope > summary")
      if (summary) out.push({ t: "p", runs: [{ text: textOf(summary), bold: true }] })
      const rest = n.cloneNode(true)
      rest.querySelector(":scope > summary")?.remove()
      out.push(...(await walk(rest, ctx)))
    } else if (n.classList.contains("mt-md-diagram")) {
      const svg = n.querySelector("svg")
      const image = svg && (await ctx.image(svg))
      if (image) out.push({ t: "p", runs: [{ image: { ...image, alt: "diagram" } }] })
      else out.push({ t: "p", runs: [{ text: "[diagram]", italic: true }] }) // a format without pictures, or a drawing the canvas could not read
    } else if (n.classList.contains("mt-md-math-display")) {
      out.push({ t: "p", runs: [{ text: (n.querySelector("annotation")?.textContent || n.textContent).trim(), italic: true }] })
    } else {
      out.push(...(await walk(n, ctx)))
    }
  }
  flush()
  return out
}
