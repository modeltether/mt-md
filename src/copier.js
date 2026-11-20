// Copy: the quick copy-and-paste tool. One choice (the gear on its Settings row): what lands on the clipboard.
// No files, images options or downloads: it is meant for a paste into a chat, an e-mail, a document or an editor.
import { domToModel } from "./docmodel.js"
import { buildText } from "./export-text.js"

export const COPY_KEY = "mt-md-copy"

export const COPY_FORMATS = [
  { id: "html", label: "HTML code", short: "the page's HTML code", done: "HTML code" },
  { id: "rich", label: "Formatted, to paste into Word, Docs or e-mail", short: "the formatted page, ready to paste into a document or e-mail", done: "formatted text" },
  { id: "md", label: "Markdown source", short: "the Markdown source", done: "Markdown" },
  { id: "txt", label: "Plain text", short: "plain text", done: "plain text" },
]
const DEFAULT_COPY = { format: "html" }

export function normalizeCopy(v) {
  const o = v && typeof v === "object" ? v : {}
  return { format: COPY_FORMATS.some((f) => f.id === o.format) ? o.format : DEFAULT_COPY.format }
}

// The words for the button's tooltip and accessible name, so both say what a click will do.
export function describeCopy(settings) {
  const f = COPY_FORMATS.find((x) => x.id === normalizeCopy(settings).format)
  return { label: `Copy ${f.done}`, title: `Copy ${f.short} to the clipboard` }
}

// The rendered document without the contents/Files column.
function cleanClone(root) {
  const copy = root.cloneNode(true)
  copy.querySelector("#mt-md-toc")?.remove()
  return copy
}

// What to put on the clipboard: { text, html? }. `html` is set only when the paste target should get formatting.
export async function copyPayload(format, { rendered, source }) {
  const f = normalizeCopy({ format }).format
  if (f === "md") return { text: source }
  if (f === "html") return { text: cleanClone(rendered).innerHTML }
  const copy = cleanClone(rendered)
  const text = buildText(await domToModel(copy, { image: async () => null }))
  return f === "txt" ? { text } : { text, html: copy.innerHTML }
}

export async function copyToClipboard(payload) {
  if (payload.html && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const blob = (type, s) => new Blob([s], { type })
    await navigator.clipboard.write([new ClipboardItem({ "text/html": blob("text/html", payload.html), "text/plain": blob("text/plain", payload.text) })])
    return
  }
  await navigator.clipboard.writeText(payload.text)
}
