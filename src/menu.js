// Which tools sit on the toolbar. Everything else stays on the settings page (the gear at the bottom of the toolbar).
export const DEFAULT_PINNED = ["theme", "toc", "bundle"]

export function normalizePinned(value, known) {
  if (!Array.isArray(value)) return DEFAULT_PINNED.filter((id) => known.includes(id))
  return known.filter((id) => value.includes(id)) // toolbar order, known tools only
}
