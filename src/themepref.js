// The saved choice is a preference: "dark", "light" or "system" (follow the browser/OS). The applied theme is always light or dark.
export const THEME_PREFS = ["dark", "light", "system"]
export const nextPreference = (pref) => THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length]

const darkQuery = () => (typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null)

export function resolveTheme(pref) {
  if (pref === "dark" || pref === "light") return pref
  return darkQuery()?.matches ? "dark" : "light"
}

// Calls back when the system's light/dark setting changes; the caller decides whether the preference is "system".
export function watchSystemTheme(onChange) {
  const mq = darkQuery()
  if (!mq?.addEventListener) return () => {}
  const handler = () => onChange(mq.matches ? "dark" : "light")
  mq.addEventListener("change", handler)
  return () => mq.removeEventListener("change", handler)
}
