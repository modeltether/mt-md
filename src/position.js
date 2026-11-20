// Keeps the reader's place across page loads. The page is built after the browser's own scroll restoration and anchor
// jump have already run (against the raw text), so both are redone here once the rendered document exists:
//   - a link to another document's #section lands on that section
//   - Back and Forward return to where you were reading
// Headings move while diagrams and images lay out, so the position is re-applied a few times, until the reader scrolls themselves.
const RETRY_MS = [0, 150, 500, 1200]

export function startPosition({ win = window, doc = document, hist = history, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  try { hist.scrollRestoration = "manual" } catch { /* not supported */ }
  const savedY = Number(hist.state?.mtScrollY) || 0
  const hash = (win.location.hash || "").slice(1)
  let id = hash
  try { id = decodeURIComponent(hash) } catch { /* use as written */ }

  let stopped = false
  const timers = []
  const stopRetrying = () => {
    stopped = true
    timers.forEach(clearTimer)
    for (const type of ["wheel", "keydown", "touchstart", "pointerdown"]) win.removeEventListener(type, stopRetrying, true)
  }
  for (const type of ["wheel", "keydown", "touchstart", "pointerdown"]) win.addEventListener(type, stopRetrying, true)

  const apply = () => {
    if (stopped) return
    const target = id ? doc.getElementById(id) : null
    if (target) target.scrollIntoView()
    else if (!id && savedY > 0) win.scrollTo(0, savedY)
  }
  const wanted = !!id || savedY > 0
  if (wanted) for (const ms of RETRY_MS) timers.push(setTimer(apply, ms))

  // remember where the reader is, for the next time this history entry is shown; only once the restore has settled
  let saveTimer = null
  const save = () => {
    try { hist.replaceState({ ...(hist.state || {}), mtScrollY: Math.round(win.scrollY) }, "") } catch { /* sandboxed */ }
  }
  const onScroll = () => {
    if (!stopped && wanted) return // our own restoring scrolls are not the reader's
    clearTimer(saveTimer)
    saveTimer = setTimer(save, 150)
  }
  win.addEventListener("scroll", onScroll, { passive: true })
  win.addEventListener("pagehide", save)
  timers.push(setTimer(() => { stopped = true }, RETRY_MS[RETRY_MS.length - 1] + 100))
  return () => {
    stopRetrying()
    win.removeEventListener("scroll", onScroll)
    win.removeEventListener("pagehide", save)
    clearTimer(saveTimer)
  }
}
