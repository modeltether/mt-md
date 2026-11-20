// Assemble per-browser extension folders from the one bundle: build/chrome and build/firefox.
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { loadHosting, updateUrl } from "./hosting.mjs"
import { extensionId } from "./ext-id.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const hosting = loadHosting()
for (const target of ["chrome", "firefox"]) {
  const out = path.join(root, "build", target)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  for (const f of ["mt-md.js", "mt-md-mermaid.js", "mt-md-graphviz.js", "mt-md-vega.js", "mt-md-infographic.js", "mt-md-drawio.js", "mt-md-background.js", "mt-md-popup.js", "mt-md-welcome.js"]) cpSync(path.join(root, "dist", f), path.join(out, f))
  cpSync(path.join(root, "icons"), path.join(out, "icons"), { recursive: true, filter: (f) => !/\.(svg|py)$/.test(f) })
  cpSync(path.join(root, "src/popup/popup.html"), path.join(out, "popup.html"))
  cpSync(path.join(root, "dist/welcome.html"), path.join(out, "welcome.html")) // rendered from welcome.md by scripts/welcome.mjs
  // self-hosted update address: from hosting.json (not committed); without it the build simply has no update_url
  const manifest = JSON.parse(readFileSync(path.join(root, `manifest.${target}.json`), "utf8"))
  if (hosting) {
    if (target === "chrome") manifest.update_url = updateUrl(hosting, "mt-md", "chrome")
    else manifest.browser_specific_settings.gecko.update_url = updateUrl(hosting, "mt-md", "firefox")
  }
  writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  cpSync(path.join(root, "LICENSE"), path.join(out, "LICENSE")) // the licence travels with every build
  cpSync(path.join(root, "THIRD_PARTY_NOTICES.md"), path.join(out, "THIRD_PARTY_NOTICES.md"))
}

// Chrome Web Store upload: the store assigns the ID and hosts updates, so drop `key` and `update_url`.
{
  const src = path.join(root, "build/chrome")
  const out = path.join(root, "build/chrome-store")
  rmSync(out, { recursive: true, force: true })
  cpSync(src, out, { recursive: true })
  const manifest = JSON.parse(readFileSync(path.join(src, "manifest.json"), "utf8"))
  delete manifest.key
  delete manifest.update_url
  writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  const zipDir = path.join(root, "release/mt-md/store")
  mkdirSync(zipDir, { recursive: true })
  const zip = path.join(zipDir, `mt-md-${manifest.version}-chrome-store.zip`)
  rmSync(zip, { force: true })
  execFileSync("zip", ["-qr", zip, "."], { cwd: out })
}

// Chrome policy that force-installs the self-hosted build (copy to /etc/opt/chrome/policies/managed/).
if (hosting) {
  const chrome = JSON.parse(readFileSync(path.join(root, "manifest.chrome.json"), "utf8"))
  const dir = path.join(root, "build/policy")
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "chrome-managed.json"), JSON.stringify({ ExtensionSettings: { [extensionId(chrome.key)]: { installation_mode: "force_installed", update_url: updateUrl(hosting, "mt-md", "chrome") } } }, null, 2) + "\n")
}
