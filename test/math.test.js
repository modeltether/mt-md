import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { markdownToHtml } from "../src/render.js"
import { renderMath } from "../src/math.js"
import { renderGraphviz } from "../src/diagrams/graphviz.js"
import { registerDiagramSource } from "../src/diagrams/sources.js"

function mount(md) {
  const div = document.createElement("div")
  div.innerHTML = markdownToHtml(md)
  return div
}

test("inline and display math become placeholders, source kept out of HTML", () => {
  const div = mount("Inline $E = mc^2$ here.\n\n$$\\int_0^1 x\\,dx$$\n")
  assert.equal(div.querySelectorAll("span.mt-md-math").length, 1)
  assert.equal(div.querySelectorAll("div.mt-md-math-display").length, 1)
  assert.ok(!div.innerHTML.includes("mc^2"))
})

test("dollar amounts are not treated as math", () => {
  const div = mount("It costs $5 and $10 total.\n")
  assert.equal(div.querySelectorAll(".mt-md-math").length, 0)
})

test("multi-line display math", () => {
  const div = mount("$$\na = b\n$$\n")
  assert.equal(div.querySelectorAll(".mt-md-math-display").length, 1)
})

test("renderMath emits MathML", () => {
  const div = mount("Inline $x^2$ and\n\n$$\\sqrt{\\pi}$$\n")
  renderMath(div)
  assert.equal(div.querySelectorAll("math").length, 2)
  assert.ok(div.querySelector("math[display='block']"))
})

test("math inside code is left alone", () => {
  const div = mount("`$x$`\n\n```\n$$y$$\n```\n")
  assert.equal(div.querySelectorAll(".mt-md-math").length, 0)
})

test("dot and graphviz fences become graphviz placeholders", () => {
  for (const lang of ["dot", "graphviz"]) {
    const div = mount("```" + lang + "\ndigraph { a -> b }\n```\n")
    assert.ok(div.querySelector('.mt-md-diagram[data-mt-diagram="graphviz"]'))
  }
})

function gv(source) {
  const el = document.createElement("div")
  el.dataset.mtId = registerDiagramSource(source)
  return el
}

test("renderGraphviz renders DOT to inline SVG", async () => {
  const el = gv("digraph G { A -> B; A -> D; }")
  await renderGraphviz(el)
  assert.ok(el.querySelector("svg"))
  assert.ok(el.classList.contains("mt-md-rendered"))
})

test("renderGraphviz surfaces a syntax error", async () => {
  const el = gv("digraph { a -> ")
  await renderGraphviz(el)
  assert.ok(el.classList.contains("mt-md-diagram-error"))
  assert.match(el.textContent, /Graphviz error/)
})

test("```math fences and $`x`$ render as math, like on GitHub and GitLab", async () => {
  const { markdownToHtml } = await import("../src/render.js")
  const html = markdownToHtml("```math\na^2\n```\n\nInline $`x^2`$ and $y$.\n")
  assert.equal((html.match(/class="mt-md-math/g) || []).length, 3)
  assert.ok(!/language-math/.test(html))
})
