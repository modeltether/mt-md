// "Open in editor" for file: documents. A browser cannot start programs, but editors register a link type of their own
// (vscode://file/…) and the browser hands the link to the operating system, asking the person first.
export const EDITORS = [
  { id: "vscode", label: "VS Code", pattern: "vscode://file{path}" },
  { id: "vscode-insiders", label: "VS Code Insiders", pattern: "vscode-insiders://file{path}" },
  { id: "vscodium", label: "VSCodium", pattern: "vscodium://file{path}" },
  { id: "cursor", label: "Cursor", pattern: "cursor://file{path}" },
  { id: "custom", label: "Custom link…", pattern: "" }
]

export const DEFAULT_EDITOR = { id: "vscode", custom: "" }

export function normalizeEditor(value) {
  const id = EDITORS.some((e) => e.id === value?.id) ? value.id : DEFAULT_EDITOR.id
  return { id, custom: typeof value?.custom === "string" ? value.custom : "" }
}

export const editorLabel = (editor) => EDITORS.find((e) => e.id === editor.id)?.label || "your editor"

// {path} is the file's path as it appears in the URL (already percent-encoded, with the drive letter on Windows,
// e.g. /C:/Users/a/x.md); {url} is the whole file: URL. Returns "" when there is nothing to open.
export function editorLink(fileUrl, editor) {
  let u
  try { u = new URL(fileUrl.split("#")[0]) } catch { return "" }
  if (u.protocol !== "file:") return ""
  const pattern = editor.id === "custom" ? editor.custom : EDITORS.find((e) => e.id === editor.id)?.pattern
  if (!pattern || !/^[a-z][a-z0-9+.-]*:/i.test(pattern)) return ""
  if (/^(javascript|data|file|blob|about):/i.test(pattern)) return ""
  return pattern.replaceAll("{path}", u.pathname).replaceAll("{url}", u.href)
}
