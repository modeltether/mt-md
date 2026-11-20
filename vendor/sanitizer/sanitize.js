import createDOMPurify from "dompurify"

let instance

function purify() {
  if (!instance) {
    const win = typeof window !== "undefined" ? window : globalThis
    instance = typeof createDOMPurify === "function" && !createDOMPurify.sanitize
      ? createDOMPurify(win)
      : createDOMPurify
  }
  return instance
}

export function sanitizeHtml(dirty, config) {
  return purify().sanitize(dirty, config)
}
