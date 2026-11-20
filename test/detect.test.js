import test from "node:test"
import assert from "node:assert/strict"
import { isMarkdownUrl, titleFromUrl } from "../src/detect.js"

test("isMarkdownUrl matches .md paths only", () => {
  assert.equal(isMarkdownUrl("file:///home/a/b/notes.md"), true)
  assert.equal(isMarkdownUrl("https://raw.example.com/dir/doc.MD"), true)
  assert.equal(isMarkdownUrl("https://raw.example.com/dir/doc.txt"), false)
  assert.equal(isMarkdownUrl("https://raw.example.com/dir/notes.md.bak"), false)
  assert.equal(isMarkdownUrl("not a url"), false)
})

test("titleFromUrl strips the extension", () => {
  assert.equal(titleFromUrl("file:///home/a/b/My Notes.md"), "My Notes")
  assert.equal(titleFromUrl("https://x.com/a/b.md"), "b")
})
