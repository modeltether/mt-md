import katex from "katex"
import { registerDiagramSource, getDiagramSource } from "./diagrams/sources.js"

function placeholder(display, tex) {
  const id = registerDiagramSource(tex)
  const tag = display ? "div" : "span"
  return `<${tag} class="mt-md-math${display ? " mt-md-math-display" : ""}" data-mt-id="${id}"></${tag}>`
}

function inlineRule(state, silent) {
  const src = state.src
  const start = state.pos
  if (src[start] !== "$" || src[start + 1] === "$") return false
  // opening $ must be followed by non-space; closing $ preceded by non-space, not followed by a digit
  if (/\s/.test(src[start + 1] ?? " ")) return false
  let end = start + 1
  for (;;) {
    end = src.indexOf("$", end)
    if (end === -1) return false
    if (src[end - 1] === "\\") { end++; continue }
    break
  }
  if (end === start + 1 || /\s/.test(src[end - 1]) || /\d/.test(src[end + 1] ?? "")) return false
  let tex = src.slice(start + 1, end)
  if (tex.length > 2 && tex.startsWith("`") && tex.endsWith("`")) tex = tex.slice(1, -1) // GitHub/GitLab style $`x^2`$
  if (tex.includes("\n\n")) return false
  if (!silent) {
    const token = state.push("html_inline", "", 0)
    token.content = placeholder(false, tex)
  }
  state.pos = end + 1
  return true
}

function blockRule(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  if (state.src.slice(pos, pos + 2) !== "$$") return false
  const first = state.src.slice(pos + 2, max)
  let content
  let line = startLine
  if (first.trim().endsWith("$$") && first.trim().length >= 2) {
    content = first.trim().slice(0, -2)
  } else {
    const parts = [first]
    let closed = false
    while (++line < endLine) {
      pos = state.bMarks[line] + state.tShift[line]
      max = state.eMarks[line]
      const text = state.src.slice(pos, max)
      if (text.trim().endsWith("$$")) {
        parts.push(text.trim().slice(0, -2))
        closed = true
        break
      }
      parts.push(text)
    }
    if (!closed) return false
    content = parts.join("\n")
  }
  if (silent) return true
  state.line = line + 1
  const token = state.push("html_block", "", 0)
  token.content = placeholder(true, content.trim()) + "\n"
  token.map = [startLine, state.line]
  return true
}

// ```math fences (GitHub and GitLab) become display equations
function mathFences(state) {
  for (const token of state.tokens) {
    if (token.type === "fence" && token.info.trim().toLowerCase() === "math") {
      token.type = "html_block"
      token.tag = ""
      token.content = placeholder(true, token.content.trim()) + "\n"
    }
  }
}

export function mathPlugin(md) {
  md.core.ruler.push("mt_math_fence", mathFences)
  md.inline.ruler.before("escape", "mt_math_inline", inlineRule)
  md.block.ruler.before("fence", "mt_math_block", blockRule, { alt: ["paragraph", "reference", "blockquote", "list"] })
}

export function renderMath(root) {
  for (const el of root.querySelectorAll(".mt-md-math")) {
    const tex = getDiagramSource(el.dataset.mtId)
    try {
      // MathML output only: native in Firefox, so no KaTeX fonts/CSS need bundling.
      el.innerHTML = katex.renderToString(tex, {
        displayMode: el.classList.contains("mt-md-math-display"),
        output: "mathml",
        throwOnError: false,
        trust: false
      })
    } catch (err) {
      el.textContent = tex
    }
  }
}
