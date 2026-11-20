import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { problems, render } from "../scripts/listing.mjs"

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const listing = () => JSON.parse(readFileSync(path.join(dir, "store/listing.json"), "utf8"))
const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.chrome.json"), "utf8"))

test("the store texts cover every toolbar tool and every permission, and fit the store's limits", () => {
  assert.deepEqual(problems(listing(), manifest), [])
})

test("a new tool, a new permission, a long summary or an outdated claim is caught", () => {
  const l = listing()
  l.description.features = l.description.features.filter((f) => !f.covers.includes("edit"))
  assert.ok(problems(l, manifest).some((p) => /"edit"/.test(p)))
  const m = { ...manifest, permissions: [...manifest.permissions, "tabs"] }
  assert.ok(problems(listing(), m).some((p) => /"tabs" has no justification/.test(p)))
  const long = listing(); long.summary = "x".repeat(133)
  assert.ok(problems(long, manifest).some((p) => /133 characters/.test(p)))
  const stale = listing(); stale.description.access = "Pages served as .md over http(s) work without any setting."
  assert.ok(problems(stale, manifest).some((p) => /without any setting/.test(p)))
  const gone = listing(); gone.justifications.tabs = "x"
  assert.ok(problems(gone, manifest).some((p) => /no longer has/.test(p)))
})

test("the generated listing carries the summary, every feature and every justification", () => {
  const l = listing()
  const text = render(l)
  assert.ok(text.includes(l.summary))
  for (const f of l.description.features) assert.ok(text.includes(f.text))
  for (const k of Object.keys(l.justifications)) assert.ok(text.includes(`**${k}:**`))
})
