// Signs build/firefox with Mozilla (unlisted channel) and files the XPI where release.mjs expects it.
//   npm run sign:firefox        (credentials come from ~/.config/browser-ext/amo.env; nothing secret is on the command line)
// Run this, never `web-ext sign --api-key …` by hand: npx echoes its command line, and that is how a secret once reached a log.
import { spawn } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { parseEnvFile, signEnv, signArgs, redactor } from "./sign-lib.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const version = JSON.parse(readFileSync(path.join(root, "manifest.firefox.json"), "utf8")).version
const creds = parseEnvFile(readFileSync(process.env.AMO_ENV || path.join(homedir(), ".config/browser-ext/amo.env"), "utf8"))
const env = signEnv(creds)
const redact = redactor([creds.AMO_JWT_ISSUER, creds.AMO_JWT_SECRET])
const artifacts = mkdtempSync(path.join(tmpdir(), "mt-md-signed-"))

const child = spawn("npx", signArgs({ sourceDir: path.join(root, "build/firefox"), artifactsDir: artifacts }), { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] })
const pass = (stream, to) => stream.on("data", (d) => to.write(redact(String(d))))
pass(child.stdout, process.stdout)
pass(child.stderr, process.stderr)
child.on("exit", (code) => {
  const xpi = readdirSync(artifacts).find((f) => f.endsWith(".xpi"))
  if (code !== 0 || !xpi) {
    console.error(`signing did not finish (exit ${code}). If it timed out, the upload still went through: fetch the signed file from the AMO API instead of submitting again.`)
    process.exit(code || 1)
  }
  const dest = path.join(root, "release/mt-md/firefox", `mt-md-${version}.xpi`)
  mkdirSync(path.dirname(dest), { recursive: true })
  copyFileSync(path.join(artifacts, xpi), dest)
  console.log(`signed: ${path.relative(root, dest)}`)
})
