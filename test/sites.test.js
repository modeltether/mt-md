import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { hostPattern, isLocalUrl, markdownMatches, allowedSites, siteState, siteLabel, syncSites, reloadUnlockedTabs, SCRIPT_ID, SCRIPT_FILES, ALL_ORIGINS } from "../src/sites.js"

const dir = path.dirname(fileURLToPath(import.meta.url))
const load = (name) => JSON.parse(readFileSync(path.join(dir, "..", name), "utf8"))

test("a site grant is one host pattern, ports ignored", () => {
  assert.equal(hostPattern("https://example.com/docs/a.md"), "https://example.com/*")
  assert.equal(hostPattern("http://dev.example.com:8080/a.md"), "http://dev.example.com/*")
})

test("local pages need no grant", () => {
  for (const u of ["file:///home/a/x.md", "http://localhost:3000/x.md", "http://127.0.0.1/x.md", "http://[::1]:80/x.md"]) assert.equal(isLocalUrl(u), true, u)
  assert.equal(isLocalUrl("https://example.com/x.md"), false)
})

test("granted origins become .md-only content-script matches, without the local ones", () => {
  const origins = ["https://example.com/*", "http://localhost/*", "https://example.com/*", "file:///*", "https://raw.githubusercontent.com/*"]
  assert.deepEqual(markdownMatches(origins), ["https://example.com/*.md", "https://raw.githubusercontent.com/*.md"])
  assert.deepEqual(allowedSites(origins), ["https://example.com/*", "https://raw.githubusercontent.com/*"])
  assert.deepEqual(markdownMatches([]), [])
})

test("the popup offers the right action for the active tab", () => {
  const none = []
  assert.equal(siteState("https://example.com/readme.md", none).kind, "allow")
  assert.equal(siteState("https://example.com/readme.md", none).pattern, "https://example.com/*")
  assert.equal(siteState("https://example.com/readme.md", ["https://example.com/*"]).kind, "allowed")
  assert.equal(siteState("https://example.com/readme.md", ["https://*/*"]).kind, "all", "an all-sites grant is its own state")
  assert.equal(siteState("https://example.com/readme.md", ["http://*/*"]).kind, "allow", "the other protocol's grant does not count")
  assert.equal(siteState("https://example.com/page.html", none).kind, "other", "not a .md page")
  assert.equal(siteState("file:///a/b.md", none).kind, "local")
  assert.equal(siteState("http://localhost:8080/x.md", none).kind, "local")
  assert.equal(siteState("chrome://extensions", none).kind, "other")
  assert.equal(siteState("", none).kind, "other")
})

function fakeApi(origins, registered = []) {
  const calls = []
  return {
    calls,
    permissions: { getAll: async () => ({ origins }) },
    scripting: {
      getRegisteredContentScripts: async () => registered,
      registerContentScripts: async (s) => { calls.push(["register", s[0]]) },
      updateContentScripts: async (s) => { calls.push(["update", s[0]]) },
      unregisterContentScripts: async (o) => { calls.push(["unregister", o.ids]) },
    },
  }
}

test("an all-sites grant maps to .md matches and is labelled for the popup", () => {
  assert.deepEqual(ALL_ORIGINS, ["http://*/*", "https://*/*"])
  assert.deepEqual(markdownMatches(ALL_ORIGINS), ["http://*/*.md", "https://*/*.md"])
  assert.equal(siteLabel("https://*/*"), "All websites (https)")
  assert.equal(siteLabel("https://example.com/*"), "example.com")
})

test("syncSites registers, updates and unregisters to match the grants", async () => {
  let api = fakeApi(["https://example.com/*"])
  assert.deepEqual(await syncSites(api), ["https://example.com/*.md"])
  assert.equal(api.calls[0][0], "register")
  assert.equal(api.calls[0][1].id, SCRIPT_ID)
  assert.deepEqual(api.calls[0][1].js, SCRIPT_FILES)
  assert.ok(api.calls[0][1].excludeMatches.includes("http://localhost/*") && api.calls[0][1].excludeMatches.includes("file:///*"), "never doubles up on local pages")
  api = fakeApi(["https://a.com/*", "https://b.com/*"], [{ id: SCRIPT_ID }])
  await syncSites(api)
  assert.equal(api.calls[0][0], "update")
  api = fakeApi([], [{ id: SCRIPT_ID }])
  await syncSites(api)
  assert.deepEqual(api.calls, [["unregister", [SCRIPT_ID]]])
  api = fakeApi([])
  await syncSites(api)
  assert.deepEqual(api.calls, [], "nothing granted, nothing registered: no call")
})

for (const name of ["manifest.chrome.json", "manifest.firefox.json"]) {
  test(`${name}: only local pages are static; every other site is an optional grant`, () => {
    const m = load(name)
    assert.deepEqual(m.content_scripts[0].matches, ["file:///*/*.md", "http://localhost/*.md", "http://127.0.0.1/*.md", "http://[::1]/*.md"])
    // Firefox also lists file URLs as optional: that is what makes its "Allow access to file URLs" switch appear
    assert.deepEqual(m.optional_host_permissions, name.includes("firefox") ? ["http://*/*", "https://*/*", "file:///*"] : ["http://*/*", "https://*/*"])
    assert.equal(m.host_permissions, undefined)
    assert.deepEqual([...m.permissions].sort(), ["activeTab", "downloads", "scripting", "storage"])
    assert.equal(m.action.default_popup, "popup.html")
    assert.ok(existsSync(path.join(dir, "../src/popup/popup.html")))
  })
}

test("a new grant reloads the open tabs it unlocks, and only those", async () => {
  const reloaded = []
  const queried = []
  const api = { tabs: { query: async (q) => { queried.push(q); return [{ id: 7 }, { id: 9 }] }, reload: async (id) => { reloaded.push(id) } } }
  assert.deepEqual(await reloadUnlockedTabs(api, ["https://example.com/*"]), [7, 9])
  assert.deepEqual(queried, [{ url: ["https://example.com/*.md"] }])
  assert.deepEqual(reloaded, [7, 9])
  queried.length = 0
  assert.deepEqual(await reloadUnlockedTabs(api, ["http://*/*", "https://*/*"]), [7, 9])
  assert.deepEqual(queried, [{ url: ["http://*/*.md", "https://*/*.md"] }])
  queried.length = 0
  assert.deepEqual(await reloadUnlockedTabs(api, ["http://localhost/*", "file:///*"]), [], "local grants unlock nothing new")
  assert.deepEqual(queried, [])
})
