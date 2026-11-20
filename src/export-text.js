// Plain text (.txt) from the document model: headings underlined, lists and quotes marked, code indented, tables as columns.
const runsText = (runs) => runs.map((r) => (r.br ? "\n" : r.image ? (r.image.alt ? `[image: ${r.image.alt}]` : "[image]") : r.link && r.link !== r.text ? `${r.text} (${r.link})` : r.text)).join("")

function pad(rows) {
  const cols = Math.max(...rows.map((r) => r.length))
  const width = Array.from({ length: cols }, (_, i) => Math.max(...rows.map((r) => (r[i] || "").length)))
  return rows.map((r) => width.map((w, i) => (r[i] || "").padEnd(w)).join("  ").trimEnd())
}

function lines(b, indent = "") {
  switch (b.t) {
    case "h": {
      const t = runsText(b.runs)
      return b.level === 1 ? [t, "=".repeat(Math.max(t.length, 3)), ""] : b.level === 2 ? [t, "-".repeat(Math.max(t.length, 3)), ""] : [`${"#".repeat(b.level)} ${t}`, ""]
    }
    case "p": return [...runsText(b.runs).split("\n"), ""]
    case "code": return [...b.text.split("\n").map((l) => "    " + l), ""]
    case "hr": return ["-".repeat(40), ""]
    case "quote": {
      const inner = b.blocks.flatMap((x) => lines(x))
      while (inner.at(-1) === "") inner.pop()
      return [...inner.map((l) => (l ? "> " + l : ">")), ""]
    }
    case "list": return [...b.items.flatMap((item, n) => {
      const mark = b.ordered ? `${n + 1}. ` : "- "
      const inner = item.flatMap((x) => lines(x)).filter((l) => l !== "")
      return inner.map((l, i) => (i === 0 ? mark : " ".repeat(mark.length)) + l)
    }), ""]
    case "table": return [...pad(b.rows.map((r) => r.map((c) => runsText(c.runs).replace(/\n/g, " ")))), ""]
    default: return []
  }
}

export function buildText(blocks) {
  return blocks.flatMap((b) => lines(b)).join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}
