import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import "./setup-window.js"
import { repoUrl, browserName, pageKind, feedbackHref, emailHref, feedbackTarget, normalizeFeedback, FEEDBACK_CHOICES } from "../src/feedback.js"
import { mountToolbar } from "../src/toolbar.js"
import support from "../support.json" with { type: "json" }

function page() { const { window } = new JSDOM("<body></body>", { url: "https://example.test/x.md" }); globalThis.location = window.location; globalThis.document = window.document; return window }

test("the feedback repository must be an https address", () => {
  assert.equal(repoUrl("https://gitlab.com/a/b/"), "https://gitlab.com/a/b")
  assert.equal(repoUrl("http://gitlab.com/a/b"), "")
  assert.equal(repoUrl("javascript:alert(1)"), "")
  assert.equal(repoUrl(""), "")
  assert.ok(repoUrl(support.feedbackUrl), "support.json names the repository")
})

test("the browser and page kind are named without any address", () => {
  assert.equal(browserName("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"), "Chrome 130")
  assert.equal(browserName("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0"), "Firefox 131")
  assert.equal(browserName("... Chrome/130.0 Safari/537.36 Edg/130.0.1"), "Edge 130")
  assert.equal(browserName("Mozilla/5.0 HeadlessChrome/130.0.0.0 Safari/537.36"), "Chrome 130")
  assert.equal(browserName("curl"), "an unknown browser")
  assert.equal(pageKind({ protocol: "file:", hostname: "" }), "a local file")
  assert.equal(pageKind({ protocol: "http:", hostname: "localhost" }), "localhost")
  assert.equal(pageKind({ protocol: "https:", hostname: "example.org" }), "a website")
})

test("the new-issue link is filled in with version, browser and kind of page, and nothing else", () => {
  const facts = { version: "0.4.0", browser: "Chrome 130", where: "a local file" }
  const gl = new URL(feedbackHref("https://gitlab.com/example/mt-md", facts))
  assert.equal(gl.origin + gl.pathname, "https://gitlab.com/example/mt-md/-/issues/new")
  const body = gl.searchParams.get("issue[description]")
  assert.match(body, /What happened\?/)
  assert.match(body, /mt-md 0\.4\.0 · Chrome 130 · a local file/)
  assert.equal(gl.searchParams.get("issue[title]"), "")
  const gh = new URL(feedbackHref("https://github.com/someone/mt-md", facts))
  assert.equal(gh.origin + gh.pathname, "https://github.com/someone/mt-md/issues/new")
  assert.match(gh.searchParams.get("body"), /Chrome 130/)
  assert.equal(feedbackHref("http://insecure.example/x", facts), "")
  assert.equal(feedbackHref("", facts), "")
})

test("the e-mail link is a mailto with the same template, and only a plain address is accepted", () => {
  const facts = { version: "0.4.0", browser: "Firefox 131", where: "a website" }
  const u = emailHref("inbox@example.org", facts)
  assert.match(u, /^mailto:inbox@example\.org\?subject=mt-md%20feedback&body=/)
  const body = decodeURIComponent(u.split("body=")[1])
  assert.match(body, /What happened\?/)
  assert.doesNotMatch(body, /\*\*/, "plain text, no Markdown bold")
  assert.match(body, /mt-md 0\.4\.0 · Firefox 131 · a website/)
  for (const bad of ["", "no-at-sign", "a@b", "x@y.org,other@z.org", "javascript:alert(1)@x.org", "a b@x.org", "a@x.org?bcc=evil@x.org", "mailto:a@x.org"]) assert.equal(emailHref(bad, facts), "", bad)
  assert.ok(emailHref(support.feedbackEmail, facts), "support.json names the inbox")
})

const SUPPORT = { feedbackUrl: "https://github.com/someone/mt-md", feedbackEmail: "inbox@example.org" }
const FACTS = { version: "0.4.3", browser: "Chrome 130", where: "localhost" }

test("one Feedback link: the issue page by default, and its tooltip names where it goes", () => {
  const t = feedbackTarget(null, SUPPORT, FACTS)
  assert.equal(t.kind, "issues")
  assert.equal(t.newTab, true)
  assert.match(t.href, /^https:\/\/github\.com\/someone\/mt-md\/issues\/new\?/)
  assert.match(t.title, /github\.com\/someone\/mt-md/)
  assert.match(t.title, /Nothing is sent until you submit/)
  assert.deepEqual(normalizeFeedback({ choice: "nonsense", custom: 5 }), { choice: "issues", custom: "" })
})

