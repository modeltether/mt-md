// Rebuilds the store graphics for the current version: four 1280x800 screenshots and the small promo tile, into release/mt-md/store/.
//   npm run store:assets        (needs `chromium`, python3 with Pillow and websockets, and a prior `npm run package`)
// It serves store/shots itself, so the screenshots show the folder listing (Files panel) a real http server gives.
import { spawn, execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const server = spawn(process.execPath, [path.join(root, "playground/serve.mjs"), "--port", "0", "--root", path.join(root, "store/shots")], { stdio: ["ignore", "pipe", "inherit"] })
try {
  const base = await new Promise((resolve, reject) => {
    let out = ""
    server.stdout.on("data", (d) => { out += d; const m = /over http : (http:\/\/127\.0\.0\.1:\d+)/.exec(out); if (m) resolve(m[1]) })
    setTimeout(() => reject(new Error("the screenshot server did not start")), 5000)
  })
  execFileSync("bash", [path.join(root, "scripts/store-shots.sh")], { cwd: root, stdio: "inherit", env: { ...process.env, BASE: base } })
  execFileSync("python3", [path.join(root, "scripts/store-tile.py"), "release/mt-md/store/promo-small-440x280.png"], { cwd: root, stdio: "inherit" })
  console.log("store graphics written to release/mt-md/store/ (look at them before confirming the listing)")
} finally {
  server.kill()
}
