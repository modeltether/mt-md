// Where custom themes are kept. Always in this browser's extension storage (storage.local). If "sync" is switched on they are also
// kept in storage.sync, which the browser itself copies between the person's own devices (when browser sync is on); the extension
// makes no network request. While sync is on, the synced copy is the one that counts, so a theme removed on one device is gone on the rest.
import { CUSTOM_KEY, MAX_CUSTOM, normalizeCustom } from "./themes.js"

const SYNC_FLAG = "mt-md-sync-themes"
export const SYNC_PREFIX = "mt-md-theme:"
const SYNC_ITEM_LIMIT = 7500 // storage.sync allows 8192 bytes per item; keep clear of it

const api = () => globalThis.browser ?? globalThis.chrome
const local = () => api()?.storage?.local
const sync = () => api()?.storage?.sync

export const syncAvailable = () => !!sync()

export async function syncEnabled() {
  try { return (await local().get(SYNC_FLAG))[SYNC_FLAG] === true && syncAvailable() } catch { return false }
}

async function readSync() {
  const all = await sync().get(null)
  return normalizeCustom(Object.keys(all).filter((k) => k.startsWith(SYNC_PREFIX)).sort().map((k) => all[k]))
}

export async function loadCustomThemes() {
  try {
    if (await syncEnabled()) return await readSync()
  } catch { /* sync unreadable: use the local copy */ }
  try { return normalizeCustom((await local().get(CUSTOM_KEY))[CUSTOM_KEY]) } catch { return [] }
}

// -> { skipped: [labels not synced because they are too large] }
export async function saveCustomThemes(list) {
  const clean = normalizeCustom(list).slice(0, MAX_CUSTOM)
  try { await local().set({ [CUSTOM_KEY]: clean }) } catch { /* storage unavailable */ }
  const skipped = []
  if (await syncEnabled()) {
    const keep = {}
    for (const t of clean) {
      const item = { id: t.id, label: t.label, light: t.light, dark: t.dark }
      if (JSON.stringify(item).length > SYNC_ITEM_LIMIT) skipped.push(t.label)
      else keep[SYNC_PREFIX + t.id] = item
    }
    const old = Object.keys(await sync().get(null)).filter((k) => k.startsWith(SYNC_PREFIX) && !(k in keep))
    if (old.length) await sync().remove(old)
    await sync().set(keep)
  }
  return { skipped }
}

// Switch sync on or off. Turning it on merges this device's themes with what is already synced (the synced copy wins on a clash).
export async function setSyncEnabled(on) {
  if (!on) {
    await local().set({ [SYNC_FLAG]: false })
    return { skipped: [] }
  }
  const mine = await loadCustomThemes()
  let theirs = []
  try { theirs = await readSync() } catch { /* nothing synced yet */ }
  await local().set({ [SYNC_FLAG]: true })
  const merged = [...theirs, ...mine.filter((m) => !theirs.some((t) => t.id === m.id))].slice(0, MAX_CUSTOM)
  return saveCustomThemes(merged)
}

// Calls back when the list may have changed (this device's storage, or a change arriving from another device).
export function watchCustomThemes(onChange) {
  try {
    api().storage.onChanged.addListener((changes, area) => {
      const hit = Object.keys(changes).some((k) => k === CUSTOM_KEY || k === SYNC_FLAG || (area === "sync" && k.startsWith(SYNC_PREFIX)))
      if (hit) loadCustomThemes().then(onChange)
    })
  } catch { /* no extension storage */ }
}