test("the Feedback link can go to the project's email or to the reader's own link or address", () => {
  const mail = feedbackTarget({ choice: "email" }, SUPPORT, FACTS)
  assert.equal(mail.kind, "email")
  assert.equal(mail.newTab, false)
  assert.match(mail.href, /^mailto:inbox@example\.org\?subject=/)
  assert.match(mail.title, /email to inbox@example\.org/)
  const own = feedbackTarget({ choice: "custom", custom: "https://forum.example.org/c/mt-md/?x=1" }, SUPPORT, FACTS)
  assert.equal(own.kind, "custom")
  assert.equal(own.href, "https://forum.example.org/c/mt-md/?x=1")
  assert.match(own.title, /forum\.example\.org\/c\/mt-md/)
  assert.match(own.title, /Nothing is filled in/)
  const ownMail = feedbackTarget({ choice: "custom", custom: "me@example.net" }, SUPPORT, FACTS)
  assert.match(ownMail.href, /^mailto:me@example\.net\?/)
  assert.match(ownMail.title, /email to me@example\.net/)
})

test("a Feedback choice that cannot be used falls back instead of going nowhere", () => {
  for (const custom of ["", "http://insecure.example", "javascript:alert(1)", "a@b", "x@y.org,z@y.org"]) {
    assert.equal(feedbackTarget({ choice: "custom", custom }, SUPPORT, FACTS).kind, "issues", `custom=${custom}`)
  }
  assert.equal(feedbackTarget({ choice: "email" }, { feedbackUrl: SUPPORT.feedbackUrl }, FACTS).kind, "issues", "no project email")
  assert.equal(feedbackTarget({ choice: "issues" }, { feedbackEmail: "inbox@example.org" }, FACTS).kind, "email", "no issue page")
  assert.equal(feedbackTarget(null, {}, FACTS), null, "nothing set up: no link")
})

function feedbackProps(settings = {}, support = SUPPORT) {
  let current = normalizeFeedback(settings)
  const saved = []
  return {
    saved,
    get settings() { return current },
    choices: FEEDBACK_CHOICES,
    onChange: (next) => { current = normalizeFeedback(next); saved.push(current) },
    target: () => feedbackTarget(current, support, FACTS)
  }
}

test("Settings has one Feedback link; its gear changes where it goes and the tooltip follows", () => {
  page()
  const props = feedbackProps()
  const bar = mountToolbar({}, ["print"], () => {}, null, null, null, null, null, null, props)
  document.getElementById("mt-md-btn-settings").click()
  const a = document.getElementById("mt-md-feedback")
  assert.match(a.textContent, /^Feedback$/)
  assert.equal(a.target, "_blank")
  assert.match(a.rel, /noopener/)
  assert.match(a.title, /issue page github\.com\/someone\/mt-md/)
  assert.equal(a.getAttribute("aria-label"), a.title)
  assert.equal(document.getElementById("mt-md-feedback-email"), null, "no separate email link")
  document.getElementById("mt-md-feedback-gear").click()
  const select = document.getElementById("mt-md-feedback-choice")
  const custom = document.getElementById("mt-md-feedback-custom")
  assert.equal(custom.hidden, true)
  select.value = "email"
  select.dispatchEvent(new window.Event("change"))
  assert.match(a.getAttribute("href"), /^mailto:inbox@example\.org/)
  assert.equal(a.target, "", "a mail link opens the mail program, not a tab")
  assert.match(a.title, /email to inbox@example\.org/)
  select.value = "custom"
  select.dispatchEvent(new window.Event("change"))
  assert.equal(custom.hidden, false)
  custom.value = "https://forum.example.org/mt-md"
  custom.dispatchEvent(new window.Event("change"))
  assert.equal(a.getAttribute("href"), "https://forum.example.org/mt-md")
  assert.equal(a.target, "_blank")
  assert.match(a.title, /forum\.example\.org\/mt-md/)
  assert.deepEqual(props.saved.at(-1), { choice: "custom", custom: "https://forum.example.org/mt-md" })
  bar.remove()
})

test("with nothing set up there is no feedback link", () => {
  page()
  const bar = mountToolbar({}, ["print"], () => {}, null, null, null, null, null, null, feedbackProps({}, {}))
  document.getElementById("mt-md-btn-settings").click()
  assert.equal(document.getElementById("mt-md-feedback"), null)
  bar.remove()
  const bar2 = mountToolbar({}, ["print"], () => {}, null, null, null, null, null, null, null)
  document.getElementById("mt-md-btn-settings").click()
  assert.equal(document.getElementById("mt-md-feedback"), null)
  bar2.remove()
})
