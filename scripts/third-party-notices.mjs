// Writes THIRD_PARTY_NOTICES.md: every npm package that ends up inside the shipped bundles, with its licence and the
// licence text. The list comes from esbuild's own record of what it bundled, so it follows the code, not package.json.
//   node scripts/third-party-notices.mjs          write the file
//   node scripts/third-party-notices.mjs --check  fail if the file is out of date or a licence is not on the allow-list
import { build } from "esbuild"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { offlineInfographic } from "./offline-plugin.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const repo = path.join(root, "../..")
const ALLOWED = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "CC0-1.0", "Unlicense", "EPL-1.0", "EPL-2.0", "MPL-2.0", "BlueOak-1.0.0", "Python-2.0", "OFL-1.1", "MIT-0"]
const common = { bundle: true, format: "iife", target: "firefox115", loader: { ".css": "text", ".woff2": "binary" }, write: false, metafile: true, logLevel: "silent" }
const entries = [
  { entryPoints: ["src/content.js"], external: ["mermaid", "@hpcc-js/wasm-graphviz", "vega", "vega-lite", "vega-interpreter", "@antv/infographic", "@maxgraph/core"] },
  { entryPoints: ["src/vendor/mermaid.js"], alias: { "elkjs/lib/elk.bundled.js": "./src/vendor/elk-stub.js" } },
  { entryPoints: ["src/vendor/graphviz.js"] },
  { entryPoints: ["src/vendor/vega.js"] },
  { entryPoints: ["src/vendor/infographic.js"], plugins: [offlineInfographic] },
  { entryPoints: ["src/vendor/drawio.js"] },
  { entryPoints: ["src/background.js"] },
  { entryPoints: ["src/popup.js"] },
  { entryPoints: ["src/welcome.js"] }
]

const dirs = new Map() // package dir -> true
for (const e of entries) {
  const { metafile } = await build({ ...common, ...e, absWorkingDir: root })
  for (const input of Object.keys(metafile.inputs)) {
    const m = /^(.*?node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input)
    if (m) dirs.set(m[1], true)
  }
}

const find = (rel) => {
  for (const base of [root, repo]) if (existsSync(path.join(base, rel, "package.json"))) return path.join(base, rel)
  return null
}
const licenseText = (dir) => {
  const f = readdirSync(dir).find((n) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(n) && !/\.(js|ts|json)$/i.test(n))
  return f ? readFileSync(path.join(dir, f), "utf8").trim() : ""
}
const normalise = (l) => {
  const raw = typeof l === "string" ? l : l?.type || ""
  return raw.replace(/^\(|\)$/g, "")
}
// a few packages ship the licence text but no "license" field; recognise the plain MIT text rather than guess
const fromText = (text) => (/^The MIT License/i.test(text) || /Permission is hereby granted, free of charge/.test(text) ? "MIT" : "")

const pkgs = []
for (const rel of [...dirs.keys()].sort()) {
  const dir = find(rel)
  if (!dir) continue
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"))
  pkgs.push({ name: pkg.name, version: pkg.version, license: normalise(pkg.license || pkg.licenses?.[0]) || fromText(licenseText(dir)), text: licenseText(dir), url: typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url || pkg.homepage || "" })
}

// the font and anything vendored by hand
const extras = [{ name: "STIX Two Math (subset)", version: "", license: "OFL-1.1", text: readFileSync(path.join(root, "fonts/OFL.txt"), "utf8").trim(), url: "https://github.com/stipub/stixfonts" }]
// colour palettes for the bundled theme styles (src/themes.js): the values are re-typed, not copied files, but the licences ask for the notice
const mit = (holder) => `MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
extras.push(
  { name: "Catppuccin palette (Latte, Mocha)", version: "", license: "MIT", url: "https://github.com/catppuccin/catppuccin", text: mit("2021 Catppuccin") },
  { name: "Solarized palette", version: "", license: "MIT", url: "https://github.com/altercation/solarized", text: mit("2011 Ethan Schoonover") },
  { name: "Rosé Pine palette (Dawn, main)", version: "", license: "MIT", url: "https://github.com/rose-pine/rose-pine-theme", text: mit("2021 Rosé Pine") }
)
extras.push({
  name: "Graphviz (compiled into @hpcc-js/wasm-graphviz)", version: "", license: "EPL-1.0", url: "https://graphviz.org",
  text: "The Graphviz layout engine inside the WebAssembly file is distributed under the Eclipse Public License 1.0.\nLicence: https://graphviz.org/license/ and https://www.eclipse.org/legal/epl-v10.html\nSource code: https://gitlab.com/graphviz/graphviz"
})
const all = [...pkgs, ...extras]

const problems = all.filter((p) => !p.license || !p.license.split(/\s+(?:OR|AND)\s+/).every((l) => ALLOWED.includes(l))).map((p) => `${p.name}@${p.version}: ${p.license || "no licence found"}`)

// group packages that share identical licence text, so the file stays readable
const groups = new Map()
for (const p of all) {
  const key = p.text || "(no licence file; see the package)"
  groups.set(key, [...(groups.get(key) || []), p])
}
let md = "# Third-party notices\n\nmt-md bundles the packages below. Each is under its own licence, reproduced here as those licences require.\nmt-md itself is under the MIT licence (see `LICENSE`). This file is generated by `scripts/third-party-notices.mjs`.\n\n"
md += `## Packages (${all.length})\n\n| Package | Version | Licence |\n|---|---|---|\n` + all.map((p) => `| ${p.name} | ${p.version} | ${p.license || "?"} |`).join("\n") + "\n\n## Licence texts\n\n"
for (const [text, list] of [...groups].sort((a, b) => a[1][0].name.localeCompare(b[1][0].name))) {
  md += `### ${list.map((p) => p.name).join(", ")}\n\n\`\`\`text\n${text}\n\`\`\`\n\n`
}

const out = path.join(root, "THIRD_PARTY_NOTICES.md")
if (process.argv.includes("--check")) {
  if (problems.length) { console.error("licences not on the allow-list:\n  " + problems.join("\n  ")); process.exit(1) }
  if (!existsSync(out) || readFileSync(out, "utf8") !== md) { console.error("THIRD_PARTY_NOTICES.md is out of date: run `node scripts/third-party-notices.mjs`"); process.exit(1) }
  console.log(`notices ok (${all.length} packages)`)
} else {
  writeFileSync(out, md)
  console.log(`wrote THIRD_PARTY_NOTICES.md: ${all.length} packages`)
  if (problems.length) console.log("WARNING, check these licences:\n  " + problems.join("\n  "))
}
