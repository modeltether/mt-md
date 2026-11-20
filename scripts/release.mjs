// Pack release artifacts into release/mt-md/{chrome,firefox}, laid out as the web server serves them:
//   <baseUrl>/mt-md/chrome/{updates.xml,mt-md-<v>.crx}
//   <baseUrl>/mt-md/firefox/{updates.json,mt-md-<v>.xpi}   (baseUrl is in hosting.json)
// Chrome: CHROME_BIN=<chrome-for-testing> and the private key (default ~/.config/browser-ext/mt-md.pem, never in the repo).
// Firefox: put the AMO-signed XPI at release/mt-md/firefox/mt-md-<v>.xpi first (see README); updates.json is written from it.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { loadHosting } from "./hosting.mjs"
import { extensionId } from "./ext-id.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const base = `${loadHosting({ required: true }).baseUrl}/mt-md`
const chromeManifest = JSON.parse(readFileSync(path.join(root, "manifest.chrome.json"), "utf8"))
const ffManifest = JSON.parse(readFileSync(path.join(root, "manifest.firefox.json"), "utf8"))
const version = chromeManifest.version
if (ffManifest.version !== version) throw new Error("chrome and firefox manifest versions differ")

const out = path.join(root, "release/mt-md")
mkdirSync(path.join(out, "chrome"), { recursive: true })
mkdirSync(path.join(out, "firefox"), { recursive: true })

const id = extensionId(chromeManifest.key)

// --- Chrome: CRX3 signed with the private key
const chromeBin = process.env.CHROME_BIN
const pem = process.env.MT_MD_KEY || path.join(homedir(), ".config/browser-ext/mt-md.pem")
if (chromeBin && existsSync(pem)) {
  const src = path.join(root, "build/chrome")
  // without its own update_url Chromium treats the install as a Web Store one and rejects every later update (CRX_REQUIRED_PROOF_MISSING)
  const built = JSON.parse(readFileSync(path.join(src, "manifest.json"), "utf8"))
  if (built.update_url !== `${base}/chrome/updates.xml`) throw new Error(`build/chrome/manifest.json update_url is ${built.update_url}: run npm run package with MT_MD_HOSTING set first`)
  execFileSync(chromeBin, ["--headless=new", "--no-sandbox", `--pack-extension=${src}`, `--pack-extension-key=${pem}`], { stdio: "ignore" })
  const crx = path.join(out, "chrome", `mt-md-${version}.crx`)
  copyFileSync(`${src}.crx`, crx)
  chmodSync(crx, 0o644)
  writeFileSync(
    path.join(out, "chrome/updates.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">\n  <app appid="${id}">\n    <updatecheck codebase="${base}/chrome/mt-md-${version}.crx" version="${version}"/>\n  </app>\n</gupdate>\n`
  )
  console.log(`chrome: ${id} ${version}`)
} else {
  console.log("chrome: skipped (set CHROME_BIN and provide the key)")
}

// --- Firefox: update manifest for the signed XPI
const xpi = path.join(out, "firefox", `mt-md-${version}.xpi`)
if (existsSync(xpi)) {
  const hash = createHash("sha256").update(readFileSync(xpi)).digest("hex")
  const gecko = ffManifest.browser_specific_settings.gecko.id
  writeFileSync(
    path.join(out, "firefox/updates.json"),
    JSON.stringify({ addons: { [gecko]: { updates: [{ version, update_link: `${base}/firefox/mt-md-${version}.xpi`, update_hash: `sha256:${hash}` }] } } }, null, 2) + "\n"
  )
  console.log(`firefox: ${gecko} ${version}`)
} else {
  console.log(`firefox: skipped (no signed ${path.relative(root, xpi)})`)
}

const storeUrlFile = path.join(root, "store/chromestore-url.txt") // one line, once the store listing exists
// --- catalog entry for the install page (the maintainer's install-page script reads this)
copyFileSync(path.join(root, "icons/icon-128.png"), path.join(out, "icon.png"))
writeFileSync(
  path.join(out, "meta.json"),
  JSON.stringify({ slug: "mt-md", name: "mt-md", description: JSON.parse(readFileSync(path.join(root, "store/listing.json"), "utf8")).catalog, version, chrome: existsSync(path.join(out, "chrome", `mt-md-${version}.crx`)), firefox: existsSync(xpi), chromeStore: existsSync(storeUrlFile) ? readFileSync(storeUrlFile, "utf8").trim() : undefined }, null, 2) + "\n"
)
