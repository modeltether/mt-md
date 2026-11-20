import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const dir = path.dirname(fileURLToPath(import.meta.url))
const load = (name) => JSON.parse(readFileSync(path.join(dir, "..", name), "utf8"))

for (const name of ["manifest.chrome.json", "manifest.firefox.json"]) {
  test(`${name} is MV3 with the content scripts and a file-reading background`, () => {
    const m = load(name)
    assert.equal(m.manifest_version, 3)
    assert.ok(JSON.stringify(m.background).includes("mt-md-background.js"), "background reads files for auto-reload")
    assert.equal(m.host_permissions, undefined, "no host permissions beyond the content-script matches")
    assert.equal(m.browser_action, undefined)
    assert.ok(m.action)
    assert.deepEqual(m.content_scripts[0].js, ["mt-md-mermaid.js", "mt-md-graphviz.js", "mt-md-vega.js", "mt-md-infographic.js", "mt-md-drawio.js", "mt-md.js"])
    assert.ok(m.content_scripts[0].matches.every((p) => p.endsWith(".md")))
    assert.ok(m.content_scripts[0].matches.every((p) => /^(file:|http:\/\/(localhost|127\.0\.0\.1|\[::1\])\/)/.test(p)), "static matches are local only")
    assert.equal(m.content_scripts[0].all_frames, true, "a local .md page inside an iframe is rendered too (same local-only matches)")
  })
}

test("firefox manifest carries a gecko id, chrome manifest does not", () => {
  assert.ok(load("manifest.firefox.json").browser_specific_settings.gecko.id)
  assert.equal(load("manifest.chrome.json").browser_specific_settings, undefined)
})

import { existsSync } from "node:fs"
for (const name of ["manifest.chrome.json", "manifest.firefox.json"]) {
  test(`${name} icons are real PNGs at their stated sizes`, () => {
    const m = load(name)
    for (const [size, file] of Object.entries(m.icons)) {
      const full = path.join(dir, "..", file)
      assert.ok(existsSync(full), `${file} missing`)
      const buf = readFileSync(full)
      assert.equal(buf.readUInt32BE(16), Number(size), `${file} width`)
      assert.equal(buf.readUInt32BE(20), Number(size), `${file} height`)
    }
    assert.ok(m.permissions.includes("storage"))
  })
}

test("every bundle stays under AMO's 5 MB parse limit", async () => {
  const { statSync } = await import("node:fs")
  for (const f of ["mt-md.js", "mt-md-mermaid.js", "mt-md-graphviz.js", "mt-md-vega.js", "mt-md-infographic.js", "mt-md-drawio.js"]) {
    assert.ok(statSync(path.join(dir, "../dist", f)).size < 5 * 1024 * 1024, `${f} too large for AMO`)
  }
})

test("the Chrome Web Store link on the install page matches the store item id", () => {
  const read = (f) => readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", f), "utf8").trim()
  const url = new URL(read("store/chromestore-url.txt"))
  assert.equal(url.protocol, "https:")
  assert.equal(url.hostname, "chromewebstore.google.com")
  assert.equal(url.pathname, `/detail/${read("store/cws-item-id.txt")}`)
})

test("the project is MIT licensed and every build carries the licence and third-party notices", () => {
  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
  assert.match(readFileSync(path.join(rootDir, "LICENSE"), "utf8"), /^MIT License\n\nCopyright \(c\) 2026 Model Tether/)
  for (const f of ["package.json"]) {
    assert.equal(JSON.parse(readFileSync(path.join(rootDir, f), "utf8")).license, "MIT", f)
  }
  for (const target of ["chrome", "firefox", "chrome-store"]) {
    for (const f of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
      assert.ok(existsSync(path.join(rootDir, "build", target, f)), `${target} build is missing ${f}`)
    }
  }
})

test("extension pages may not frame anything (no tip form, no remote content)", () => {
  for (const f of ["manifest.chrome.json", "manifest.firefox.json"]) {
    const csp = JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).content_security_policy.extension_pages
    assert.ok(!/frame-src/.test(csp), `${f}: ${csp}`)
  }
})
