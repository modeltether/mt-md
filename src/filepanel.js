import { parentDirOf, folderName, fullPath } from "./listing.js"

const ICON_UP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
const ICON_BACK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>'

// The Files section above the contents: a small tree of .md files and folders. Folders load when opened.
// `list(url)` resolves to entries for a folder or null; omit it for a flat list (linked documents), which has no Up.
// `dirUrl` is the folder shown; Up lists its parent in place. `backUrl` is the document read before this one.
// `expanded` lists the folder URLs to show open, and `onState({ dirUrl, open })` reports every change, so a new page can
// bring the same tree back instead of collapsing it.
export function mountFiles({ title, entries, dirUrl, currentUrl, list, backUrl = "", open = true, onToggle, expanded = [], onState, doc = document }) {
  let here = dirUrl
  const openSet = new Set(expanded)
  const report = () => onState?.({ dirUrl: here, open: [...openSet] })
  const section = doc.createElement("section")
  section.className = "mt-md-files"

  const bar = doc.createElement("div")
  bar.className = "mt-md-files-bar"
  const head = doc.createElement("button")
  head.type = "button"
  head.className = "mt-md-files-head"
  head.textContent = title
  head.setAttribute("aria-expanded", String(open))
  const icon = (cls, label, svg) => {
    const b = doc.createElement("button")
    b.type = "button"
    b.className = `mt-md-files-icon ${cls}`
    b.title = label
    b.setAttribute("aria-label", label)
    b.innerHTML = svg
    return b
  }
  const up = icon("mt-md-files-up", "Up to the parent folder", ICON_UP)
  const back = icon("mt-md-files-back", backUrl ? `Back to ${decodeURIComponent(backUrl.split("#")[0].split("/").pop() || backUrl)}` : "No earlier document", ICON_BACK)
  back.disabled = !backUrl
  back.addEventListener("click", () => { location.href = backUrl })
  if (list && dirUrl) bar.append(head, up, back)
  else bar.append(head, back)
  section.appendChild(bar)

  const path = doc.createElement("div")
  path.className = "mt-md-files-path"
  path.hidden = !(list && dirUrl)
  const showPath = (url) => { path.textContent = folderName(url); path.title = fullPath(url) }
  if (dirUrl) showPath(dirUrl)
  section.appendChild(path)

  const body = doc.createElement("div")
  body.className = "mt-md-files-body"
  body.hidden = !open
  section.appendChild(body)
  head.addEventListener("click", () => {
    body.hidden = !body.hidden
    path.hidden = body.hidden || !(list && dirUrl)
    head.setAttribute("aria-expanded", String(!body.hidden))
    onToggle?.(!body.hidden)
  })

  const render = (items, level = 1) => {
    const ul = doc.createElement("ul")
    ul.setAttribute("role", level === 1 ? "tree" : "group")
    if (level === 1) ul.setAttribute("aria-label", title)
    for (const e of items) {
      const li = doc.createElement("li")
      li.setAttribute("role", "none")
      if (e.dir) {
        const b = doc.createElement("button")
        b.type = "button"
        b.className = "mt-md-folder"
        b.setAttribute("role", "treeitem")
        b.setAttribute("aria-level", String(level))
        b.tabIndex = -1
        b._toggle = null
        b.setAttribute("aria-expanded", "false")
        b.textContent = e.name
        b.title = fullPath(e.url)
        let sub = null
        const toggle = async (wantOpen, restoring = false) => {
          b.setAttribute("aria-expanded", String(wantOpen))
          if (wantOpen) openSet.add(e.url)
          else openSet.delete(e.url)
          if (!restoring) report()
          if (sub) { sub.hidden = !wantOpen; return }
          if (!wantOpen) return
          sub = doc.createElement("div")
          sub.className = "mt-md-files-sub"
          sub.textContent = "…"
          li.appendChild(sub)
          const children = await list(e.url).catch(() => null)
          if (!children || !children.length) sub.textContent = children ? "No .md files" : "Can't read this folder"
          else sub.replaceChildren(render(children, level + 1))
        }
        b._toggle = toggle
        b.addEventListener("click", () => toggle(b.getAttribute("aria-expanded") !== "true"))
        li.appendChild(b)
        if (openSet.has(e.url)) toggle(true, true)
      } else {
        const a = doc.createElement("a")
        a.href = e.url
        a.textContent = e.name
        a.title = e.name
        a.setAttribute("role", "treeitem")
        a.setAttribute("aria-level", String(level))
        a.tabIndex = -1
        if (e.url.split("#")[0] === currentUrl.split("#")[0]) {
          a.classList.add("mt-md-current")
          a.setAttribute("aria-current", "page")
        }
        li.appendChild(a)
      }
      ul.appendChild(li)
    }
    return ul
  }
  body.appendChild(render(entries))
  setupTreeKeys(body, doc)

  const atTop = () => !here || parentDirOf(here) === here
  up.disabled = atTop()
  up.addEventListener("click", async () => {
    if (atTop()) return
    const parent = parentDirOf(here)
    const items = await list(parent).catch(() => null)
    if (!items) { path.textContent = "Can't read the parent folder"; return }
    openSet.add(here) // the folder we came from stays open in the parent's list
    here = parent
    showPath(here)
    report()
    body.replaceChildren(items.length ? render(items) : Object.assign(doc.createElement("div"), { className: "mt-md-files-sub", textContent: "No .md files" }))
    up.disabled = atTop()
    setupTreeKeys(body, doc)
  })
  return section
}

