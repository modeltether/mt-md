// The toolbar popup: one click to allow the site of the .md page you are looking at.
import { siteState, allowedSites, siteLabel, syncSites, ALL_ORIGINS } from "./sites.js"
import { fileAccess, fixSteps, isFirefox, extensionSettingsUrl } from "./fileaccess.js"
import { FOLDERS_KEY, folderAllowed, folderOfUrl } from "./folders.js"
import { loadSetting, saveSetting } from "./settings.js"
import { browserName, feedbackTarget, normalizeFeedback, FEEDBACK_KEY } from "./feedback.js"
import { iconSvg, FEEDBACK_ICON } from "./toolbar.js"
import { STYLE_KEY, DEFAULT_STYLE, validateTheme, addCustom, llmPrompt, themeToJson, MAX_THEME_BYTES } from "./themes.js"
import { loadCustomThemes, saveCustomThemes, syncAvailable, syncEnabled, setSyncEnabled, watchCustomThemes } from "./themestore.js"
import { setUpLook } from "./look.js"
import support from "../support.json"

const api = globalThis.browser ?? globalThis.chrome
const $ = (id) => document.getElementById(id)
const view = $("view")
$("ver").textContent = `v${api.runtime.getManifest().version}` // from the manifest, never typed here
const say = (t) => { $("msg").textContent = t }
setUpLook() // the viewer's theme (style, light/dark/system) and the shared controls, as on the set-up page
const LABEL = { yes: "allowed ✓", no: "not allowed yet", unknown: "can't tell" }

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...kids)
  return e
}

async function currentTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function allow(tab, state) {
  // permissions.request must run straight from the click
  // The browser's prompt closes this popup, so nothing after this line is certain to run: the background script
  // registers the site and reloads the page when the grant lands (permissions.onAdded).
  const ok = await api.permissions.request({ origins: [state.pattern] })
  if (!ok) return say("Not allowed. Nothing changed.")
  window.close()
}

async function allowAll(tab) {
  const ok = await api.permissions.request({ origins: ALL_ORIGINS })
  if (!ok) return say("Not allowed. Nothing changed.")
  window.close()
}

async function revokeAll() {
  await api.permissions.remove({ origins: ALL_ORIGINS })
  await syncSites(api)
  await refresh()
  say("All-sites access removed. Sites you allowed one by one are kept.")
}

async function renderOnce(tab) {
  await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["mt-md-mermaid.js", "mt-md-graphviz.js", "mt-md-vega.js", "mt-md-infographic.js", "mt-md-drawio.js", "mt-md.js"] })
  window.close()
}

async function revoke(pattern) {
  await api.permissions.remove({ origins: [pattern] })
  await syncSites(api)
  await refresh()
  say("Removed. Reload the page to see the raw file.")
}

// the same wording and pill as the set-up page
function showLocal(access, folders) {
  const pill = $("status")
  pill.textContent = LABEL[access]
  pill.className = `pill ${access}`
  const body = $("localbody")
  const settings = el("button", { className: "link", textContent: "Local file settings…", onclick: () => { api.tabs.create({ url: api.runtime.getURL("welcome.html") }); window.close() } })
  if (access === "no") {
    body.replaceChildren(
      el("p", {}, "mt-md can't read local files yet. Your browser needs your OK first:"),
      el("ol", { className: "steps" }, ...fixSteps(isFirefox()).map((t) => el("li", {}, t))),
      el("div", { className: "row" },
        ...(isFirefox() ? [] : [el("button", { className: "primary", textContent: "Open settings", onclick: () => api.tabs.create({ url: extensionSettingsUrl(api.runtime.id) }) })]),
        el("button", { textContent: "Check again", onclick: () => refresh() })),
      settings)
  } else if (access === "unknown") {
    body.replaceChildren(el("p", {}, "This browser would not say whether local files are allowed. Open a local .md file to find out."), settings)
  } else {
    body.replaceChildren(el("p", {}, "mt-md can read local files" + (folders.length ? `, in ${folders.length} folder${folders.length > 1 ? "s" : ""} you chose.` : ".")), settings)
  }
}

