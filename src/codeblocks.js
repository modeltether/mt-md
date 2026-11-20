import { registerDiagramSource } from "./diagrams/sources.js"

const DIAGRAMS = new Set(["mermaid", "graphviz", "vega", "vega-lite", "canvas", "drawio", "infographic"])

export function fenceRenderer(md) {
  return (tokens, idx) => {
    const token = tokens[idx]
    let info = (token.info || "").trim()
    let dataLine = ""
    const hl = info.match(/hl_lines\s*=\s*"([\d\s,-]+)"/)
    if (hl) {
      dataLine = ` data-line="${hl[1].trim().replace(/\s+/g, ",")}"`
      info = info.replace(hl[0], "").trim()
    }
    const parts = info.split(/\s+/).filter(Boolean)
    const lang = parts[0] || ""
    const linenums = parts.slice(1).some((p) => /^linenums$/i.test(p))
    const kind = lang === "dot" || lang === "graphviz" ? "graphviz" : lang === "vegalite" ? "vega-lite" : lang === "jsoncanvas" || lang === "obsidian-canvas" ? "canvas" : lang === "drawio" || lang === "diagrams.net" ? "drawio" : lang === "infographic" ? "infographic" : lang
    if (DIAGRAMS.has(kind)) {
      const id = registerDiagramSource(token.content)
      return `<div class="mt-md-diagram" data-mt-diagram="${kind}" data-mt-id="${id}"></div>\n`
    }
    const codeCls = lang ? ` class="language-${md.utils.escapeHtml(lang)}"` : ""
    const preCls = linenums ? ' class="line-numbers"' : ""
    return `<pre${preCls}${dataLine}><code${codeCls}>${md.utils.escapeHtml(token.content)}</code></pre>\n`
  }
}

export function decorateCodeBlocks(root) {
  const pres = [...root.querySelectorAll("pre")]
  for (const pre of pres) {
    const code = pre.querySelector(":scope > code")
    if (!code) continue
    const m = (code.className || "").match(/language-([\w+-]+)/)
    const lang = m ? m[1] : ""

    const wrap = document.createElement("div")
    wrap.className = "mt-md-codeblock"
    if (lang) {
      const label = document.createElement("span")
      label.className = "mt-md-lang"
      label.textContent = lang
      wrap.appendChild(label)
    }
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "mt-md-copy"
    btn.textContent = "Copy"
    btn.addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(code.innerText)
      btn.textContent = "Copied"
      setTimeout(() => {
        btn.textContent = "Copy"
      }, 1500)
    })
    wrap.appendChild(btn)
    pre.replaceWith(wrap)
    wrap.appendChild(pre)
  }
}
