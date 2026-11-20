import { getDiagramSource } from "./sources.js"
import { sanitizeHtml } from "../../vendor/sanitizer/sanitize.js"

// draw.io / diagrams.net diagrams: the XML of a .drawio file (compressed or not) drawn read-only as SVG with maxGraph.
// The labels some diagrams write as HTML go through the sanitiser before maxGraph sees them (it writes a label into the
// page as given, and a tag such as <img onerror> would act as soon as it was inserted), so a diagram can only carry shapes and formatted text.
let lib = null
const MAX_XML = 2_000_000

async function load() {
  if (!lib) lib = globalThis.__mtVendor?.maxgraph ? globalThis.__mtVendor.maxgraph : await import("@maxgraph/core")
  return lib
}

// draw.io stores a page as base64 of raw-deflate of the URL-encoded model unless "Compressed" is switched off.
async function inflate(b64) {
  const bytes = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  const text = await new Response(stream).text()
  try { return decodeURIComponent(text) } catch { return text }
}

export async function modelXml(source) {
  if (source.length > MAX_XML) throw new Error("The diagram is larger than 2 MB")
  const doc = new DOMParser().parseFromString(source.trim(), "text/xml")
  if (doc.querySelector("parsererror")) throw new Error("This is not valid XML")
  let model = doc.documentElement.nodeName === "mxGraphModel" ? doc.documentElement : doc.querySelector("mxGraphModel")
  if (!model) {
    const page = doc.querySelector("diagram")
    const text = page?.textContent?.trim()
    if (!text) throw new Error("No diagram found (expected an mxfile or mxGraphModel)")
    const inner = await inflate(text)
    model = new DOMParser().parseFromString(inner, "text/xml").documentElement
    if (model.nodeName !== "mxGraphModel") throw new Error("The compressed diagram could not be read")
  }
  return new XMLSerializer().serializeToString(model)
}

// maxGraph does not sanitise labels, so every text a cell can show is cleaned in the model before it is imported.
const LABEL_ATTRS = ["value", "label", "tooltip"]
export function cleanLabels(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml")
  for (const node of doc.querySelectorAll("*")) {
    for (const name of LABEL_ATTRS) {
      const v = node.getAttribute(name)
      if (v && v.includes("<")) node.setAttribute(name, sanitizeHtml(v))
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement)
}

export async function renderDrawio(el) {
  const source = getDiagramSource(el.dataset.mtId)
  let graph = null
  let host = null
  try {
    const { Graph, ModelXmlSerializer } = await load()
    const xml = cleanLabels(await modelXml(source))
    host = document.createElement("div")
    host.style.cssText = "position:absolute;left:-99999px;top:0;width:1px;height:1px;overflow:visible"
    document.body.appendChild(host)
    graph = new Graph(host)
    graph.setEnabled(false)
    graph.setHtmlLabels(true)
    // edge labels sit on a patch of the page colour, so a line never runs through "yes" or "no"
    const cs = getComputedStyle(document.getElementById("mt-md-root") || document.body)
    const bg = cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : "#ffffff"
    const sheet = graph.getStylesheet()
    const edgeStyle = sheet.getDefaultEdgeStyle()
    edgeStyle.labelBackgroundColor = bg
    // text that the diagram does not colour itself follows the page, so it reads on a dark theme too
    edgeStyle.fontColor = cs.color
    sheet.getDefaultVertexStyle().fontColor = cs.color
    sheet.getDefaultVertexStyle().strokeColor = cs.color
    edgeStyle.strokeColor = cs.color
    new ModelXmlSerializer(graph.getDataModel()).import(xml)
    // a shape the diagram fills with its own colour keeps dark text (those fills are light), whatever the page theme
    const model = graph.getDataModel()
    for (const cell of (model.getRoot()?.getDescendants() ?? []).filter((c) => c.isVertex())) {
      const st = cell.style ?? {}
      if (st.fillColor && st.fillColor !== "none" && !st.fontColor) model.setStyle(cell, { ...st, fontColor: "#000000" })
    }
    graph.refresh()
    const b = graph.getGraphBounds()
    if (!b.width || !b.height) throw new Error("The diagram is empty")
    const svg = host.querySelector("svg")
    const pad = 12
    const clone = svg.cloneNode(true)
    clone.setAttribute("viewBox", `${Math.floor(b.x - pad)} ${Math.floor(b.y - pad)} ${Math.ceil(b.width + pad * 2)} ${Math.ceil(b.height + pad * 2)}`)
    clone.setAttribute("width", Math.ceil(b.width + pad * 2))
    clone.setAttribute("height", Math.ceil(b.height + pad * 2))
    clone.removeAttribute("style")
    clone.style.maxWidth = "100%"
    clone.style.height = "auto"
    const clean = sanitizeHtml(clone.outerHTML, { USE_PROFILES: { svg: true, svgFilters: true, html: true }, ADD_TAGS: ["foreignObject"], HTML_INTEGRATION_POINTS: { foreignobject: true } })
    el.classList.remove("mt-md-diagram-error")
    el.classList.add("mt-md-rendered")
    el.innerHTML = clean
  } catch (err) {
    el.classList.add("mt-md-diagram-error")
    const pre = document.createElement("pre")
    pre.className = "mt-md-diagram-source"
    pre.textContent = `draw.io error: ${err.message}\n\n${source.slice(0, 2000)}`
    el.textContent = ""
    el.appendChild(pre)
  } finally {
    try { graph?.destroy() } catch { /* already gone */ }
    host?.remove()
  }
}

// Diagrams are drawn again when the theme changes, so the label patches and unstyled text take the new page colours.
export function redrawDrawio() {
  document.querySelectorAll('.mt-md-diagram.mt-md-rendered[data-mt-diagram="drawio"]').forEach((el) => renderDrawio(el))
}
