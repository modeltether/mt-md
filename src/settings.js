// Small per-user switches kept in extension storage (the theme has its own helpers in theme.js).
const area = () => (globalThis.browser ?? globalThis.chrome)?.storage?.local

export async function loadSetting(key, fallback) {
  try {
    const got = await area().get(key)
    return got && key in got ? got[key] : fallback
  } catch {
    return fallback
  }
}

export function saveSetting(key, value) {
  try {
    return area()?.set({ [key]: value })
  } catch {
    // storage unavailable: the switch just won't persist
  }
}
