const OPENER = /^\+\+\+\s+(.*)$/
const CLOSER = /^\+\+\+\s*$/

export function detailsPlugin(md) {
  function openRule(state, startLine, endLine, silent) {
    if (state.sCount[startLine] > 3) return false
    const line = state.src
      .slice(state.bMarks[startLine], state.eMarks[startLine])
      .trim()
    const m = line.match(OPENER)
    if (!m) return false

    let next = startLine + 1
    for (; next < endLine; next++) {
      const l = state.src
        .slice(state.bMarks[next] + state.tShift[next], state.eMarks[next])
        .trim()
      if (CLOSER.test(l)) break
    }
    if (next >= endLine) return false

    if (!silent) {
      const lines = []
      for (let i = startLine + 1; i < next; i++) {
        lines.push(state.src.slice(state.bMarks[i], state.eMarks[i]))
      }
      const open = state.push("mt_details_open", "details", 1)
      open.meta = { summary: m[1] }
      const content = state.push("mt_details_content", "", 0)
      content.meta = { text: lines.join("\n") }
      state.push("mt_details_close", "/details", -1)
      state.line = next + 1
    }
    return true
  }

  md.block.ruler.before("fence", "mt_details", openRule)
  md.renderer.rules.mt_details_open = (tokens, idx) =>
    `<details><summary>${md.utils.escapeHtml(tokens[idx].meta.summary)}</summary>\n`
  md.renderer.rules.mt_details_content = (tokens, idx) => md.render(tokens[idx].meta.text)
  md.renderer.rules.mt_details_close = () => `</details>\n`
}
