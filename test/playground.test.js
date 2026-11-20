import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))
const docs = path.join(here, "../playground/docs")

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? markdownFiles(p) : n.endsWith(".md") ? [p] : []
  })
}

test("every relative link and image in the playground documents points at a file that exists", () => {
  const bad = []
  for (const file of markdownFiles(docs)) {
    const text = readFileSync(file, "utf8")
    for (const m of text.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1].replace(/^<|>$/g, "")
      if (/^[a-z][a-z0-9+.-]*:|^#/i.test(target)) continue
      const rel = decodeURIComponent(target.split("#")[0])
      if (!rel) continue
      const dest = path.join(path.dirname(file), rel)
      if (!existsSync(dest) && !/missing\.png$/.test(rel)) bad.push(`${path.relative(docs, file)} -> ${target}`)
    }
  }
  assert.deepEqual(bad, [])
})

test("the playground server lists folders, sends .md without a charset, and stays inside docs/", async () => {
  const proc = spawn(process.execPath, [path.join(here, "../playground/serve.mjs"), "--port", "0"], { stdio: ["ignore", "pipe", "inherit"] })
  try {
    const base = await new Promise((resolve, reject) => {
      let out = ""
      proc.stdout.on("data", (d) => { out += d; const m = /over http : (http:\/\/127\.0\.0\.1:\d+)/.exec(out); if (m) resolve(m[1]) })
      proc.on("error", reject)
      setTimeout(() => reject(new Error("server did not start")), 5000)
    })
    const index = await fetch(base + "/")
    assert.match(index.headers.get("content-type"), /text\/html/)
    const html = await index.text()
    assert.ok(html.includes('href="guides/"') && html.includes('href="README.md"') && html.includes('href="odd%20names/"'))
    const md = await fetch(base + "/07-unicode.md")
    assert.equal(md.headers.get("content-type"), "text/plain")
    assert.ok((await md.text()).includes("café"))
    assert.equal((await fetch(base + "/odd%20names/%C3%BCn%C3%AFcode%20%26%20spaces.md")).status, 200)
    assert.equal((await fetch(base + "/images/one.png")).headers.get("content-type"), "image/png")
    assert.equal((await fetch(base + "/%2e%2e/package.json")).status, 404)
    assert.equal((await fetch(base + "/nope.md")).status, 404)
    assert.equal((await fetch(base + "/guides", { redirect: "manual" })).status, 301)
  } finally {
    proc.kill()
  }
})
