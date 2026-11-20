import { getDiagramSource } from "./sources.js"

// JSON Canvas (the open format Obsidian uses): text, file, link and group nodes joined by edges, drawn as SVG with no library.
// Everything is built with DOM calls, and colours are checked, so a canvas can carry nothing but shapes and text.
const NS = "http://www.w3.org/2000/svg"
const PRESET = { 1: "#e03e3e", 2: "#e8830c", 3: "#d4a600", 4: "#2f9e44", 5: "#1c9bb5", 6: "#8957e5" }
const HEX = /^#[0-9a-fA-F]{3,8}$/
const MAX_NODES = 500
const LINE_H = 18
const PAD = 12

const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent?.appendChild(e)
  return e
}
const num = (v, d = 0) => (Number.isFinite(v) ? v : d)
const colour = (c) => (typeof c === "string" ? PRESET[c] || (HEX.test(c) ? c : "") : "")

// Plain-text view of a note: headings, emphasis and list markers lose their marks, links keep their text.
function plain(s) {
  return String(s)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
}

// Wrap to the node's width using a rough character width (no layout is needed, so it also works before the page is visible).
function wrap(text, width, size) {
  const per = Math.max(4, Math.floor(width / (size * 0.56)))
  const out = []
  for (const para of plain(text).split("\n")) {
    let line = ""
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (next.length <= per) line = next
      else {
        if (line) out.push(line)
        let rest = word
        while (rest.length > per) { out.push(rest.slice(0, per)); rest = rest.slice(per) } // a long word (a URL) is broken, not cut off
        line = rest
      }
    }
    out.push(line)
  }
  return out
}

function anchor(n, side) {
  const x = n.x, y = n.y, w = n.width, h = n.height
  if (side === "top") return { x: x + w / 2, y, dx: 0, dy: -1 }
  if (side === "bottom") return { x: x + w / 2, y: y + h, dx: 0, dy: 1 }
  if (side === "left") return { x, y: y + h / 2, dx: -1, dy: 0 }
  return { x: x + w, y: y + h / 2, dx: 1, dy: 0 }
}

function nearestSide(a, b) {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2)
  const dy = b.y + b.height / 2 - (a.y + a.height / 2)
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "bottom" : "top"
}

const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" }

