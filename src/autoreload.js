// Watches a document's source and calls onChange(text) when it differs from the last read.
// read() resolves to the current text; the first successful read is the baseline, so nothing fires at start-up.
export function createAutoReload({ read, onChange, interval = 1000, doc = document, setTimer = setInterval, clearTimer = clearInterval }) {
  let last = null
  let timer = null
  let busy = false

  async function check() {
    if (busy || doc.visibilityState === "hidden") return false
    busy = true
    try {
      const text = await read()
      if (last === null) { last = text; return false }
      if (text === last) return false
      last = text
      onChange(text)
      return true
    } catch {
      return false // file briefly missing while an editor saves, or the server restarting: try again next tick
    } finally {
      busy = false
    }
  }

  const onVisible = () => { if (doc.visibilityState === "visible" && timer) check() }
  return {
    check,
    get running() { return timer !== null },
    start() {
      if (timer) return
      timer = setTimer(check, interval)
      doc.addEventListener?.("visibilitychange", onVisible)
      check()
    },
    stop() {
      if (!timer) return
      clearTimer(timer)
      timer = null
      doc.removeEventListener?.("visibilitychange", onVisible)
    },
  }
}

// A file: page reads its own file in two ways. Firefox lets the page fetch it directly; Chrome does not, so the background script
// does it (and only for the document that asked). Everything else is fetched directly.
export async function readSource(url, decode, api = globalThis.browser ?? globalThis.chrome) {
  if (url.startsWith("file:")) {
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (res.ok) return decode(await res.arrayBuffer())
    } catch { /* this browser blocks it: ask the background script */ }
    const reply = await api.runtime.sendMessage({ type: "mt-md-read", url })
    if (!reply?.ok) throw new Error(reply?.error || "cannot read file")
    return reply.text
  }
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return decode(await res.arrayBuffer())
}
