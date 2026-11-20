import test from "node:test"
import assert from "node:assert/strict"
import { slugify, headingSlugs } from "../src/toc.js"

test("slugify lowercases and hyphenates", () => {
  assert.equal(slugify("Core Markdown"), "core-markdown")
  assert.equal(slugify("C# & Go: notes"), "c-go-notes")
  assert.equal(slugify("  Spaced   Out  "), "spaced-out")
})

test("headingSlugs deduplicates repeats", () => {
  assert.deepEqual(headingSlugs(["Intro", "Intro", "Intro"]), ["intro", "intro-1", "intro-2"])
})
