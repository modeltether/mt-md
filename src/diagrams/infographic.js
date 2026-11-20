import { getDiagramSource } from "./sources.js"
import { sanitizeHtml } from "../../vendor/sanitizer/sanitize.js"

// AntV Infographic: a short text description (the library's own syntax) becomes an infographic. The library is built without
// its font and icon downloads, so nothing is fetched; pictures an infographic asks for from the web are left out.
let Lib = null
let mode = "light"

async function load() {
  if (!Lib) Lib = globalThis.__mtVendor?.Infographic ? globalThis.__mtVendor.Infographic : (await import("@antv/infographic")).Infographic
  return Lib
}

function showError(el, message, source) {
  el.classList.add("mt-md-diagram-error")
  const pre = document.createElement("pre")
  pre.className = "mt-md-diagram-source"
  pre.textContent = `Infographic error: ${message}\n\n${source}`
  el.textContent = ""
  el.appendChild(pre)
}

export async function renderInfographic(el) {
  const source = getDiagramSource(el.dataset.mtId)
  try {
    const Infographic = await load()
    const errors = []
    const holder = document.createElement("div")
    el.textContent = ""
    el.appendChild(holder)
    const ig = new Infographic({ container: holder, width: "100%", theme: mode, svg: { background: false } })
    ig.on?.("error", (e) => errors.push(Array.isArray(e) ? e.map((x) => x?.message || String(x)).join("; ") : e?.message || String(e)))
    // The library finishes the drawing (view box, fonts, then un-hides the picture) after it has been placed in the page,
    // so wait for its "loaded" signal before taking the result.
    const loaded = new Promise((resolve) => { ig.on?.("loaded", resolve); setTimeout(resolve, 4000) })
    ig.render(source)
    if (errors.length) throw new Error(errors[0])
    await loaded
    const svg = holder.querySelector("svg")
    if (!svg) throw new Error("nothing to draw")
    svg.style.removeProperty("visibility")
    // the labels are HTML inside foreignObject, so those are kept, after the sanitiser has removed anything active
    holder.innerHTML = sanitizeHtml(holder.innerHTML, { USE_PROFILES: { svg: true, svgFilters: true, html: true }, ADD_TAGS: ["foreignObject"], HTML_INTEGRATION_POINTS: { foreignobject: true } })
    el.classList.remove("mt-md-diagram-error")
    el.classList.add("mt-md-rendered")
  } catch (err) {
    showError(el, err.message, source)
  }
}

export function setInfographicTheme(theme) {
  const next = theme === "dark" ? "dark" : "light"
  if (next === mode) return
  mode = next
  document.querySelectorAll('.mt-md-diagram[data-mt-diagram="infographic"]').forEach((el) => renderInfographic(el))
}
