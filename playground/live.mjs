// Rewrites docs/live/clock.md every two seconds so auto-reload can be watched, over file:// and over http alike.
//   node playground/live.mjs        (Ctrl+C restores the placeholder)
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "docs/live/clock.md")
const placeholder = "# Live\n\nUpdated: never (run `npm run playground:live` to rewrite this file every two seconds).\n"
let n = 0
const write = () => writeFileSync(file, `# Live\n\nUpdated: ${new Date().toLocaleTimeString()}  (change ${++n})\n\n## Section\n\nThe page keeps its scroll position and view when it reloads.\n`)
write()
const timer = setInterval(write, 2000)
const stop = () => { clearInterval(timer); writeFileSync(file, placeholder); process.exit(0) }
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
console.log("rewriting docs/live/clock.md every 2 s; Ctrl+C to stop")
