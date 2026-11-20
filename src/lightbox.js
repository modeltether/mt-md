// Image viewer: click an image in the document to see it large over the page. Left/Right (or the arrows) step through the
// document's images, a click on the picture toggles full size, Escape or a click outside closes. Images that are links are left alone.
let overlay = null
let items = []
let index = 0

function close() {
  if (!overlay) return
  document.removeEventListener("keydown", onKey, true)
  overlay.remove()
  overlay = null
}

function show(i) {
  index = (i + items.length) % items.length
  const img = items[index]
  const pic = overlay.querySelector(".mt-md-lb-img")
  pic.classList.remove("mt-md-lb-full")
  pic.style.width = ""
  pic.src = img.currentSrc || img.src
  pic.alt = img.alt || ""
  overlay.querySelector(".mt-md-lb-caption").textContent = img.alt || img.title || ""
  overlay.querySelector(".mt-md-lb-count").textContent = items.length > 1 ? `${index + 1} / ${items.length}` : ""
  overlay.classList.toggle("mt-md-lb-single", items.length < 2)
}

// The picture is scaled to fill the window (small ones are enlarged); a click shows it at its own size, and again goes back.
function fit(pic) {
  const w = pic.naturalWidth
  const h = pic.naturalHeight
  if (!w || !h) return
  const full = pic.classList.contains("mt-md-lb-full")
  const scale = full ? 1 : Math.min((window.innerWidth * 0.94) / w, (window.innerHeight * 0.86) / h)
  pic.style.width = `${Math.round(w * scale)}px`
}

function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close() }
  else if (e.key === "ArrowRight" && items.length > 1) { e.preventDefault(); show(index + 1) }
  else if (e.key === "ArrowLeft" && items.length > 1) { e.preventDefault(); show(index - 1) }
}

function button(cls, label, text, fn) {
  const b = document.createElement("button")
  b.type = "button"
  b.className = `mt-md-lb-btn ${cls}`
  b.setAttribute("aria-label", label)
  b.title = label
  b.textContent = text
  b.addEventListener("click", (e) => { e.stopPropagation(); fn() })
  return b
}

function open(list, at) {
  close()
  items = list
  overlay = document.createElement("div")
  overlay.id = "mt-md-lightbox"
  overlay.setAttribute("role", "dialog")
  overlay.setAttribute("aria-modal", "true")
  overlay.setAttribute("aria-label", "Image viewer")
  const pic = document.createElement("img")
  pic.className = "mt-md-lb-img"
  pic.addEventListener("click", (e) => { e.stopPropagation(); pic.classList.toggle("mt-md-lb-full"); fit(pic) })
  pic.addEventListener("load", () => fit(pic))
  const caption = document.createElement("div")
  caption.className = "mt-md-lb-caption"
  const count = document.createElement("div")
  count.className = "mt-md-lb-count"
  overlay.append(
    pic, caption, count,
    button("mt-md-lb-close", "Close (Esc)", "×", close),
    button("mt-md-lb-prev", "Previous image (Left arrow)", "‹", () => show(index - 1)),
    button("mt-md-lb-next", "Next image (Right arrow)", "›", () => show(index + 1))
  )
  overlay.addEventListener("click", close)
  document.body.appendChild(overlay)
  document.addEventListener("keydown", onKey, true)
  show(at)
  overlay.querySelector(".mt-md-lb-close").focus()
}

export function setupLightbox(article) {
  const imgs = [...article.querySelectorAll("img")].filter((img) => !img.closest("a"))
  for (const img of imgs) {
    img.classList.add("mt-md-zoomable")
    img.addEventListener("click", () => {
      const shown = imgs.filter((i) => !i.complete || i.naturalWidth > 0) // skip pictures that failed to load
      open(shown, Math.max(0, shown.indexOf(img)))
    })
  }
}
