// Where an export may be saved: a file name, and an optional folder below the browser's Downloads folder. Both are cleaned here and
// again in the background script, so nothing outside Downloads (no "..", no drive letters, no absolute paths) can be asked for.
export const DEFAULT_FOLDER = "mt-md"

export function cleanFolder(value) {
  return String(value ?? "")
    .split(/[\\/]+/)
    .map((s) => s.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim().replace(/[. ]+$/, ""))
    .filter((s) => s && s !== "." && s !== "..")
    .slice(0, 3)
    .map((s) => s.slice(0, 60))
    .join("/")
}

export function cleanFileName(name) {
  return String(name ?? "").replace(/[\\/\u0000-\u001f<>:"|?*]/g, "_").replace(/^\.+/, "").slice(0, 150) || "document"
}

// the path handed to downloads.download, relative to the Downloads folder
export function downloadPath(name, where, folder) {
  const file = cleanFileName(name)
  const dir = where === "folder" ? cleanFolder(folder) || DEFAULT_FOLDER : ""
  return dir ? `${dir}/${file}` : file
}

export const MAX_SAVE_BYTES = 48 * 1024 * 1024 // above this the page downloads the file itself (messages have a size limit)