export function canvasToSvg(source) {
  let data
  try { data = JSON.parse(source) } catch { throw new Error("This is not valid JSON") }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("A canvas is a JSON object with nodes and edges")
  const nodes = (Array.isArray(data.nodes) ? data.nodes : []).filter((n) => n && typeof n === "object" && typeof n.id === "string").slice(0, MAX_NODES)
    .map((n) => ({ ...n, x: num(n.x), y: num(n.y), width: Math.max(20, num(n.width, 200)), height: Math.max(20, num(n.height, 80)) }))
  if (!nodes.length) throw new Error("The canvas has no nodes")
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges = (Array.isArray(data.edges) ? data.edges : []).filter((e) => e && byId.has(e.fromNode) && byId.has(e.toNode)).slice(0, MAX_NODES * 2)

  const minX = Math.min(...nodes.map((n) => n.x)) - 30
  const minY = Math.min(...nodes.map((n) => n.y)) - 30
  const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + 30
  const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 30
  const svg = el("svg", { xmlns: NS, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`, width: maxX - minX, height: maxY - minY, role: "img" })
  svg.style.maxWidth = "100%"
  svg.style.height = "auto"
  const defs = el("defs", {}, svg)
  const marker = (id, fill) => {
    const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" }, defs)
    const p = el("path", { d: "M0,0 L10,5 L0,10 z" }, m)
    p.style.fill = fill
  }
  marker("mt-cv-arrow", "var(--mt-color-text)")
  const ink = "var(--mt-color-text)"

  // groups first (they sit behind), then edges, then the other nodes
  const drawNode = (n) => {
    const c = colour(n.color)
    const g = el("g", {}, svg)
    const r = el("rect", { x: n.x, y: n.y, width: n.width, height: n.height, rx: n.type === "group" ? 10 : 8 }, g)
    r.style.stroke = c || (n.type === "group" ? "var(--mt-color-border)" : "var(--mt-color-text)")
    r.style.strokeWidth = n.type === "group" ? "1.5" : "1.5"
    if (n.type === "group") { r.style.fill = c ? `color-mix(in srgb, ${c} 8%, transparent)` : "color-mix(in srgb, var(--mt-color-text) 4%, transparent)"; r.setAttribute("stroke-dasharray", "6 4") }
    else r.style.fill = c ? `color-mix(in srgb, ${c} 16%, var(--mt-color-bg))` : "var(--mt-color-code-bg)"
    const label = n.type === "text" ? n.text : n.type === "file" ? n.file : n.type === "link" ? n.url : n.label
    if (label === undefined || label === null || label === "") return
    const size = 14
    const lines = n.type === "group" ? [String(label)] : wrap(label, n.width - PAD * 2, size)
    const room = Math.max(1, Math.floor((n.height - PAD) / LINE_H))
    const shown = lines.length > room ? [...lines.slice(0, room - 1), lines[room - 1].replace(/.{0,1}$/, "…")] : lines
    const t = el("text", { "font-size": size }, g)
    t.style.fill = n.type === "file" || n.type === "link" ? "var(--mt-color-accent)" : ink
    t.style.fontFamily = "var(--mt-font-body)"
    shown.forEach((ln, i) => {
      const s = el("tspan", { x: n.x + PAD, y: n.type === "group" ? n.y - 8 : n.y + PAD + size + i * LINE_H }, t)
      s.textContent = ln
    })
  }
  nodes.filter((n) => n.type === "group").forEach(drawNode)

  for (const e of edges) {
    const a = byId.get(e.fromNode), b = byId.get(e.toNode)
    const fs = e.fromSide || nearestSide(a, b), ts = e.toSide || opposite[nearestSide(a, b)] || nearestSide(b, a)
    const p = anchor(a, fs), q = anchor(b, ts)
    const k = Math.max(30, Math.hypot(q.x - p.x, q.y - p.y) / 3)
    const path = el("path", { d: `M${p.x},${p.y} C${p.x + p.dx * k},${p.y + p.dy * k} ${q.x + q.dx * k},${q.y + q.dy * k} ${q.x},${q.y}`, fill: "none" }, svg)
    const c = colour(e.color)
    path.style.stroke = c || ink
    path.style.strokeWidth = "1.8"
    if (e.toEnd !== "none") path.setAttribute("marker-end", "url(#mt-cv-arrow)")
    if (e.fromEnd === "arrow") path.setAttribute("marker-start", "url(#mt-cv-arrow)")
    if (typeof e.label === "string" && e.label) {
      const t = el("text", { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 4, "text-anchor": "middle", "font-size": 12 }, svg)
      t.style.fill = ink
      t.style.paintOrder = "stroke"
      t.style.stroke = "var(--mt-color-bg)"
      t.style.strokeWidth = "4px"
      t.textContent = e.label.slice(0, 80)
    }
  }
  nodes.filter((n) => n.type !== "group").forEach(drawNode)
  return svg
}

export async function renderCanvas(el) {
  const source = getDiagramSource(el.dataset.mtId)
  try {
    const svg = canvasToSvg(source)
    el.classList.remove("mt-md-diagram-error")
    el.classList.add("mt-md-rendered")
    el.replaceChildren(svg)
  } catch (err) {
    el.classList.add("mt-md-diagram-error")
    const pre = document.createElement("pre")
    pre.className = "mt-md-diagram-source"
    pre.textContent = `Canvas error: ${err.message}\n\n${source}`
    el.textContent = ""
    el.appendChild(pre)
  }
}
