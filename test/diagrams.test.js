import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { applyMermaidStubs } from "./mermaid-stubs.js"
import { renderMermaid } from "../src/diagrams/mermaid.js"
import { registerDiagramSource } from "../src/diagrams/sources.js"

applyMermaidStubs(globalThis.window)

function placeholder(source) {
  const el = document.createElement("div")
  el.className = "mt-md-diagram"
  el.dataset.mtDiagram = "mermaid"
  el.dataset.mtId = registerDiagramSource(source)
  return el
}

test("renderMermaid renders a sequence diagram to inline SVG", async () => {
  const el = placeholder("sequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi back\n")
  await renderMermaid(el)
  const svg = el.querySelector("svg")
  assert.ok(svg, "svg injected")
  assert.ok(el.classList.contains("mt-md-rendered"))
})

test("renderMermaid renders a flowchart", async () => {
  const el = placeholder("graph TD\n    A-->B\n    B-->C\n")
  await renderMermaid(el)
  assert.ok(el.querySelector("svg"))
})

test("renderMermaid surfaces a parse error instead of throwing", async () => {
  const el = placeholder("sequenceDiagram\n    this is not valid mermaid at all %%%\n")
  await renderMermaid(el)
  assert.ok(el.classList.contains("mt-md-diagram-error"))
  assert.match(el.textContent, /Mermaid error/)
})