// Keyboard use of the tree. One item is in the tab order at a time (the current document, else the first), so Tab enters the
// panel once and leaves it again; the arrows move inside it. Up/Down step through the visible rows, Right opens a folder (and
// then enters it), Left closes one (or goes to the parent folder), Home/End jump, and a letter jumps to the next name that starts with it.
const visibleItems = (body) => [...body.querySelectorAll('[role="treeitem"]')].filter((el) => !el.closest("[hidden]"))

function parentFolderOf(item) {
  const li = item.closest("li")
  return li?.parentElement?.closest("li")?.querySelector(":scope > .mt-md-folder") ?? null
}

function setupTreeKeys(body, doc) {
  const items = () => visibleItems(body)
  const rove = (to) => {
    for (const el of body.querySelectorAll('[role="treeitem"]')) el.tabIndex = el === to ? 0 : -1
  }
  const all = body.querySelectorAll('[role="treeitem"]')
  rove(body.querySelector('[aria-current="page"]') ?? all[0] ?? null)
  if (body._keysBound) return // the listeners are on the body, which survives a rebuild of the list
  body._keysBound = true
  body.addEventListener("focusin", (ev) => { if (ev.target.getAttribute?.("role") === "treeitem") rove(ev.target) })
  let typed = ""
  let typedAt = 0
  body.addEventListener("keydown", async (ev) => {
    const el = ev.target
    if (el.getAttribute?.("role") !== "treeitem" || ev.ctrlKey || ev.metaKey || ev.altKey) return
    const list = items()
    const i = list.indexOf(el)
    const go = (to) => { if (to) { ev.preventDefault(); to.focus() } }
    const isFolder = el.classList.contains("mt-md-folder")
    switch (ev.key) {
      case "ArrowDown": return go(list[i + 1])
      case "ArrowUp": return go(list[i - 1])
      case "Home": return go(list[0])
      case "End": return go(list[list.length - 1])
      case "ArrowRight":
        if (!isFolder) return
        ev.preventDefault()
        if (el.getAttribute("aria-expanded") !== "true") await el._toggle?.(true)
        else go(el.closest("li")?.querySelector(':scope > .mt-md-files-sub [role="treeitem"]'))
        return
      case "ArrowLeft":
        if (isFolder && el.getAttribute("aria-expanded") === "true") { ev.preventDefault(); await el._toggle?.(false) }
        else go(parentFolderOf(el))
        return
      case "Escape": ev.preventDefault(); el.blur(); return
      default:
        if (ev.key.length === 1 && !ev.shiftKey && /\S/.test(ev.key)) {
          // type-ahead: letters typed in quick succession build one prefix
          const now = Date.now()
          typed = now - typedAt > 800 ? ev.key.toLowerCase() : typed + ev.key.toLowerCase()
          typedAt = now
          const from = typed.length === 1 ? i + 1 : i
          const order = [...list.slice(from), ...list.slice(0, from)]
          go(order.find((x) => x.textContent.trim().toLowerCase().startsWith(typed)))
        }
    }
  })
}
