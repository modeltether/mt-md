// Builds dist/welcome.html: src/popup/welcome.md is rendered with the same Markdown pipeline as the viewer and poured into the
// slots (<!--slot:name-->) of src/popup/welcome.html. The page then has no Markdown parser at run time; welcome.js only wires
// the live controls and applies the viewer's own theme, layout and CSS.
import { JSDOM } from "jsdom"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

export function splitSlots(md) {
  const slots = {}
  let name = null
  for (const line of md.split("\n")) {
    const m = /^<!--\s*slot:\s*([\w-]+)\s*-->\s*$/.exec(line)
    if (m) { name = m[1]; slots[name] = []; continue }
    if (name) slots[name].push(line)
  }
  return Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v.join("\n").trim()]))
}

export async function buildWelcome() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>")
  for (const k of ["window", "document", "DOMParser", "Node", "Element", "HTMLElement", "DocumentFragment"]) globalThis[k] = k === "window" ? dom.window : dom.window[k]
  const { markdownToHtml } = await import(pathToFileURL(path.join(root, "src/render.js")).href)
  const slots = splitSlots(readFileSync(path.join(root, "src/popup/welcome.md"), "utf8"))
  let html = readFileSync(path.join(root, "src/popup/welcome.html"), "utf8")
  const used = new Set()
  html = html.replace(/<!--\s*slot:\s*([\w-]+)\s*-->/g, (_, n) => {
    if (!(n in slots)) throw new Error(`welcome.html asks for slot "${n}" that welcome.md does not have`)
    used.add(n)
    return markdownToHtml(slots[n])
  })
  for (const n of Object.keys(slots)) if (!used.has(n)) throw new Error(`welcome.md slot "${n}" is not used in welcome.html`)
  mkdirSync(path.join(root, "dist"), { recursive: true })
  writeFileSync(path.join(root, "dist/welcome.html"), html)
  return html
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await buildWelcome()
