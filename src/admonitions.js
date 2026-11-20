const TYPES = {
  note: { label: "Note", icon: "ℹ️" },
  tip: { label: "Tip", icon: "💡" },
  important: { label: "Important", icon: "❗" },
  warning: { label: "Warning", icon: "⚠️" },
  caution: { label: "Caution", icon: "🛑" }
}

const MARK = /^\[!(\w+)\]\s*(.*)$/

export function convertAdmonitions(root) {
  for (const bq of [...root.querySelectorAll("blockquote")]) {
    const firstP = bq.querySelector(":scope > p")
    if (!firstP) continue
    const m = (firstP.textContent || "").match(MARK)
    if (!m) continue
    const type = TYPES[m[1].toLowerCase()]
    if (!type) continue

    const box = document.createElement("div")
    box.className = `mt-admonition mt-admonition-${m[1].toLowerCase()}`
    const title = document.createElement("div")
    title.className = "mt-admonition-title"
    title.textContent = `${type.icon} ${m[2].trim() || type.label}`
    box.appendChild(title)
    const content = document.createElement("div")
    content.className = "mt-admonition-content"
    firstP.remove()
    while (bq.firstChild) content.appendChild(bq.firstChild)
    box.appendChild(content)
    bq.replaceWith(box)
  }
}

export const ADMONITION_TYPES = Object.keys(TYPES)
