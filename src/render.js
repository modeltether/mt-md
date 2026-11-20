import MarkdownIt from "markdown-it"
import footnote from "markdown-it-footnote"
import taskLists from "markdown-it-task-lists"
import sub from "markdown-it-sub"
import sup from "markdown-it-sup"
import { statusClass } from "./frontmatter.js"
import { fenceRenderer } from "./codeblocks.js"
import { detailsPlugin } from "./details.js"
import { mathPlugin } from "./math.js"
import { sanitizeHtml } from "../vendor/sanitizer/sanitize.js"

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false
})
  .use(footnote)
  .use(taskLists, { enabled: false })
  .use(sub)
  .use(sup)
  .use(detailsPlugin)
  .use(mathPlugin)

md.renderer.rules.fence = fenceRenderer(md)

// markdown-it only lets gif/png/jpeg/webp data: URIs through; a bundled .md also carries SVG (inert inside <img>), AVIF and BMP.
const defaultValidateLink = md.validateLink
md.validateLink = (url) => /^data:image\/(gif|png|jpe?g|webp|svg\+xml|avif|bmp);base64,/i.test(url.trim()) || defaultValidateLink(url)

// Raw HTML in a document may not become a form: a page that asks for a password, or posts somewhere, would look like the site it is on.
// The only controls left are the disabled checkboxes of task lists.
const FORMS = { FORBID_TAGS: ["form", "button", "select", "option", "optgroup", "textarea", "fieldset", "datalist"] }

export function markdownToHtml(raw) {
  const tpl = document.createElement("template")
  tpl.innerHTML = sanitizeHtml(md.render(raw), FORMS)
  tpl.content.querySelectorAll("input:not([type=checkbox])").forEach((i) => i.remove())
  return tpl.innerHTML
}

function buildHeader(front) {
  const header = document.createElement("header")
  header.className = "mt-md-header"
  if (front.title) {
    const h = document.createElement("h1")
    h.className = "mt-md-title"
    h.textContent = front.title
    header.appendChild(h)
  }
  const meta = [front.author, front.date, front.audience, front.version && `v${front.version}`]
    .filter(Boolean)
  if (meta.length) {
    const p = document.createElement("p")
    p.className = "mt-md-meta"
    p.textContent = meta.join(" · ")
    header.appendChild(p)
  }
  if (front.status) {
    const badge = document.createElement("span")
    badge.className = `mt-status ${statusClass(front.status)}`
    badge.textContent = front.status
    header.appendChild(badge)
  }
  return header
}

export function renderDocument(front, body) {
  const doc = document.createElement("div")
  doc.className = "mt-md-doc"
  if (front && Object.keys(front).length) doc.appendChild(buildHeader(front))
  const article = document.createElement("div")
  article.className = "mt-md-article"
  article.innerHTML = markdownToHtml(body)
  doc.appendChild(article)
  return doc
}
