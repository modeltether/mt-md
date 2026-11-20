const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function splitFrontMatter(raw) {
  const match = raw.match(FM_RE)
  if (!match) return { front: null, body: raw }
  return { front: parseFrontMatter(match[1]), body: raw.slice(match[0].length) }
}

export function parseFrontMatter(yaml) {
  const front = {}
  for (const line of yaml.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    front[m[1]] = value
  }
  return front
}

export function statusClass(status) {
  const s = String(status || "").toLowerCase()
  if (s === "draft") return "mt-status-draft"
  if (s === "approved") return "mt-status-approved"
  return "mt-status-default"
}
