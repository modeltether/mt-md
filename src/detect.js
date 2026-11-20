export function isMarkdownUrl(href) {
  try {
    return /\.md$/i.test(new URL(href).pathname)
  } catch {
    return false
  }
}

export function rawTextFromBody(body) {
  const el = body.querySelector("pre") || body
  return ((el.innerText || el.textContent) || "").replace(/\n$/, "")
}

export function bodyIsRawText(body) {
  if (!body) return false
  if (body.querySelector("table, canvas, video, form, iframe")) return false
  return rawTextFromBody(body).trim().length > 0
}

export function titleFromUrl(href) {
  try {
    const name = decodeURIComponent(new URL(href).pathname.split("/").pop())
    return name.replace(/\.md$/i, "")
  } catch {
    return ""
  }
}

// A server that sends .md as text/plain without a charset makes the browser guess (usually windows-1252), which turns
// "…" into "â€¦". The page text is already decoded, so re-read the raw bytes and decode them as UTF-8, but only when they
// are valid UTF-8 and actually contain non-ASCII; anything else keeps the browser's own reading.
export function decodeUtf8IfValid(buffer, fallback) {
  const bytes = new Uint8Array(buffer)
  if (!bytes.some((b) => b > 0x7f)) return fallback
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "").replace(/\n$/, "")
  } catch {
    return fallback
  }
}

export async function rawTextAsUtf8(href, current, doc = document) {
  if (/^utf-?8$/i.test(doc.characterSet || "")) return current
  try {
    const res = await fetch(href, { cache: "force-cache" })
    if (!res.ok) return current
    return decodeUtf8IfValid(await res.arrayBuffer(), current)
  } catch {
    return current
  }
}

// Text of a freshly read file, shaped like rawTextFromBody() so a reload compares like with like.
export function decodeSource(buffer) {
  return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "").replace(/\n$/, "")
}

// Auto-reload watches file: documents and local dev servers; remote hosts are never polled.
export function canAutoReload(href) {
  try {
    const u = new URL(href)
    return u.protocol === "file:" || ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
  } catch {
    return false
  }
}