async function refresh() {
  const tab = await currentTab()
  const { origins = [] } = await api.permissions.getAll()
  const state = siteState(tab?.url || "", origins)
  const access = await fileAccess(api)
  const folderList = await loadSetting(FOLDERS_KEY, [])
  showLocal(access, folderList)
  view.replaceChildren()
  const allowAllBtn = () => el("button", { textContent: "Allow all sites", onclick: () => allowAll(tab) })
  const allowAllNote = () => el("p", {}, "“All sites” lets mt-md read ", el("span", { className: "host" }, ".md pages on every website"), ". It never reads other pages.")
  if (state.kind === "allow") {
    view.append(
      el("p", {}, "This page is a Markdown file on ", el("span", { className: "host" }, state.host), ". mt-md can render it."),
      el("button", { className: "primary", textContent: "Allow this site", onclick: () => allow(tab, state) }),
      el("div", { className: "row" }, allowAllBtn(), el("button", { className: "link", textContent: "Render once", onclick: () => renderOnce(tab) })),
      el("p", {}, "“This site” covers only ", el("span", { className: "host" }, ".md pages on " + state.host), ". Either can be removed any time."),
      allowAllNote(),
    )
  } else if (state.kind === "all") {
    view.append(
      el("p", {}, "✓ mt-md is allowed on ", el("span", { className: "host" }, "all websites"), ". If this page still shows raw text, reload it."),
      el("div", { className: "row" }, el("button", { textContent: "Reload", onclick: async () => { await api.tabs.reload(tab.id); window.close() } }),
        el("button", { textContent: "Remove all-sites access", onclick: () => revokeAll() })),
    )
  } else if (state.kind === "allowed") {
    view.append(
      el("p", {}, "✓ mt-md is allowed on ", el("span", { className: "host" }, state.host), ". If this page still shows raw text, reload it."),
      el("div", { className: "row" }, el("button", { textContent: "Reload", onclick: async () => { await api.tabs.reload(tab.id); window.close() } }),
        el("button", { textContent: "Remove this site", onclick: () => revoke(state.pattern) })),
    )
  } else if (state.kind === "local") {
    const onFile = (tab?.url || "").startsWith("file:")
    const folders = await loadSetting(FOLDERS_KEY, [])
    if (onFile && access === "no") {
      // the browser runs no script on local files until the person says so; the steps are in the Local files card below
      view.append(el("p", {}, "mt-md can't render this local file yet. Allow local files below, or:"),
        el("div", { className: "row" }, el("button", { className: "link", textContent: "Render once", onclick: () => renderOnce(tab) })))
    } else if (onFile && !folderAllowed(tab.url, folders)) {
      view.append(
        el("p", {}, "This folder isn't on your list of folders for mt-md: ", el("span", { className: "host" }, folderOfUrl(tab.url))),
        el("div", { className: "row" },
          el("button", { className: "primary", textContent: "Add this folder", onclick: async () => { await saveSetting(FOLDERS_KEY, [...folders, folderOfUrl(tab.url)]); await api.tabs.reload(tab.id); window.close() } }),
          el("button", { className: "link", textContent: "Render once", onclick: () => renderOnce(tab) })),
      )
    } else {
      view.append(el("p", {}, "Local files and localhost always work" + (folders.length ? ", in the folders you chose." : ".")),
        el("div", { className: "row" }, allowAllBtn()), allowAllNote())
    }
  } else {
    view.append(el("p", {}, "Open a Markdown (.md) page on a website, then click here to allow that site. Local files and localhost need nothing."),
      el("div", { className: "row" }, allowAllBtn()), allowAllNote())
  }
  // everything mt-md can read, for transparency: the built-in local pages first (cannot be removed), then your grants
  const sites = allowedSites(origins)
  const builtIn = [["Files on this computer (file://)", "needs your OK in the browser (see Local files above)"], ["localhost, 127.0.0.1 and [::1]", "any port"]]
  $("list").replaceChildren(
    ...builtIn.map(([label, note]) => el("li", { className: "builtin" }, el("span", {}, label), el("span", { className: "tag", textContent: "always on · " + note }))),
    ...sites.map((o) => el("li", {}, siteLabel(o), el("button", { textContent: "Remove", onclick: () => revoke(o) }))),
  )
  if (!sites.length) $("list").append(el("li", { className: "none" }, "No other sites allowed"))
}


