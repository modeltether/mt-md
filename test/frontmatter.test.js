import test from "node:test"
import assert from "node:assert/strict"
import { splitFrontMatter, parseFrontMatter, statusClass } from "../src/frontmatter.js"

test("splitFrontMatter strips the block", () => {
  const { front, body } = splitFrontMatter("---\ntitle: T\nstatus: Draft\n---\n\n# Hi\n")
  assert.equal(front.title, "T")
  assert.equal(front.status, "Draft")
  assert.equal(body, "\n# Hi\n")
})

test("splitFrontMatter passes through when absent", () => {
  const { front, body } = splitFrontMatter("# Just a doc\n")
  assert.equal(front, null)
  assert.equal(body, "# Just a doc\n")
})

test("parseFrontMatter handles quoted values", () => {
  const front = parseFrontMatter('title: "A — B"\nauthor: \'C\'\n')
  assert.equal(front.title, "A — B")
  assert.equal(front.author, "C")
})

test("statusClass maps draft/approved", () => {
  assert.equal(statusClass("Draft"), "mt-status-draft")
  assert.equal(statusClass("approved"), "mt-status-approved")
  assert.equal(statusClass("In Review"), "mt-status-default")
})
