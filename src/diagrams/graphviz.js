import { getDiagramSource } from "./sources.js"
import { sanitizeHtml } from "../../vendor/sanitizer/sanitize.js"

let graphvizPromise = null

function loadGraphviz() {
  if (!graphvizPromise) {
    const Graphviz = globalThis.__mtVendor?.Graphviz
    graphvizPromise = (Graphviz ? Promise.resolve(Graphviz) : import("@hpcc-js/wasm-graphviz").then((m) => m.Graphviz)).then((G) => G.load())
  }
  return graphvizPromise
}

export async function renderGraphviz(el) {
  const source = getDiagramSource(el.dataset.mtId)
  try {
    const graphviz = await loadGraphviz()
    const svg = graphviz.layout(source, "svg", "dot")
    el.classList.add("mt-md-rendered")
    el.innerHTML = sanitizeHtml(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
  } catch (err) {
    el.classList.add("mt-md-diagram-error")
    const pre = document.createElement("pre")
    pre.className = "mt-md-diagram-source"
    pre.textContent = `Graphviz error: ${err.message}\n\n${source}`
    el.textContent = ""
    el.appendChild(pre)
  }
}
