import lightCss from "./styles/theme-light.css"
import darkCss from "./styles/theme-dark.css"
import baseCss from "./styles/base.css"
import printCss from "./styles/print.css"
import { THEME_PREFS } from "./themepref.js"

const THEMES = { light: lightCss, dark: darkCss }
const STYLE_ID = "mt-md-styles"

// `style` is the CSS of the chosen theme style (see themes.js); it sits between the built-in theme and the print rules.
export function applyTheme(name, override = "", style = "") {
  if (!THEMES[name]) name = "light"
  let el = document.getElementById(STYLE_ID)
  if (!el) {
    el = document.createElement("style")
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = baseCss + "\n" + THEMES[name] + "\n" + style + "\n" + printCss + "\n" + override
  document.documentElement.classList.toggle("mt-md-dark", name === "dark")
  return name
}

export function currentTheme() {
  return document.documentElement.classList.contains("mt-md-dark") ? "dark" : "light"
}

// The chosen theme is remembered in extension storage (chrome.* in Chrome, browser.* in Firefox).
const KEY = "mt-md-theme"
const storageArea = () => (globalThis.browser ?? globalThis.chrome)?.storage?.local

export function hasThemeStorage() {
  return !!storageArea()
}

export async function loadSavedTheme() {
  try {
    const got = await storageArea().get(KEY)
    return THEME_PREFS.includes(got?.[KEY]) ? got[KEY] : "system"
  } catch {
    return "system"
  }
}

export function saveTheme(name) {
  try {
    storageArea()?.set({ [KEY]: name })
  } catch {
    // storage unavailable: the theme just won't persist
  }
}
