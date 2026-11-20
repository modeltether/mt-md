import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { fullPath, foldersBetween, parentDirOf, folderName, dirOf, parseListing, isListingOf, visibleEntries, linkedDocuments, listingAllowed } from "../src/listing.js"
import { mountFiles } from "../src/filepanel.js"

const DIR = "file:///home/a/docs/"

const chromePage = `<script>start("/home/a/docs/");</script>
<script>addRow("..","..",1,"","");</script>
<script>addRow("guide.md","guide.md",0,"1 kB","");</script>
<script>addRow("My Notes.md","My%20Notes.md",0,"2 kB","");</script>
<script>addRow("img","img",1,"","");</script>
<script>addRow("pic.png","pic.png",0,"3 kB","");</script>
<script>addRow(".hidden.md",".hidden.md",0,"1 B","");</script>`

test("dirOf gives the folder of a document", () => {
  assert.equal(dirOf("file:///home/a/docs/guide.md#top"), DIR)
  assert.equal(dirOf("http://localhost:8000/a/b.md?x=1"), "http://localhost:8000/a/")
})

test("parseListing reads Chrome's file listing", () => {
  const all = parseListing(chromePage, DIR)
  assert.deepEqual(all.map((e) => [e.name, e.dir]), [["guide.md", false], ["My Notes.md", false], ["img", true], ["pic.png", false], [".hidden.md", false]])
  assert.equal(all[1].url, DIR + "My%20Notes.md")
  assert.equal(all[2].url, DIR + "img/")
})

test("parseListing reads an autoindex of links and skips parent, sort and foreign links", () => {
  const html = `<a href="?C=N;O=D">Name</a><a href="../">Parent</a><a href="/docs/">up</a>
    <a href="a.md">a.md</a><a href="sub/">sub/</a><a href="sub/deep.md">deep</a><a href="https://other.test/docs/x.md">x</a><a href="#top">t</a>`
  const all = parseListing(html, "http://srv.test/docs/")
  assert.deepEqual(all.map((e) => e.name), ["a.md", "sub"])
  assert.equal(all[1].dir, true)
})

test("isListingOf needs the current document in the listing", () => {
  const all = parseListing(chromePage, DIR)
  assert.equal(isListingOf(all, DIR + "guide.md"), true)
  assert.equal(isListingOf(all, DIR + "My%20Notes.md#x"), true)
  assert.equal(isListingOf(all, DIR + "other.md"), false)
  assert.equal(isListingOf(parseListing('<a href="a.md">a</a>', "http://s.test/"), "http://s.test/zzz.md"), false)
})

test("visibleEntries keeps folders and .md files, folders first, no hidden names", () => {
  const names = visibleEntries(parseListing(chromePage, DIR)).map((e) => e.name)
  assert.deepEqual(names, ["img", "guide.md", "My Notes.md"])
})

test("linkedDocuments lists other .md pages the document links to", () => {
  const { window } = new JSDOM(`<article><a href="b.md#x">b</a><a href="b.md">b again</a><a href="guide.md">self</a>
    <a href="https://other.test/c.md">c</a><a href="d.txt">d</a><a href="sub/e%20f.md">e</a></article>`)
  const found = linkedDocuments(window.document.querySelector("article"), DIR + "guide.md")
  assert.deepEqual(found.map((e) => e.name), ["b.md", "e f.md"])
})

// Any local folder is allowed (Up needs the parent), but only for a file: .md page of ours and only for a folder address.
test("listingAllowed: file: folders, for a .md page of ours", () => {
  const from = DIR + "guide.md"
  assert.equal(listingAllowed(DIR, from), true)
  assert.equal(listingAllowed("file:///home/a/", from), true)
  assert.equal(listingAllowed(DIR + "guide.md", from), false) // not a folder
  assert.equal(listingAllowed(DIR, "file:///home/a/docs/page.html"), false)
  assert.equal(listingAllowed("http://x.test/", "http://x.test/a.md"), false)
  assert.equal(listingAllowed("file:///etc/", from), true, "documented: not limited to the page's own folder")
  assert.equal(listingAllowed("http://x.test/", from), false)
})

test("parentDirOf and folderName", () => {
  assert.equal(parentDirOf(DIR), "file:///home/a/")
  assert.equal(parentDirOf("file:///"), "file:///")
  assert.equal(folderName(DIR), "docs")
  assert.equal(folderName("file:///"), "/")
  assert.equal(folderName("http://srv.test:8000/"), "srv.test:8000")
  assert.equal(folderName("file:///a/My%20Docs/"), "My Docs")
})

