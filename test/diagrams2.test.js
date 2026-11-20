import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import zlib from "node:zlib"
import "./setup-window.js"

globalThis.DOMParser = window.DOMParser
globalThis.XMLSerializer = window.XMLSerializer
globalThis.getComputedStyle ??= window.getComputedStyle.bind(window)
import { canvasToSvg, renderCanvas } from "../src/diagrams/canvas.js"
import { modelXml, cleanLabels, renderDrawio } from "../src/diagrams/drawio.js"
import { registerDiagramSource } from "../src/diagrams/sources.js"
import { markdownToHtml } from "../src/render.js"

const canvas = {
  nodes: [
    { id: "g", type: "group", x: 0, y: 0, width: 400, height: 300, label: "Group" },
    { id: "a", type: "text", x: 20, y: 20, width: 160, height: 80, text: "# Title\nSome **bold** words", color: "4" },
    { id: "b", type: "file", x: 220, y: 20, width: 160, height: 60, file: "notes/x.md" },
    { id: "c", type: "link", x: 20, y: 160, width: 160, height: 60, url: "https://example.com" }
  ],
  edges: [{ id: "e", fromNode: "a", toNode: "b", label: "goes" }, { id: "bad", fromNode: "a", toNode: "missing" }]
}

test("fences for canvas, drawio and infographic become diagram placeholders", () => {
  const html = markdownToHtml("```canvas\n{}\n```\n\n```jsoncanvas\n{}\n```\n\n```drawio\n<a/>\n```\n\n```infographic\nx\n```\n")
  assert.equal((html.match(/data-mt-diagram="canvas"/g) || []).length, 2)
  assert.match(html, /data-mt-diagram="drawio"/)
  assert.match(html, /data-mt-diagram="infographic"/)
})

test("a canvas draws its nodes, group, label and edge, and drops edges to missing nodes", () => {
  const svg = canvasToSvg(JSON.stringify(canvas))
  const text = svg.textContent
  const flat = text.replace(/\s+/g, "")
  for (const t of ["Group", "Title", "bold", "notes/x.md", "https://example.com", "goes"]) assert.ok(flat.includes(t.replace(/\s+/g, "")), t)
  assert.ok(!text.includes("**"), "emphasis marks are removed")
  assert.equal(svg.querySelectorAll("path[marker-end]").length, 1)
  assert.equal(svg.querySelectorAll("rect").length, 4)
})

test("a canvas can carry only shapes and text: hostile values stay inert", () => {
  const bad = { nodes: [{ id: "a", type: "text", x: 0, y: 0, width: 300, height: 120, text: "<img src=x onerror=alert(1)><script>x</script>", color: "red; background:url(x)" }] }
  const svg = canvasToSvg(JSON.stringify(bad))
  assert.equal(svg.querySelectorAll("img,script,image,foreignObject").length, 0)
  assert.ok(svg.textContent.replace(/\s+/g, "").includes("<imgsrc=x"), "shown as text")
  assert.ok(!/url\(x\)/.test(svg.outerHTML), "unknown colour ignored")
})

test("a canvas with no nodes or bad JSON shows an error", async () => {
  for (const src of ["{ nodes: [] }", '{ "nodes": [] }', "[]"]) {
    const el = document.createElement("div")
    el.dataset.mtId = registerDiagramSource(src)
    await renderCanvas(el)
    assert.ok(el.classList.contains("mt-md-diagram-error"), src)
  }
})

const MODEL = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'

test("draw.io: plain model, a file with a plain page, and a compressed page all give the model", async () => {
  assert.match(await modelXml(MODEL), /^<mxGraphModel/)
  assert.match(await modelXml(`<mxfile><diagram name="p">${MODEL}</diagram></mxfile>`), /^<mxGraphModel/)
  const packed = zlib.deflateRawSync(Buffer.from(encodeURIComponent(MODEL))).toString("base64")
  assert.match(await modelXml(`<mxfile><diagram name="p">${packed}</diagram></mxfile>`), /^<mxGraphModel/)
})

test("draw.io: bad input is refused", async () => {
  await assert.rejects(modelXml("not xml <<<"), /not valid XML/)
  await assert.rejects(modelXml("<mxfile><diagram></diagram></mxfile>"), /No diagram/)
  await assert.rejects(modelXml("x".repeat(2_100_000)), /larger than/)
})

test("the infographic bundle holds no address of the library's font or icon servers", { skip: !existsSync(new URL("../dist/mt-md-infographic.js", import.meta.url)) }, () => {
  const code = readFileSync(new URL("../dist/mt-md-infographic.js", import.meta.url), "utf8")
  assert.ok(!/antgroup|weavefox|alipayobjects/.test(code))
})

test("draw.io: an HTML label is sanitised before maxGraph writes it into the page", async () => {
  const hostile = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
    + '<mxCell id="2" value="&lt;img src=x onerror=alert(1)&gt;hi &lt;script&gt;x&lt;/script&gt;&lt;b&gt;bold&lt;/b&gt;" style="html=1" vertex="1" parent="1"><mxGeometry x="10" y="10" width="160" height="60" as="geometry"/></mxCell>'
    + '<UserObject id="3" label="&lt;svg onload=alert(2)&gt;" tooltip="&lt;img src=y onerror=alert(3)&gt;"><mxCell style="html=1" vertex="1" parent="1"><mxGeometry x="10" y="100" width="160" height="60" as="geometry"/></mxCell></UserObject>'
    + '</root></mxGraphModel>'
  const cleaned = cleanLabels(hostile)
  assert.ok(!/onerror|onload|<script/i.test(cleaned.replace(/&lt;b&gt;/g, "")), cleaned)
  assert.match(cleaned, /bold/)
  // nothing with a handler is ever inserted into the live document, not even for a moment
  const seen = []
  const watch = new window.MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) seen.push(n.outerHTML ?? "", ...[...n.querySelectorAll("*")].map((c) => c.outerHTML))
  })
  watch.observe(document, { childList: true, subtree: true })
  const el = document.createElement("div")
  document.body.appendChild(el)
  el.dataset.mtId = registerDiagramSource(hostile)
  await renderDrawio(el)
  await new Promise((ok) => setTimeout(ok, 0))
  watch.disconnect()
  assert.ok(!el.classList.contains("mt-md-diagram-error"), el.textContent)
  assert.ok(el.querySelector("svg"), "the diagram is drawn")
  assert.deepEqual(seen.filter((h) => /\son(error|load)=|<script/i.test(h)), [])
  assert.ok(!/onerror|onload/i.test(el.innerHTML))
})
