// "Feedback": one link. By default it opens the project's new-issue page with a short template filled in; the reader can
// point it at the project's e-mail address or at a link of their own instead (Settings), and its tooltip says where it goes.
// Nothing is sent by the extension. The page it opens shows exactly what is filled in, and the reader decides whether to submit.
// The template carries only the version, the browser name and the kind of page (a local file, localhost or a website),
// never an address or any of the document's text. The repository is `feedbackUrl` in support.json (https only).
export function repoUrl(url) {
  try {
    const u = new URL(String(url || ""))
    return u.protocol === "https:" ? u.origin + u.pathname.replace(/\/+$/, "") : ""
  } catch {
    return ""
  }
}

export function browserName(ua = "") {
  // Edge and Opera also say "Chrome", so look for them first
  for (const [token, name] of [["Edg", "Edge"], ["OPR", "Opera"], ["Firefox", "Firefox"], ["Chrome", "Chrome"]]) {
    const m = new RegExp(`(?:\\b|Headless)${token}/(\\d+)`).exec(ua)
    if (m) return `${name} ${m[1]}`
  }
  return "an unknown browser"
}

export function pageKind(loc) {
  if (!loc) return ""
  if (loc.protocol === "file:") return "a local file"
  if (["localhost", "127.0.0.1", "[::1]"].includes(loc.hostname)) return "localhost"
  return "a website"
}

const templateBody = ({ version = "", browser = "", where = "" } = {}, plain = false) => {
  const facts = ["mt-md " + version, browser, where].filter((x) => x && x.trim() !== "mt-md").join(" · ")
  const ask = (q) => (plain ? q : `**${q}**`)
  return `${ask("What happened?")}\n\n\n${ask("What did you expect?")}\n\n\n---\n${facts}\n(Filled in by mt-md's feedback link. Delete this line if you prefer.)\n`
}

// The same template as an e-mail (to the project's private inbox). Only a plain address is accepted: no scheme tricks, no extra recipients.
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
export function emailHref(address, facts) {
  const to = String(address || "").trim()
  if (!EMAIL.test(to)) return ""
  return `mailto:${to}?subject=${encodeURIComponent("mt-md feedback")}&body=${encodeURIComponent(templateBody(facts, true))}`
}

export function feedbackHref(feedbackUrl, facts = {}) {
  const base = repoUrl(feedbackUrl)
  if (!base) return ""
  const body = templateBody(facts)
  const github = new URL(base).hostname === "github.com"
  const q = github ? `title=&body=${encodeURIComponent(body)}` : `${encodeURIComponent("issue[title]")}=&${encodeURIComponent("issue[description]")}=${encodeURIComponent(body)}`
  return `${base}${github ? "" : "/-"}/issues/new?${q}`
}

// Where the one Feedback link goes: the project's issue page (the default), its e-mail address, or an address the reader chose.
export const FEEDBACK_KEY = "mt-md-feedback"
export const FEEDBACK_CHOICES = [
  { id: "issues", label: "The project's issue page" },
  { id: "email", label: "An email to the project" },
  { id: "custom", label: "A link or address of my own" }
]

export function normalizeFeedback(v) {
  const choice = FEEDBACK_CHOICES.some((c) => c.id === v?.choice) ? v.choice : "issues"
  const custom = typeof v?.custom === "string" ? v.custom.trim().slice(0, 300) : ""
  return { choice, custom }
}

const hostPath = (url) => {
  try { const u = new URL(url); return u.host + u.pathname.replace(/\/+$/, "") } catch { return "" }
}
const filled = "with only the mt-md version, your browser and the kind of page filled in"

// -> { href, newTab, title, kind } or null when nothing is set up. `support` is support.json; `facts` the version, browser and page kind.
// A choice that cannot be used (no project address, or a custom value that is neither an https link nor an e-mail address)
// falls back to the issue page, then to the project's e-mail, so the link never silently goes nowhere.
export function feedbackTarget(settings, support = {}, facts = {}) {
  const { choice, custom } = normalizeFeedback(settings)
  const issues = feedbackHref(support.feedbackUrl, facts)
  const project = emailHref(support.feedbackEmail, facts)
  const viaIssues = () => issues && { href: issues, newTab: true, kind: "issues", title: `Feedback: opens the issue page ${hostPath(repoUrl(support.feedbackUrl))} in a new tab, ${filled}. Nothing is sent until you submit it.` }
  const viaEmail = (address, href) => href && { href, newTab: false, kind: "email", title: `Feedback: writes an email to ${address} in your mail program, ${filled}. Nothing is sent until you send it.` }
  const viaCustom = () => {
    if (!custom) return null
    if (EMAIL.test(custom)) return viaEmail(custom, emailHref(custom, facts))
    const link = repoUrl(custom) && custom.startsWith("https:") ? new URL(custom).href : ""
    return link && { href: link, newTab: true, kind: "custom", title: `Feedback: opens your own link, ${hostPath(link)}, in a new tab. Nothing is filled in.` }
  }
  const order = choice === "email" ? [() => viaEmail(String(support.feedbackEmail || "").trim(), project), viaIssues]
    : choice === "custom" ? [viaCustom, viaIssues, () => viaEmail(String(support.feedbackEmail || "").trim(), project)]
    : [viaIssues, () => viaEmail(String(support.feedbackEmail || "").trim(), project)]
  for (const make of order) { const t = make(); if (t) return t }
  return null
}
