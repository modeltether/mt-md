// Where the maintainer's self-hosted updates live. Optional: without it the extension builds with no update_url.
// Read from $MT_MD_HOSTING, or hosting.json at the repo root (not committed; copy hosting.example.json and edit it):
//   baseUrl        public address of the folder served at /ext/ (no trailing slash); manifests and update files point here
//   publishTarget  rsync destination for the release files (trailing slash)
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const file = process.env.MT_MD_HOSTING || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "hosting.json")

export function loadHosting({ required = false } = {}) {
  if (!existsSync(file)) {
    if (required) throw new Error("hosting.json is missing: copy hosting.example.json to it and fill in your own addresses (or set MT_MD_HOSTING)")
    return null
  }
  const cfg = JSON.parse(readFileSync(file, "utf8"))
  const baseUrl = String(cfg.baseUrl || "").replace(/\/+$/, "")
  if (!/^https:\/\//.test(baseUrl)) throw new Error("hosting.json: baseUrl must be an https:// address")
  return { baseUrl, publishTarget: cfg.publishTarget ? String(cfg.publishTarget).replace(/\/*$/, "/") : "" }
}

// https://<base>/<slug>/chrome/updates.xml and .../firefox/updates.json
export const updateUrl = (hosting, slug, browser) => `${hosting.baseUrl}/${slug}/${browser}/${browser === "chrome" ? "updates.xml" : "updates.json"}`
