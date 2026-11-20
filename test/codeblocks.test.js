import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { decorateCodeBlocks } from "../src/codeblocks.js"

function makePre(code, cls = "") {
  const pre = document.createElement("pre")
  const c = document.createElement("code")
  if (cls) c.className = cls
  c.textContent = code
  pre.appendChild(c)
  const root = document.createElement("div")
  root.appendChild(pre)
  return root
}

test("decorateCodeBlocks wraps code in a labelled, copyable block", () => {
  const root = makePre("console.log(1)", "language-js")
  decorateCodeBlocks(root)
  const wrap = root.querySelector(".mt-md-codeblock")
  assert.ok(wrap, "wrapper added")
  assert.equal(wrap.querySelector(".mt-md-lang").textContent, "js")
  assert.ok(wrap.querySelector(".mt-md-copy"), "copy button added")
  assert.equal(wrap.querySelector("pre code").textContent, "console.log(1)")
})

test("decorateCodeBlocks skips pre without code", () => {
  const root = document.createElement("div")
  const pre = document.createElement("pre")
  pre.textContent = "raw"
  root.appendChild(pre)
  decorateCodeBlocks(root)
  assert.equal(root.querySelector(".mt-md-codeblock"), null)
})

test("decorateCodeBlocks has no language label for untagged fences", () => {
  const root = makePre("plain")
  decorateCodeBlocks(root)
  assert.equal(root.querySelector(".mt-md-lang"), null)
  assert.ok(root.querySelector(".mt-md-copy"))
})
