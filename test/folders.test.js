import test from "node:test"
import assert from "node:assert/strict"
import { normalizeFolder, parseFolderList, folderOfUrl, folderAllowed } from "../src/folders.js"
import { fileAccess, fixSteps, extensionSettingsUrl } from "../src/fileaccess.js"

test("folders are accepted as people write them and kept as a path ending in a slash", () => {
  assert.equal(normalizeFolder("/home/me/notes"), "/home/me/notes/")
  assert.equal(normalizeFolder("  /home/me//notes/  "), "/home/me/notes/")
  assert.equal(normalizeFolder("C:\\Users\\me\\Docs"), "/C:/Users/me/Docs/")
  assert.equal(normalizeFolder("file:///home/me/My%20Notes/x.md"), "/home/me/My Notes/x.md/")
  assert.equal(normalizeFolder("~/notes"), "", "a home shortcut cannot be expanded by a browser")
  assert.equal(normalizeFolder("notes/relative"), "")
  assert.equal(normalizeFolder(""), "")
})

test("a list is parsed line by line; duplicates drop and unusable lines are reported", () => {
  const { folders, rejected } = parseFolderList("/a/b\n\n/a/b/\n~/x\nC:\\w\n")
  assert.deepEqual(folders, ["/a/b/", "/C:/w/"])
  assert.deepEqual(rejected, ["~/x"])
})

test("no list means every local file; a list means those folders and what is beneath them", () => {
  assert.equal(folderOfUrl("file:///home/me/notes/a%20b.md#x"), "/home/me/notes/")
  assert.equal(folderOfUrl("https://x.test/a.md"), "")
  assert.equal(folderAllowed("file:///anything/a.md", []), true)
  assert.equal(folderAllowed("file:///anything/a.md", undefined), true)
  const only = ["/home/me/notes/"]
  assert.equal(folderAllowed("file:///home/me/notes/a.md", only), true)
  assert.equal(folderAllowed("file:///home/me/notes/deep/er/a.md", only), true)
  assert.equal(folderAllowed("file:///home/me/notes2/a.md", only), false, "a sibling that merely starts with the same letters")
  assert.equal(folderAllowed("file:///home/me/a.md", only), false)
  assert.equal(folderAllowed("https://x.test/a.md", only), true, "the list is about local files only")
  assert.equal(folderAllowed("file:///c:/users/me/docs/a.md", ["/C:/Users/me/Docs/"]), true, "drive paths ignore case")
})

test("both browsers are asked the same question about local files", async () => {
  assert.equal(await fileAccess({ extension: { isAllowedFileSchemeAccess: async () => true } }), "yes")
  assert.equal(await fileAccess({ extension: { isAllowedFileSchemeAccess: () => false } }), "no")
  assert.equal(await fileAccess({ extension: {} }), "unknown")
  assert.equal(await fileAccess({ extension: { isAllowedFileSchemeAccess: async () => { throw new Error("x") } } }), "unknown")
})

test("the fix is described per browser", () => {
  assert.match(fixSteps(true).join(" "), /Extensions and Themes.*Permissions.*Allow access to file URLs/)
  assert.match(fixSteps(false).join(" "), /Allow access to file URLs/)
  assert.equal(extensionSettingsUrl("abc", "Mozilla Chrome/153"), "chrome://extensions/?id=abc")
  assert.equal(extensionSettingsUrl("abc", "Mozilla Chrome/153 Edg/153"), "edge://extensions/?id=abc")
})
