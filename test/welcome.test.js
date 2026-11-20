import { test } from "node:test"
import assert from "node:assert/strict"
import { splitSlots, buildWelcome } from "../scripts/welcome.mjs"

test("splitSlots cuts the Markdown at slot comments", () => {
  assert.deepEqual(splitSlots("ignored\n<!-- slot: a -->\none\n\n<!--slot:b-->\ntwo\n"), { a: "one", b: "two" })
})

test("the welcome page is rendered from welcome.md at build time", async () => {
  const html = await buildWelcome()
  assert.doesNotMatch(html, /<!--\s*slot:/, "every slot is filled")
  assert.match(html, /<code>\.md<\/code>/, "inline code from the Markdown")
  assert.match(html, /<h2[^>]*>1\. Local files<\/h2>/)
  assert.match(html, /id="mt-md-root"/, "wrapped like the viewer so its CSS applies")
  assert.doesNotMatch(html, /<script(?![^>]*src=)/, "no inline script (extension CSP)")
})
