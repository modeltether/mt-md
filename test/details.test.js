import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { markdownToHtml } from "../src/render.js"

test("the +++ shorthand renders a details block", () => {
  const html = markdownToHtml("+++ Click to expand\n\nHidden content here.\n\n+++\n")
  assert.match(html, /<details><summary>Click to expand<\/summary>/)
  assert.match(html, /<p>Hidden content here\.<\/p>/)
  assert.match(html, /<\/details>/)
})

test("details content supports markdown", () => {
  const html = markdownToHtml("+++ More\n\n- a\n- b\n\n+++\n")
  assert.match(html, /<li>a<\/li>/)
})

test("an unclosed +++ block is left as text", () => {
  const html = markdownToHtml("+++ no closer\n\ncontent\n")
  assert.equal(html.includes("<details>"), false)
  assert.match(html, /\+\+\+ no closer/)
})

test("native details and summary pass through the sanitiser", () => {
  const html = markdownToHtml("<details>\n<summary>Native</summary>\n\nbody\n\n</details>\n")
  assert.match(html, /<details>\s*<summary>Native<\/summary>/)
})
