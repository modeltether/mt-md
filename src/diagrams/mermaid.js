import { getDiagramSource } from "./sources.js"
import { renderGraphviz } from "./graphviz.js"
import { renderVega, setVegaTheme } from "./vega.js"
import { renderCanvas } from "./canvas.js"
import { renderDrawio, redrawDrawio } from "./drawio.js"
import { renderInfographic, setInfographicTheme } from "./infographic.js"

let mermaidPromise = null
let diagramTheme = "default"
let idCounter = 0

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = (globalThis.__mtVendor?.mermaid
      ? Promise.resolve(globalThis.__mtVendor.mermaid)
      : import("mermaid").then((m) => m.default))
  }
  return mermaidPromise
}

export async function renderMermaid(el) {
  const source = getDiagramSource(el.dataset.mtId)
  const mermaid = await loadMermaid()
  // initialize per render: the theme can change after the first diagram
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: diagramTheme, layout: "dagre" })
  const id = `mt-md-mermaid-${++idCounter}`
  try {
    const { svg } = await mermaid.render(id, source)
    el.classList.add("mt-md-rendered")
    el.innerHTML = svg
  } catch (err) {
    el.classList.add("mt-md-diagram-error")
    const pre = document.createElement("pre")
    pre.className = "mt-md-diagram-source"
    pre.textContent = `Mermaid error: ${err.message}\n\n${source}`
    el.textContent = ""
    el.appendChild(pre)
  }
}

export function setDiagramTheme(theme) {
  diagramTheme = theme === "dark" ? "dark" : "default"
  setVegaTheme(theme)
  setInfographicTheme(theme)
  setTimeout(redrawDrawio, 0) // after the page colours have switched
  const els = document.querySelectorAll('.mt-md-diagram[data-mt-diagram="mermaid"]')
  els.forEach((el) => renderMermaid(el))
}

function renderDiagram(el) {
  const kind = el.dataset.mtDiagram
  if (kind === "graphviz") return renderGraphviz(el)
  if (kind === "vega" || kind === "vega-lite") return renderVega(el)
  if (kind === "canvas") return renderCanvas(el)
  if (kind === "drawio") return renderDrawio(el)
  if (kind === "infographic") return renderInfographic(el)
  return renderMermaid(el)
}

export function setupDiagrams(root) {
  const els = [...root.querySelectorAll(".mt-md-diagram")]
  if (!els.length) return
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => renderDiagram(el))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.unobserve(entry.target)
          renderDiagram(entry.target)
        }
      }
    },
    { rootMargin: "200px" }
  )
  els.forEach((el) => io.observe(el))
}

// Diagrams draw lazily as they scroll into view; an export needs all of them, so draw the rest now.
export async function renderAllDiagrams(root = document) {
  const todo = [...root.querySelectorAll(".mt-md-diagram:not(.mt-md-rendered):not(.mt-md-diagram-error)")]
  await Promise.all(todo.map((el) => Promise.resolve(renderDiagram(el)).catch(() => {})))
}
