// Chrome Web Store API v2: upload a package, submit it for review, check status.
//   node scripts/cws.mjs status
//   node scripts/cws.mjs upload [zip]     default: release/mt-md/store/mt-md-<version>-chrome-store.zip
//   node scripts/cws.mjs publish          submit the uploaded draft for review (it goes live after Google's review)
//   node scripts/cws.mjs cancel           withdraw the submission that is in review (an item in review cannot be uploaded to)
//   node scripts/cws.mjs release [zip]    upload, then publish
//   Only 0.X.0 versions may be uploaded or published (scripts/store-rule.mjs); patch releases stay self-hosted.
// Auth is a Google service account (no consent screen, no token expiry), shared by every Model Tether extension:
//   ~/.config/browser-ext/cws-service-account.json   the JSON key of store-publisher@model-tether.iam.gserviceaccount.com (mode 600)
//   ~/.config/browser-ext/cws.env                    CWS_PUBLISHER_ID=<dashboard publisher id>
// The service account's email must be added under Account in the Chrome Web Store Developer Dashboard (one per publisher).
// The item ID is per extension and not secret: store/cws-item-id.txt in the package (or CWS_ITEM_ID in the env).
// Nothing secret is printed or logged.
import { createSign } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { storeRuleError } from "./store-rule.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const cfgDir = path.join(homedir(), ".config/browser-ext")
const envFile = process.env.CWS_ENV || path.join(cfgDir, "cws.env")
const keyFile = process.env.CWS_SA_KEY || path.join(cfgDir, "cws-service-account.json")
const env = existsSync(envFile)
  ? Object.fromEntries(readFileSync(envFile, "utf8").split("\n").map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]))
  : {}
const itemFile = path.join(root, "store/cws-item-id.txt")
if (!env.CWS_ITEM_ID && existsSync(itemFile)) env.CWS_ITEM_ID = readFileSync(itemFile, "utf8").trim()
if (!existsSync(keyFile)) throw new Error(`no service account key at ${keyFile}`)
for (const k of ["CWS_PUBLISHER_ID", "CWS_ITEM_ID"]) if (!env[k]) throw new Error(`${k} is missing (${k === "CWS_ITEM_ID" ? itemFile : envFile})`)

const item = `publishers/${env.CWS_PUBLISHER_ID}/items/${env.CWS_ITEM_ID}`
const api = "https://chromewebstore.googleapis.com"

// service-account flow: sign a JWT with the key, exchange it for a one-hour access token
async function accessToken() {
  const key = JSON.parse(readFileSync(keyFile, "utf8"))
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope: "https://www.googleapis.com/auth/chromewebstore", aud: key.token_uri, iat: now, exp: now + 3300 })}`
  const assertion = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url")}`
  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  })
  const j = await res.json()
  if (!j.access_token) throw new Error(`token request failed: ${j.error ?? res.status} ${j.error_description ?? ""}`)
  return j.access_token
}

async function call(token, method, url, opts = {}) {
  const res = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, ...opts.headers }, body: opts.body })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) throw new Error(`${method} ${url.replace(api, "")} -> ${res.status}: ${text.slice(0, 400)}`)
  return json
}

const version = JSON.parse(readFileSync(path.join(root, "manifest.chrome.json"), "utf8")).version
const defaultZip = path.join(root, `release/mt-md/store/mt-md-${version}-chrome-store.zip`)

async function status(token) { return call(token, "GET", `${api}/v2/${item}:fetchStatus`) }
async function upload(token, zip) {
  if (!existsSync(zip)) throw new Error(`no package at ${zip} (run npm run package)`)
  let r = await call(token, "POST", `${api}/upload/v2/${item}:upload`, { headers: { "content-type": "application/zip" }, body: readFileSync(zip) })
  for (let i = 0; r.uploadState === "UPLOAD_IN_PROGRESS" && i < 20; i++) { await new Promise((ok) => setTimeout(ok, 3000)); r = await status(token) }
  return r
}
const publish = (token) => call(token, "POST", `${api}/v2/${item}:publish`)
const cancel = (token) => call(token, "POST", `${api}/v2/${item}:cancelSubmission`)

const [cmd = "status", arg] = process.argv.slice(2)
if (["upload", "publish", "release"].includes(cmd)) {
  const refused = storeRuleError(version, process.env)
  if (refused) throw new Error(refused)
}
const token = await accessToken()
if (cmd === "status") console.log(JSON.stringify(await status(token), null, 2))
else if (cmd === "upload") console.log(JSON.stringify(await upload(token, arg ?? defaultZip), null, 2))
else if (cmd === "publish") console.log(JSON.stringify(await publish(token), null, 2))
else if (cmd === "cancel") console.log(JSON.stringify(await cancel(token), null, 2))
else if (cmd === "release") {
  const u = await upload(token, arg ?? defaultZip); console.log("upload:", JSON.stringify(u))
  if (u.uploadState && !["SUCCEEDED", "SUCCESS"].includes(u.uploadState)) throw new Error(`upload did not succeed (${u.uploadState}); not publishing`)
  console.log("publish:", JSON.stringify(await publish(token)))
} else throw new Error(`unknown command ${cmd}`)
