// Three bundles: the app, plus mermaid and graphviz as separate content scripts that load first
// (AMO will not parse a file over 5 MB). The app picks them up from globalThis.__mtVendor.
import { build } from "esbuild"
import { offlineInfographic } from "./offline-plugin.mjs"

const common = { bundle: true, format: "iife", target: "firefox115", loader: { ".css": "text", ".woff2": "binary" }, minify: true, logLevel: "warning" }
await build({ ...common, entryPoints: ["src/content.js"], outfile: "dist/mt-md.js", external: ["mermaid", "@hpcc-js/wasm-graphviz", "vega", "vega-lite", "vega-interpreter", "@antv/infographic", "@maxgraph/core"] })
await build({ ...common, entryPoints: ["src/vendor/mermaid.js"], outfile: "dist/mt-md-mermaid.js", alias: { "elkjs/lib/elk.bundled.js": "./src/vendor/elk-stub.js" } })
await build({ ...common, entryPoints: ["src/vendor/graphviz.js"], outfile: "dist/mt-md-graphviz.js" })
await build({ ...common, entryPoints: ["src/vendor/vega.js"], outfile: "dist/mt-md-vega.js" })
await build({ ...common, entryPoints: ["src/vendor/infographic.js"], outfile: "dist/mt-md-infographic.js", plugins: [offlineInfographic] })
await build({ ...common, entryPoints: ["src/vendor/drawio.js"], outfile: "dist/mt-md-drawio.js" })
await build({ ...common, entryPoints: ["src/background.js"], outfile: "dist/mt-md-background.js" })
await build({ ...common, entryPoints: ["src/popup.js"], outfile: "dist/mt-md-popup.js" })
await build({ ...common, entryPoints: ["src/welcome.js"], outfile: "dist/mt-md-welcome.js" })
await import("./welcome.mjs").then((m) => m.buildWelcome())
