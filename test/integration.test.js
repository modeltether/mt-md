import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { applyMermaidStubs } from "./mermaid-stubs.js"

const dir = path.dirname(fileURLToPath(import.meta.url))
const bundle = ["mt-md-mermaid.js", "mt-md-graphviz.js", "mt-md-vega.js", "mt-md-infographic.js", "mt-md-drawio.js", "mt-md.js"]
  .map((f) => readFileSync(path.join(dir, "../dist", f), "utf8"))
  .join("\n;\n")
const sample = readFileSync(path.join(dir, "sample.md"), "utf8")

function renderSample() {
  const dom = new JSDOM(
    `<!doctype html><html><body><pre>${escapeHtml(sample)}</pre></body></html>`,
    { url: "file:///home/a/b/sample.md", runScripts: "outside-only" }
  )
  applyMermaidStubs(dom.window)
  dom.window.eval(bundle)
  return dom
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

async function waitFor(fn, timeoutMs = 8000) {
  const start = Date.now()
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out")
    await new Promise((r) => setTimeout(r, 25))
  }
}

test("the bundle renders a .md fixture end to end", async () => {
  const dom = renderSample()
  const { document } = dom.window

  await waitFor(() => document.getElementById("mt-md-root"))
  assert.ok(document.getElementById("mt-md-root"), "root mounted")
  assert.ok(document.querySelector(".mt-md-article"), "article rendered")
  assert.ok(document.querySelector(".mt-md-title")?.textContent === "Sample Document", "front matter title")
  assert.ok(document.querySelector(".mt-status")?.textContent === "Draft", "status badge")
  assert.ok(document.querySelector(".mt-md-header .mt-md-meta"), "meta line")
  assert.ok(document.querySelector("table"), "GFM table")
  assert.ok(document.querySelector(".mt-md-toc"), "TOC mounted")
  assert.ok(document.getElementById("mt-md-toolbar"), "toolbar mounted")
  assert.ok(document.querySelector(".mt-md-article h2#core-markdown"), "heading got a TOC slug id")
  assert.ok(document.querySelector(".mt-md-raw-view"), "raw view present but hidden")
  assert.equal(document.querySelector(".mt-md-raw-view").hidden, true)
  assert.equal(document.title, "Sample Document")

  const block = document.querySelector(".mt-md-codeblock")
  assert.ok(block, "code block wrapped")
  assert.equal(block.querySelector(".mt-md-lang").textContent, "js")
  assert.ok(block.querySelector(".mt-md-copy"), "copy button")
  assert.ok(block.querySelector("pre code .token"), "Prism highlighted the code")
  assert.ok(block.querySelector(".line-numbers-rows"), "line numbers rendered")
  assert.ok(block.querySelector(".line-highlight"), "hl_lines highlighted")
  assert.ok(document.querySelector(".mt-admonition-note"), "NOTE admonition")
  assert.ok(document.querySelector(".mt-admonition-warning"), "WARNING admonition")
  assert.ok(document.querySelector(".mt-admonition-tip"), "TIP admonition")
  const details = document.querySelector(".mt-md-article details")
  assert.ok(details, "details rendered")
  assert.equal(details.querySelector("summary").textContent, "Click to expand")
  assert.ok(details.querySelector("li"), "markdown inside details")

  const diagram = document.querySelector(".mt-md-diagram")
  assert.ok(diagram, "diagram placeholder present")
  await waitFor(() => diagram.querySelector("svg"))
  assert.ok(diagram.querySelector("svg"), "mermaid rendered to inline SVG")

  // flowcharts must use the bundled dagre layout; the ELK engine is stubbed out of the bundle
  const flow = document.querySelectorAll('.mt-md-diagram[data-mt-diagram="mermaid"]')[1]
  assert.ok(flow, "flowchart placeholder present")
  await waitFor(() => flow.querySelector("svg") || flow.querySelector(".mt-md-diagram-source"))
  assert.ok(flow.querySelector("svg"), `flowchart rendered: ${flow.textContent.slice(0, 120)}`)

  const dot = document.querySelector('.mt-md-diagram[data-mt-diagram="graphviz"]')
  assert.ok(dot, "graphviz placeholder present")
  await waitFor(() => dot.querySelector("svg"))
  assert.equal(document.querySelectorAll(".mt-md-math math").length, 2, "inline + display math as MathML")
  dom.window.close()
})

test("the bundle does nothing on a non-.md page", () => {
  const dom = new JSDOM("<!doctype html><html><body><p>hi</p></body></html>", {
    url: "https://example.com/page.html",
    runScripts: "outside-only"
  })
  applyMermaidStubs(dom.window)
  dom.window.eval(bundle)
  assert.ok(!dom.window.document.getElementById("mt-md-root"), "no mount on non-.md")
})
