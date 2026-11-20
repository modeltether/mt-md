// The viewer's look for the extension's own pages (set-up page and popup): its CSS, the saved light/dark/system choice and
// theme style, kept live, plus the shared control styles. `layout: true` also applies the page layout (width, text size, font).
import { applyTheme, loadSavedTheme } from "./theme.js"
import { resolveTheme, watchSystemTheme } from "./themepref.js"
import { STYLE_KEY, DEFAULT_STYLE, findStyle, styleCss } from "./themes.js"
import { loadCustomThemes, watchCustomThemes } from "./themestore.js"
import { loadSetting } from "./settings.js"
import { LAYOUT_KEY, normalizeLayout, applyLayout } from "./layout.js"
import uiCss from "./styles/ui.css"

const api = globalThis.browser ?? globalThis.chrome

export async function setUpLook({ layout = false } = {}) {
  let pref = await loadSavedTheme()
  let styleId = await loadSetting(STYLE_KEY, DEFAULT_STYLE)
  let custom = await loadCustomThemes()
  const root = document.getElementById("mt-md-root")
  const ui = document.createElement("style")
  ui.id = "mt-md-ui"
  ui.textContent = uiCss
  const show = () => {
    const mode = resolveTheme(pref)
    applyTheme(mode, "", styleCss(findStyle(styleId, custom), mode))
    document.head.appendChild(ui) // after the theme sheet, so the shared controls win
  }
  show()
  if (layout) applyLayout(root, normalizeLayout(await loadSetting(LAYOUT_KEY, null)))
  watchSystemTheme(() => { if (pref === "system") show() })
  watchCustomThemes((list) => { custom = list; show() })
  try {
    api.storage.onChanged.addListener((c, area) => {
      if (area !== "local") return
      if (c["mt-md-theme"]) { pref = c["mt-md-theme"].newValue; show() }
      if (c[STYLE_KEY]) { styleId = c[STYLE_KEY].newValue; show() }
      if (layout && c[LAYOUT_KEY]) applyLayout(root, normalizeLayout(c[LAYOUT_KEY].newValue))
    })
  } catch {}
}
