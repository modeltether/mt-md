export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
}

export function headingSlugs(texts) {
  const seen = new Map()
  return texts.map((text) => {
    const base = slugify(text)
    const n = seen.get(base) || 0
    seen.set(base, n + 1)
    return n > 0 ? `${base}-${n}` : base
  })
}

export function buildToc(article) {
  const headings = [...article.querySelectorAll("h1, h2, h3, h4, h5, h6")]
  const slugs = headingSlugs(headings.map((h) => h.textContent))
  const entries = []
  headings.forEach((h, i) => {
    h.id = slugs[i]
    entries.push({ id: slugs[i], level: Number(h.tagName[1]), text: h.textContent })
  })
  return entries
}

// `files` is the optional Files section, placed above the headings. With no headings the sidebar holds only the files.
export function mountToc(entries, files = null) {
  const nav = document.createElement("nav")
  nav.id = "mt-md-toc"
  nav.className = "mt-md-toc"
  if (!entries.length) nav.classList.add("mt-md-toc-filesonly")

  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "mt-md-toc-toggle"
  btn.textContent = entries.length ? "Contents" : "Files"
  btn.addEventListener("click", () => nav.classList.toggle("mt-md-toc-open"))
  nav.appendChild(btn)
  if (files) nav.appendChild(files)

  const ul = document.createElement("ul")
  for (const entry of entries) {
    const li = document.createElement("li")
    li.className = `mt-md-l${entry.level}`
    const a = document.createElement("a")
    a.href = `#${entry.id}`
    a.textContent = entry.text
    a.addEventListener("click", (ev) => {
      ev.preventDefault()
      document.getElementById(entry.id)?.scrollIntoView({ behavior: "smooth" })
      history.replaceState(null, "", `#${entry.id}`)
    })
    li.appendChild(a)
    ul.appendChild(li)
  }
  nav.appendChild(ul)
  return nav
}

export function setupScrollspy(article, toc) {
  const headings = [...article.querySelectorAll("h1, h2, h3, h4, h5, h6")]
  const links = [...toc.querySelectorAll('a[href^="#"]')]
  const linkById = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]))
  let activeId = null

  const update = () => {
    let current = headings[0]
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= 80) current = h
      else break
    }
    if (!current || current.id === activeId) return
    if (activeId) linkById.get(activeId)?.classList.remove("mt-md-toc-active")
    activeId = current.id
    linkById.get(current.id)?.classList.add("mt-md-toc-active")
  }

  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      update()
    })
  }
  document.addEventListener("scroll", onScroll, { passive: true })
  // headings move when diagrams and images finish laying out, and when the window resizes
  window.addEventListener("resize", onScroll)
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null
  observer?.observe(article)
  update()
  return () => {
    document.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    observer?.disconnect()
  }
}
