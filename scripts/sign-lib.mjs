// Pieces of the Firefox signing wrapper that must never leak the AMO credentials: what goes on the command line (no
// secrets, ever: a command line is echoed by npx and visible in `ps`), and a filter for anything the child prints.
export const SECRET_KEYS = ["AMO_JWT_ISSUER", "AMO_JWT_SECRET"]

// Parses a KEY=VALUE env file (the ones under ~/.config/browser-ext). Returns only the keys asked for.
export function parseEnvFile(text, keys = SECRET_KEYS) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && keys.includes(m[1])) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2")
  }
  return out
}

// The credentials travel in the child's environment (web-ext reads WEB_EXT_API_KEY / WEB_EXT_API_SECRET), not in argv.
export function signEnv(creds, base = process.env) {
  if (!creds.AMO_JWT_ISSUER || !creds.AMO_JWT_SECRET) throw new Error("AMO_JWT_ISSUER and AMO_JWT_SECRET are needed (~/.config/browser-ext/amo.env)")
  return { ...base, WEB_EXT_API_KEY: creds.AMO_JWT_ISSUER, WEB_EXT_API_SECRET: creds.AMO_JWT_SECRET }
}

export function signArgs({ sourceDir, artifactsDir, timeoutMs = 900000 }) {
  return ["--yes", "web-ext@8", "sign", "--source-dir", sourceDir, "--artifacts-dir", artifactsDir, "--channel", "unlisted", "--approval-timeout", String(timeoutMs)]
}

// Replaces every secret value (and anything shaped like the AMO issuer id) with ***, wherever it turns up in output.
export function redactor(secrets) {
  const values = secrets.filter((v) => v && v.length >= 6)
  return (text) => {
    let out = text
    for (const v of values) out = out.split(v).join("***")
    return out.replace(/\buser:\d+:\d+\b/g, "***")
  }
}
