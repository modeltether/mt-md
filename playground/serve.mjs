// A tiny static server for the playground documents, to compare mt-md over http with the same files over file://.
//   node playground/serve.mjs [--port 8794] [--host 127.0.0.1] [--charset] [--root <folder>]
// It lists folders like an ordinary autoindex (so the Files panel has something to read) and sends .md files as
// text/plain WITHOUT a charset, the way many servers do, to exercise mt-md's UTF-8 re-read. --charset adds utf-8.
// --host 0.0.0.0 makes it reachable by another name or machine, which is how to try the "Allow this site" flow.
import { createServer } from "node:http"
import { readFile, readdir, stat } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const args = process.argv.slice(2)
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const PORT = Number(opt("port", process.env.PORT || 8794))
const HOST = opt("host", "127.0.0.1")
const CHARSET = args.includes("--charset")
const ROOT = path.resolve(opt("root", path.join(path.dirname(fileURLToPath(import.meta.url)), "docs")))

const TYPES = {
  ".md": "text/plain", ".txt": "text/plain", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".html": "text/html"
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

async function listing(dir, urlPath) {
  const names = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
  const rows = names.map((e) => {
    const slash = e.isDirectory() ? "/" : ""
    return `<li><a href="${encodeURIComponent(e.name)}${slash}">${esc(e.name)}${slash}</a></li>`
  })
  const up = urlPath === "/" ? "" : '<li><a href="../">../</a></li>'
  return `<!doctype html><meta charset="utf-8"><title>Index of ${esc(urlPath)}</title><h1>Index of ${esc(urlPath)}</h1><ul>${up}${rows.join("")}</ul>`
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname)
    const file = path.join(ROOT, urlPath)
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("forbidden") }
    const info = await stat(file)
    if (info.isDirectory()) {
      if (!urlPath.endsWith("/")) { res.writeHead(301, { location: req.url.split("?")[0] + "/" }); return res.end() }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      return res.end(await listing(file, urlPath))
    }
    const ext = path.extname(file).toLowerCase()
    let type = TYPES[ext] || "application/octet-stream"
    if (CHARSET && type.startsWith("text/")) type += "; charset=utf-8"
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" })
    res.end(await readFile(file))
  } catch (err) {
    res.writeHead(err.code === "ENOENT" ? 404 : 500, { "content-type": "text/plain" })
    res.end(err.code === "ENOENT" ? "not found" : String(err.message))
  }
})

server.listen(PORT, HOST, () => {
  const base = `http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${server.address().port}`
  console.log(`playground documents: ${ROOT}`)
  console.log(`  over http : ${base}/README.md   (folder index: ${base}/)`)
  console.log(`  over file : ${pathToFileURL(path.join(ROOT, "README.md")).href}`)
  console.log(`  charset   : ${CHARSET ? "utf-8 sent" : "none sent (mt-md must re-read as UTF-8)"}`)
  console.log("Ctrl+C to stop.")
})
