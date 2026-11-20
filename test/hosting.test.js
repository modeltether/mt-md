import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { loadHosting, updateUrl } from "../scripts/hosting.mjs"

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("the self-hosting address is configuration, not source: no committed file names a private host", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf8" }).split("\0").filter(Boolean)
  const offenders = files.filter((f) => existsSync(path.join(repo, f)) && /\.(json|mjs|js|md|html|sh|py|txt|css)$/.test(f) && /\.ts\.net\b|\badmin@/.test(readFileSync(path.join(repo, f), "utf8")))
  assert.deepEqual(offenders, [])
  for (const m of ["manifest.chrome.json", "manifest.firefox.json"]) assert.ok(!/update_url/.test(readFileSync(path.join(repo, m), "utf8")), `${m} must not hard-code update_url`)
})

test("the example hosting file is valid, and update URLs are built from the base", () => {
  const example = JSON.parse(readFileSync(path.join(repo, "hosting.example.json"), "utf8"))
  assert.match(example.baseUrl, /^https:\/\//)
  const h = { baseUrl: "https://example.com/ext", publishTarget: "u@h:/x/" }
  assert.equal(updateUrl(h, "mt-md", "chrome"), "https://example.com/ext/mt-md/chrome/updates.xml")
  assert.equal(updateUrl(h, "mt-md", "firefox"), "https://example.com/ext/mt-md/firefox/updates.json")
  assert.ok(loadHosting() === null || loadHosting().baseUrl.startsWith("https://"))
})

test("the personal config and tool files are not tracked", () => {
  const files = execFileSync("git", ["ls-files"], { cwd: repo, encoding: "utf8" }).split("\n")
  for (const f of ["hosting.json", ".mcp.json", ".claude/settings.json"]) assert.ok(!files.includes(f), `${f} must stay out of git`)
})

test("the Chrome Web Store build and its zip carry no update_url, no fixed key and no private host", () => {
  const dir = path.join(repo, "build/chrome-store")
  assert.ok(existsSync(dir), "run npm run package first (npm test does)")
  const m = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"))
  assert.equal(m.update_url, undefined)
  assert.equal(m.key, undefined)
  const zip = path.join(repo, `release/mt-md/store/mt-md-${m.version}-chrome-store.zip`)
  const files = execFileSync("find", [dir, "-type", "f"], { encoding: "utf8" }).split("\n").filter(Boolean)
  const host = loadHosting() && new URL(loadHosting().baseUrl).hostname
  for (const f of files) {
    const text = readFileSync(f, "latin1")
    assert.ok(!/\.ts\.net\b/.test(text), `${f} names a tailnet host`)
    if (host) assert.ok(!text.includes(host), `${f} names the self-hosting host`)
  }
  const zipped = JSON.parse(execFileSync("unzip", ["-p", zip, "manifest.json"], { encoding: "utf8" }))
  assert.equal(zipped.update_url, undefined)
  assert.equal(zipped.key, undefined)
  assert.ok(!/update_url/.test(execFileSync("unzip", ["-p", zip, "manifest.json"], { encoding: "utf8" })))
})

test("no tracked file mentions the internal tools that run the project", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf8" }).split("\0").filter(Boolean)
  const offenders = files.filter((f) => /\.(md|json|mjs|js|html)$/.test(f) && existsSync(path.join(repo, f)) && /hoh-secrets|~\/git\/hoh\b/.test(readFileSync(path.join(repo, f), "utf8")) && f !== "test/hosting.test.js")
  assert.deepEqual(offenders, [])
})