// feedback: one link; where it goes is chosen in Settings on a rendered page, and its tooltip says where it goes now
const facts = { version: api.runtime.getManifest().version, browser: browserName(navigator.userAgent) }
loadSetting(FEEDBACK_KEY, null).then((stored) => {
  const target = feedbackTarget(normalizeFeedback(stored), support, facts)
  if (!target) return
  const link = $("feedback")
  link.href = target.href
  link.title = target.title + " Change where it goes in Settings on a rendered page."
  link.setAttribute("aria-label", link.title)
  if (target.newTab) { link.target = "_blank"; link.rel = "noopener noreferrer" }
  link.replaceChildren(iconSvg(FEEDBACK_ICON), "Feedback")
  link.hidden = false
  $("foot").hidden = false
})

// custom themes: upload or paste a JSON file, copy the prompt for an assistant, edit, copy, remove
const copyText = async (text, ok) => {
  try { await navigator.clipboard.writeText(text); say(ok) } catch { say("Could not copy. Your browser blocked the clipboard.") }
}

async function renderCustom() {
  const list = await loadCustomThemes()
  $("customlist").replaceChildren(...list.map((t) => el("li", {}, t.label, el("span", { className: "acts" },
    el("button", { textContent: "Edit", title: "Put this theme's JSON in the box above to change it", onclick: () => {
      $("paste").value = themeToJson(t)
      $("themes").open = true
      say(`Edit "${t.label}" and press Add. The same name replaces it; a new name adds another.`)
    } }),
    el("button", { textContent: "Copy JSON", onclick: () => copyText(themeToJson(t), `Copied the JSON for "${t.label}".`) }),
    el("button", { textContent: "Remove", onclick: async () => {
      await saveCustomThemes(list.filter((x) => x.id !== t.id))
      if ((await loadSetting(STYLE_KEY, DEFAULT_STYLE)) === t.id) await saveSetting(STYLE_KEY, DEFAULT_STYLE)
      say(`Removed "${t.label}".`)
      renderCustom()
    } })
  ))))
}

async function addThemeText(text) {
  const r = validateTheme(text)
  if (!r.ok) return say("Not added: " + r.errors.join("; "))
  const added = addCustom(await loadCustomThemes(), r.theme)
  if (added.error) return say(added.error)
  const { skipped } = await saveCustomThemes(added.list)
  $("paste").value = ""
  say(`Added "${r.theme.label}". Pick it from the gear next to Theme in a page's Settings.` + (skipped.length ? ` It is too large to sync to your other devices.` : ""))
  renderCustom()
}

$("copyprompt").addEventListener("click", () => copyText(llmPrompt(), "Prompt copied. Paste it into your AI assistant, then upload or paste the JSON it gives you."))
$("addtheme").addEventListener("click", () => addThemeText($("paste").value))
// Firefox closes the popup when a file dialog opens, so there the paste box is the way in
if (isFirefox()) $("pickfile").hidden = true
$("pickfile").addEventListener("click", () => $("file").click())
$("file").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]
  if (!f) return
  if (f.size > MAX_THEME_BYTES) return say(`Not added: the file is larger than ${MAX_THEME_BYTES / 1000} KB.`)
  addThemeText(await f.text())
  e.target.value = ""
})
renderCustom()
watchCustomThemes(renderCustom)

// keep the themes on all of the person's devices through the browser's own sync
if (syncAvailable()) {
  $("syncrow").hidden = false
  syncEnabled().then((on) => { $("sync").checked = on })
  $("sync").addEventListener("change", async (e) => {
    const { skipped } = await setSyncEnabled(e.target.checked)
    say(e.target.checked ? "Themes now sync across your devices through your browser's sync." + (skipped.length ? ` Not synced (too large): ${skipped.join(", ")}.` : "") : "Themes stay on this device only.")
    renderCustom()
  })
}

refresh().catch((e) => say(String(e.message || e)))
