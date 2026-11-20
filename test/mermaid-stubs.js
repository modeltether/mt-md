export function applyMermaidStubs(win) {
  // jsdom has no structuredClone, which vega-lite uses at load time (every real browser has it)
  if (!win.structuredClone) win.structuredClone = globalThis.structuredClone
  // mermaid references bare `CSSStyleSheet`, which resolves to the executing realm's
  // global: Node's globalThis in unit tests, the jsdom window in the bundle.
  const CSSStyleSheet = win.CSSStyleSheet || class {
    constructor() {
      this.cssRules = []
    }
    insertRule(rule) {
      this.cssRules.push(rule)
      return this.cssRules.length - 1
    }
  }
  if (!win.CSSStyleSheet) win.CSSStyleSheet = CSSStyleSheet
  if (!globalThis.CSSStyleSheet) globalThis.CSSStyleSheet = CSSStyleSheet
  if (!win.SVGElement.prototype.getBBox) {
    win.SVGElement.prototype.getBBox = function () {
      const text = (this.textContent || "").length
      const fs =
        parseFloat(this.style?.fontSize || this.getAttribute("font-size") || "14") || 14
      return { x: 0, y: 0, width: Math.max(text * fs * 0.6, 2), height: fs * 1.2 }
    }
  }
}
