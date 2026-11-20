// The set-up page, opened once after install and from the popup. It shows whether the browser lets mt-md read local files
// (checked live), says how to allow it for this browser, and lets the person limit mt-md to certain folders.
import { fileAccess, fixSteps, isFirefox, extensionSettingsUrl } from "./fileaccess.js"
import { FOLDERS_KEY, parseFolderList } from "./folders.js"
import { loadSetting, saveSetting } from "./settings.js"
import { setUpLook } from "./look.js"

const api = globalThis.browser ?? globalThis.chrome
const $ = (id) => document.getElementById(id)
$("ver").textContent = `v${api.runtime.getManifest().version}`
const firefox = isFirefox()

setUpLook({ layout: true }) // the viewer's CSS, theme style, light/dark and page layout

const LABEL = { yes: "allowed ✓", no: "not allowed yet", unknown: "can't tell" }
let lastAccess = null

async function showAccess() {
  const access = await fileAccess(api)
  if (access === lastAccess) return access
  lastAccess = access
  const pill = $("status")
  pill.textContent = LABEL[access]
  pill.className = `pill ${access}`
  $("fix").hidden = access === "yes"
  $("done").hidden = access !== "yes"
  if (access !== "yes") {
    $("steps").replaceChildren(...fixSteps(firefox).map((t) => Object.assign(document.createElement("li"), { textContent: t })))
    $("open-settings").hidden = firefox // Firefox's add-ons page cannot be opened by an extension
    if (access === "unknown") $("fixmsg").textContent = "This browser would not say whether local files are allowed. Open a local .md file to find out."
  }
  api.runtime.sendMessage({ type: "mt-md-badge" }).catch(() => {})
  return access
}

$("open-settings").addEventListener("click", () => api.tabs.create({ url: extensionSettingsUrl(api.runtime.id) }))
$("recheck").addEventListener("click", async () => {
  lastAccess = null
  const a = await showAccess()
  $("fixmsg").textContent = a === "yes" ? "" : "Still not allowed. Turn the switch on, then press Check again."
})
$("dismiss").addEventListener("click", async () => {
  saveSetting("mt-md-nofiles", true)
  $("fixmsg").textContent = "Okay. The toolbar button will stop showing a warning. You can come back to this page from the button's menu."
  api.runtime.sendMessage({ type: "mt-md-badge" }).catch(() => {})
})

// the switch lives in another tab, so look again whenever this page is shown, and now and then while it is open
window.addEventListener("focus", showAccess)
document.addEventListener("visibilitychange", () => { if (!document.hidden) showAccess() })
setInterval(showAccess, 2000)

async function showFolders() {
  const folders = await loadSetting(FOLDERS_KEY, [])
  const only = folders.length > 0
  document.querySelector(`input[name=mode][value=${only ? "only" : "all"}]`).checked = true
  $("list").value = folders.join("\n")
  $("list").disabled = !only
}
for (const r of document.querySelectorAll("input[name=mode]")) r.addEventListener("change", () => {
  $("list").disabled = r.value === "all" && r.checked
  if (r.value === "only" && r.checked) $("list").focus()
})
$("save").addEventListener("click", async () => {
  const all = document.querySelector("input[name=mode]:checked").value === "all"
  if (all) {
    await saveSetting(FOLDERS_KEY, [])
    $("foldermsg").textContent = "Saved: every local .md file is rendered."
    return
  }
  const { folders, rejected } = parseFolderList($("list").value)
  if (!folders.length) { $("foldermsg").textContent = "Add at least one folder, or choose “Every local .md file”."; return }
  await saveSetting(FOLDERS_KEY, folders)
  $("list").value = folders.join("\n")
  $("foldermsg").textContent = `Saved: ${folders.length} folder${folders.length > 1 ? "s" : ""}.` + (rejected.length ? ` Not understood (use a full path): ${rejected.join(", ")}` : "")
})

showAccess()
showFolders()
