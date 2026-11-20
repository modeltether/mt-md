import test from "node:test"
import assert from "node:assert/strict"
import { EDITORS, DEFAULT_EDITOR, normalizeEditor, editorLink, editorLabel } from "../src/editor.js"

test("VS Code is the default editor", () => {
  assert.equal(DEFAULT_EDITOR.id, "vscode")
  assert.deepEqual(normalizeEditor(undefined), { id: "vscode", custom: "" })
  assert.deepEqual(normalizeEditor({ id: "bogus", custom: 5 }), { id: "vscode", custom: "" })
  assert.equal(editorLabel({ id: "vscode" }), "VS Code")
})

test("a file URL becomes the editor's own link", () => {
  assert.equal(editorLink("file:///home/a/docs/guide.md", { id: "vscode" }), "vscode://file/home/a/docs/guide.md")
  assert.equal(editorLink("file:///home/a/My%20Docs/a%23b.md#top", { id: "vscodium" }), "vscodium://file/home/a/My%20Docs/a%23b.md")
  assert.equal(editorLink("file:///C:/Users/a/x.md", { id: "cursor" }), "cursor://file/C:/Users/a/x.md")
  assert.equal(editorLink("file:///x.md", { id: "vscode-insiders" }), "vscode-insiders://file/x.md")
})

test("only file: pages and safe patterns produce a link", () => {
  assert.equal(editorLink("https://example.com/x.md", { id: "vscode" }), "")
  assert.equal(editorLink("file:///x.md", { id: "custom", custom: "" }), "")
  assert.equal(editorLink("file:///a/x.md", { id: "custom", custom: "myed://open?file={path}&u={url}" }), "myed://open?file=/a/x.md&u=file:///a/x.md")
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "no scheme {path}"]) {
    assert.equal(editorLink("file:///x.md", { id: "custom", custom: bad }), "", bad)
  }
  assert.ok(EDITORS.every((e) => e.id === "custom" || e.pattern.includes("{path}")))
})