test("the Files panel marks the current page and loads folders when opened", async () => {
  const { window } = new JSDOM("<body></body>")
  const doc = window.document
  const entries = visibleEntries(parseListing(chromePage, DIR))
  const seen = []
  const panel = mountFiles({
    title: "Files", entries, currentUrl: DIR + "guide.md", doc,
    list: async (url) => { seen.push(url); return [{ name: "inner.md", url: url + "inner.md", dir: false }] },
  })
  doc.body.appendChild(panel)
  assert.equal(panel.querySelector("a.mt-md-current").textContent, "guide.md")
  panel.querySelector(".mt-md-folder").click()
  await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(seen, [DIR + "img/"])
  assert.equal(panel.querySelector(".mt-md-files-sub a").textContent, "inner.md")
  panel.querySelector(".mt-md-files-head").click()
  assert.equal(panel.querySelector(".mt-md-files-body").hidden, true)
})

test("Up lists the parent in place; Back is disabled without an earlier document", async () => {
  const { window } = new JSDOM("<body></body>")
  const doc = window.document
  const seen = []
  const panel = mountFiles({
    title: "Files", entries: [{ name: "x.md", url: DIR + "x.md", dir: false }], dirUrl: DIR, currentUrl: DIR + "x.md", doc,
    list: async (url) => { seen.push(url); return url === DIR ? [] : [{ name: "docs", url: DIR, dir: true }, { name: "top.md", url: "file:///home/a/top.md", dir: false }] },
  })
  assert.equal(panel.querySelector(".mt-md-files-path").textContent, "docs")
  assert.equal(panel.querySelector(".mt-md-files-back").disabled, true)
  panel.querySelector(".mt-md-files-up").click()
  await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(seen, ["file:///home/a/", DIR]) // and the folder we came from opens inside it
  assert.equal(panel.querySelector(".mt-md-folder").getAttribute("aria-expanded"), "true")
  assert.equal(panel.querySelector(".mt-md-files-path").textContent, "a")
  assert.equal(panel.querySelector(".mt-md-files-body li:last-child a").textContent, "top.md")
  const top = mountFiles({ title: "Files", entries: [], dirUrl: "file:///", currentUrl: "file:///x.md", list: async () => [], backUrl: DIR + "x.md", doc })
  assert.equal(top.querySelector(".mt-md-files-up").disabled, true)
  assert.equal(top.querySelector(".mt-md-files-back").disabled, false)
})

test("fullPath and foldersBetween", () => {
  assert.equal(fullPath("file:///home/a/My%20Docs/"), "/home/a/My Docs/")
  assert.equal(fullPath("http://srv.test:8000/docs/"), "srv.test:8000/docs/")
  assert.deepEqual(foldersBetween("file:///a/", "file:///a/b/c/"), ["file:///a/b/", "file:///a/b/c/"])
  assert.deepEqual(foldersBetween("file:///a/", "file:///a/"), [])
  assert.deepEqual(foldersBetween("file:///a/", "file:///z/"), [])
})

test("the Files panel restores open folders, reports changes, and shows full paths", async () => {
  const { window } = new JSDOM("<body></body>")
  const doc = window.document
  const states = []
  const list = async (url) => (url === DIR + "img/" ? [{ name: "deep", url: DIR + "img/deep/", dir: true }] : [{ name: "p.md", url: url + "p.md", dir: false }])
  const panel = mountFiles({
    title: "Files", entries: [{ name: "img", url: DIR + "img/", dir: true }, { name: "x.md", url: DIR + "x.md", dir: false }],
    dirUrl: DIR, currentUrl: DIR + "x.md", doc, list, expanded: [DIR + "img/", DIR + "img/deep/"], onState: (s) => states.push(s),
  })
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(panel.querySelector(".mt-md-files-path").title, "/home/a/docs/")
  assert.equal(panel.querySelector(".mt-md-folder").title, "/home/a/docs/img/")
  assert.equal(panel.querySelectorAll(".mt-md-folder[aria-expanded=true]").length, 2)
  assert.equal(panel.querySelector(".mt-md-files-sub .mt-md-files-sub a").textContent, "p.md")
  assert.equal(states.length, 0) // restoring is not a change
  panel.querySelector(".mt-md-folder").click()
  assert.deepEqual(states.at(-1), { dirUrl: DIR, open: [DIR + "img/deep/"] })
})

test("parseListing reads Firefox's local folder format (http-index)", () => {
  const text = "200: filename content-length last-modified file-type\n201: a.md 676 Sun,%2018%20Oct%202026 FILE \n201: My%20Notes.md 8 Sun,%2018%20Oct%202026 FILE \n201: sub 0 Sun,%2018%20Oct%202026 DIRECTORY \n201: img.png 5 Sun,%2018%20Oct%202026 FILE \n"
  const all = parseListing(text, DIR)
  assert.deepEqual(all.map((e) => [e.name, e.dir]), [["a.md", false], ["My Notes.md", false], ["sub", true], ["img.png", false]])
  assert.equal(all[1].url, DIR + "My%20Notes.md")
  assert.equal(all[2].url, DIR + "sub/")
  assert.deepEqual(visibleEntries(all).map((e) => e.name), ["sub", "a.md", "My Notes.md"])
  assert.equal(isListingOf(all, DIR + "a.md"), true)
})
