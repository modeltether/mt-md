import { getDiagramSource } from "./sources.js"
import { sanitizeHtml } from "../../vendor/sanitizer/sanitize.js"

let libs = null
let mode = "light"
const views = new Set()

async function load() {
  if (!libs) {
    libs = globalThis.__mtVendor?.vega
      ? globalThis.__mtVendor.vega
      : Promise.all([import("vega"), import("vega-lite"), import("vega-interpreter")]).then(([vega, vegaLite, i]) => ({ vega, vegaLite, expressionInterpreter: i.expressionInterpreter }))
  }
  return libs
}

// Charts must read on both page themes, so axes, titles and legends take their colours from the mode.
function config(dark) {
  const ink = dark ? "#e6edf3" : "#24292f"
  const line = dark ? "#484f58" : "#c9d1d9"
  return {
    background: null,
    view: { stroke: null },
    title: { color: ink, subtitleColor: ink },
    axis: { domainColor: line, tickColor: line, gridColor: dark ? "#30363d" : "#e5e8eb", labelColor: ink, titleColor: ink },
    legend: { labelColor: ink, titleColor: ink },
    header: { labelColor: ink, titleColor: ink }
  }
}

// Data is only ever read from the chart itself: a chart cannot make the page fetch a URL.
const EXTERNAL = "External data is not loaded. Put the values inline in the chart."
function makeLoader(state) {
  const refuse = async () => { state.refused = true; throw new Error(EXTERNAL) }
  return { load: refuse, sanitize: refuse, http: refuse, file: refuse }
}

function showError(el, err, source) {
  el.classList.add("mt-md-diagram-error")
  const pre = document.createElement("pre")
  pre.className = "mt-md-diagram-source"
  pre.textContent = `Vega error: ${err.message}\n\n${source}`
  el.textContent = ""
  el.appendChild(pre)
}

export async function renderVega(el) {
  const source = getDiagramSource(el.dataset.mtId)
  try {
    const { vega, vegaLite, expressionInterpreter } = await load()
    let spec = JSON.parse(source)
    const cfg = config(mode === "dark")
    if (el.dataset.mtDiagram === "vega-lite") spec = vegaLite.compile(spec, { config: cfg }).spec
    else spec.config = { ...cfg, ...spec.config }
    const runtime = vega.parse(spec, null, { ast: true })
    const state = { refused: false }
    const view = new vega.View(runtime, { expr: expressionInterpreter, loader: makeLoader(state), renderer: "none" })
    const svg = await view.toSVG()
    view.finalize()
    if (state.refused) throw new Error(EXTERNAL) // vega only logs a failed load, so look for the refusal ourselves
    el.classList.remove("mt-md-diagram-error")
    el.classList.add("mt-md-rendered")
    el.innerHTML = sanitizeHtml(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
  } catch (err) {
    showError(el, err, source)
  }
}

export function setVegaTheme(theme) {
  const next = theme === "dark" ? "dark" : "light"
  if (next === mode) return
  mode = next
  document.querySelectorAll('.mt-md-diagram[data-mt-diagram^="vega"]').forEach((el) => renderVega(el))
}
