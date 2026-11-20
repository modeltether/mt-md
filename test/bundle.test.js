import test from "node:test"
import assert from "node:assert/strict"
import { bundleMarkdown, collectImageUrls, splitCode, bundleFileName, folderLoader } from "../src/bundle.js"
import { decodeUtf8IfValid } from "../src/detect.js"

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
const loader = async (url) => {
  if (url.includes("missing")) throw new Error("HTTP 404")
  return { mime: url.endsWith(".svg") ? "image/svg+xml" : "image/png", bytes: png }
}
const BASE = "file:///home/a/docs/readme.md"

test("inline images become references with the data at the end", async () => {
  const { text, embedded, skipped } = await bundleMarkdown('# T\n\n![logo](img/a.png "A logo")\n\nbye\n', BASE, loader)
  assert.equal(embedded.length, 1)
  assert.equal(skipped.length, 0)
  assert.match(text, /!\[logo\]\[mt-md-img-1\]/)
  assert.ok(!text.includes("img/a.png"))
  assert.match(text, /\n\[mt-md-img-1\]: data:image\/png;base64,iVBORw== "A logo"\n$/)
  assert.ok(text.indexOf("bye") < text.indexOf("<!-- mt-md bundle"), "text first, payload last")
  assert.match(text, /LLM readers should ignore everything after this comment/)
})

test("html <img>, repeated images and reference definitions", async () => {
  const md = '<img src="a.png" alt="one" width="40">\n\n![two](a.png)\n\n![three][pic]\n\n[pic]: ./b.png\n'
  const { text, embedded } = await bundleMarkdown(md, BASE, loader)
  assert.equal(embedded.length, 2, "a.png is embedded once")
  assert.match(text, /!\[one\]\[mt-md-img-\d\]/)
  assert.match(text, /!\[three\]\[pic\]/)
  assert.match(text, /^\[pic\]: data:image\/png;base64,/m)
  assert.ok(!/\]: \.\/b\.png/.test(text), "the old definition is gone")
  assert.equal((text.match(/base64,/g) || []).length, 2)
})

test("code fences, inline code and data: images are left alone", async () => {
  const md = "```md\n![x](a.png)\n```\n\nuse `![x](b.png)` like that\n\n![d](data:image/png;base64,AAAA)\n"
  assert.deepEqual(collectImageUrls(md), [])
  const { text, embedded } = await bundleMarkdown(md, BASE, loader)
  assert.equal(embedded.length, 0)
  assert.equal(text, md)
})

test("an image that cannot be read stays a link and is reported", async () => {
  const { text, embedded, skipped } = await bundleMarkdown("![a](ok.png) ![b](missing.png)\n", BASE, loader)
  assert.equal(embedded.length, 1)
  assert.equal(skipped.length, 1)
  assert.match(skipped[0].reason, /404/)
  assert.match(text, /!\[b\]\(missing\.png\)/)
})

test("a definition far from its image, across a code fence, still moves", async () => {
  const md = "![pic][r1]\n\n```\ncode\n```\n\n[r1]: pics/x.png\n"
  const { text, embedded } = await bundleMarkdown(md, BASE, loader)
  assert.equal(embedded.length, 1)
  assert.ok(!text.includes("pics/x.png"))
  assert.match(text, /^\[r1\]: data:image\/png;base64,/m)
})

test("definitions are separate paragraphs, so one rejected definition cannot hide the rest", async () => {
  const { text } = await bundleMarkdown("![a](a.png) ![b](b.svg) ![c](c.png)\n", BASE, loader)
  const defs = text.split("\n").filter((l) => l.startsWith("[mt-md-img-"))
  assert.equal(defs.length, 3)
  const tail = text.slice(text.indexOf("\n[mt-md-img-"))
  assert.equal((tail.match(/\n\n\[mt-md-img-/g) || []).length, 2, "blank line between definitions")
})

test("relative urls resolve against the document", async () => {
  const seen = []
  await bundleMarkdown("![a](../pics/a%20b.png)", BASE, async (u) => { seen.push(u); return { mime: "image/png", bytes: png } })
  assert.deepEqual(seen, ["file:///home/a/pics/a%20b.png"])
})

test("splitCode keeps fences intact; file names", () => {
  const segs = splitCode("a\n```\ncode\n```\nb")
  assert.deepEqual(segs.map((s) => s.code), [false, true, false])
  assert.equal(bundleFileName("file:///x/My Notes.md"), "My Notes.bundle.md")
})

test("decodeUtf8IfValid fixes mojibake only for valid UTF-8", () => {
  const bytes = new TextEncoder().encode("a … b\n")
  assert.equal(decodeUtf8IfValid(bytes, "a â€¦ b"), "a … b")
  assert.equal(decodeUtf8IfValid(new Uint8Array([0x61, 0xe9, 0x62]), "aéb"), "aéb", "latin-1 bytes are not UTF-8")
  assert.equal(decodeUtf8IfValid(new TextEncoder().encode("plain"), "plain"), "plain")
})

test("folderLoader matches by path suffix, whichever folder was chosen", async () => {
  const f = (rel, bytes = [1, 2, 3]) => ({ webkitRelativePath: rel, name: rel.split("/").pop(), type: "", arrayBuffer: async () => new Uint8Array(bytes).buffer })
  // chose the document's own folder
  const load = folderLoader([f("docs/img/logo.png"), f("docs/readme.md"), f("docs/other/logo.png", [9])])
  assert.deepEqual([...(await load("file:///home/a/docs/img/logo.png")).bytes], [1, 2, 3])
  assert.equal((await load("file:///home/a/docs/img/logo.png")).mime, "image/png")
  await assert.rejects(load("file:///home/a/docs/img/nope.png"), /not in the chosen folder/)
  // chose a parent folder: the longest matching suffix wins
  const parent = folderLoader([f("home/docs/img/logo.png", [7]), f("home/img/logo.png", [8])])
  assert.deepEqual([...(await parent("file:///home/a/home/docs/img/logo.png")).bytes], [7])
})

test("a note near the top gives the line where the text ends and the image data starts", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
  const loader = async () => ({ mime: "image/png", bytes: png })
  const md = "# Title\n\nFirst ![a](a.png)\n\nSecond ![b](b.png)\n\nLast line\n"
  for (const source of [md, `---\ntitle: X\nstatus: draft\n---\n${md}`]) {
    const { text } = await bundleMarkdown(source, BASE, loader)
    const lines = text.split("\n")
    const note = lines.find((l) => l.startsWith("<!-- mt-md note:"))
    assert.ok(note, "note present")
    const [endsAt, from, to] = /ends at line (\d+)\. Lines (\d+) to (\d+) are base64/.exec(note).slice(1).map(Number)
    assert.equal(lines[endsAt - 1], "Last line", "the text really ends where the note says")
    assert.ok(lines[from - 1].startsWith("<!-- mt-md bundle:"), "the payload comment starts where the note says")
    assert.ok(lines[to - 1].startsWith("[mt-md-img-"), "the last data line is where the note says")
    assert.equal(lines.slice(to).join("").trim(), "", "nothing follows")
    assert.ok(lines.slice(from, to).every((l) => !l.trim() || l.startsWith("[mt-md-img-")), "only definitions in between")
    if (source.startsWith("---")) assert.equal(lines[0], "---", "front matter stays first")
  }
})
