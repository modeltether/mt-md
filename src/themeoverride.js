// An optional mt-md-theme.css next to a local document restyles it. A content script cannot read file: URLs, so the background script
// fetches it (see background.js); over http there is no override.
const api = globalThis.browser ?? globalThis.chrome

export async function loadThemeOverride() {
  if (!location.protocol.startsWith("file:")) return ""
  try {
    const reply = await api.runtime.sendMessage({ type: "mt-md-theme-css" })
    return reply?.ok ? String(reply.text) : ""
  } catch {
    return ""
  }
}
