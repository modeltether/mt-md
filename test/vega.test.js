import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { renderVega, setVegaTheme } from "../src/diagrams/vega.js"
import { registerDiagramSource } from "../src/diagrams/sources.js"
import { markdownToHtml } from "../src/render.js"

function placeholder(kind, source) {
  const el = document.createElement("div")
  el.className = "mt-md-diagram"
  el.dataset.mtDiagram = kind
  el.dataset.mtId = registerDiagramSource(source)
  document.body.appendChild(el)
  return el
}

const lite = JSON.stringify({
  data: { values: [{ a: "x", b: 1 }, { a: "y", b: 3 }] },
  mark: "bar",
  encoding: { x: { field: "a", type: "nominal" }, y: { field: "b", type: "quantitative" } }
})

test("fences labelled vega, vega-lite and vegalite become diagram placeholders", () => {
  const html = markdownToHtml("```vega-lite\n{}\n```\n\n```vegalite\n{}\n```\n\n```vega\n{}\n```\n")
  assert.equal((html.match(/data-mt-diagram="vega-lite"/g) || []).length, 2)
  assert.equal((html.match(/data-mt-diagram="vega"/g) || []).length, 1)
})

test("a Vega-Lite chart renders to inline SVG", async () => {
  const el = placeholder("vega-lite", lite)
  await renderVega(el)
  assert.ok(el.querySelector("svg"), el.textContent)
  assert.ok(el.classList.contains("mt-md-rendered"))
})

test("a Vega chart renders, with expressions run by the CSP-safe interpreter", async () => {
  const spec = {
    width: 100, height: 60,
    data: [{ name: "t", values: [{ v: 1 }, { v: 2 }] }],
    scales: [{ name: "y", type: "linear", domain: { data: "t", field: "v" }, range: "height" }],
    marks: [{ type: "rect", from: { data: "t" }, encode: { enter: { x: { signal: "datum.v * 10" }, width: { value: 5 }, y: { scale: "y", field: "v" }, y2: { value: 0 } } } }]
  }
  const el = placeholder("vega", JSON.stringify(spec))
  await renderVega(el)
  assert.ok(el.querySelector("svg"), el.textContent)
})

test("a chart cannot make the page fetch a URL", async () => {
  const el = placeholder("vega-lite", JSON.stringify({ data: { url: "http://127.0.0.1:9/x.csv" }, mark: "bar" }))
  await renderVega(el)
  assert.ok(el.classList.contains("mt-md-diagram-error"))
  assert.match(el.textContent, /External data is not loaded/)
})

test("bad JSON shows an error with the source", async () => {
  const el = placeholder("vega", "{ nope")
  await renderVega(el)
  assert.ok(el.classList.contains("mt-md-diagram-error"))
  assert.match(el.textContent, /Vega error/)
})

test("a chart is redrawn when the theme changes, with readable text for each", async () => {
  const el = placeholder("vega-lite", lite)
  await renderVega(el)
  const light = el.innerHTML
  setVegaTheme("dark")
  await new Promise((r) => setTimeout(r, 300))
  assert.notEqual(el.innerHTML, light)
  assert.match(el.innerHTML, /#e6edf3/i)
  setVegaTheme("light")
})
