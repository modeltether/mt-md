import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { convertAdmonitions, ADMONITION_TYPES } from "../src/admonitions.js"

function makeBlockquote(innerHtml) {
  const root = document.createElement("div")
  const bq = document.createElement("blockquote")
  bq.innerHTML = innerHtml
  root.appendChild(bq)
  return root
}

test("the five spec admonition types are supported", () => {
  assert.deepEqual(ADMONITION_TYPES.sort(), ["caution", "important", "note", "tip", "warning"])
})

test("converts a [!NOTE] blockquote into a styled box", () => {
  const root = makeBlockquote("<p>[!NOTE]</p><p>Info here</p>")
  convertAdmonitions(root)
  const box = root.querySelector(".mt-admonition-note")
  assert.ok(box, "note box created")
  assert.ok(box.querySelector(".mt-admonition-title").textContent.includes("Note"))
  assert.equal(box.querySelector(".mt-admonition-content").textContent.trim(), "Info here")
  assert.equal(root.querySelector("blockquote"), null)
})

test("custom title after the marker", () => {
  const root = makeBlockquote("<p>[!WARNING] Watch out</p><p>Details</p>")
  convertAdmonitions(root)
  assert.ok(root.querySelector(".mt-admonition-warning .mt-admonition-title").textContent.includes("Watch out"))
})

test("case-insensitive type", () => {
  const root = makeBlockquote("<p>[!tip]</p><p>x</p>")
  convertAdmonitions(root)
  assert.ok(root.querySelector(".mt-admonition-tip"))
})

test("plain blockquotes are left alone", () => {
  const root = makeBlockquote("<p>just a quote</p>")
  convertAdmonitions(root)
  assert.ok(root.querySelector("blockquote"))
  assert.equal(root.querySelector(".mt-admonition"), null)
})

test("unknown admonition type is left alone", () => {
  const root = makeBlockquote("<p>[!QUESTION]</p><p>x</p>")
  convertAdmonitions(root)
  assert.ok(root.querySelector("blockquote"))
})
